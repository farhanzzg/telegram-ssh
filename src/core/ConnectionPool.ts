/**
 * Connection Pool
 * Manages multiple SSH connections with pooling, timeout, and health monitoring
 */

import { EventEmitter } from "events";
import {
  ConnectionFailedError,
  ConnectionTimeoutError,
  PoolExhaustedError,
} from "../errors/index.js";
import { LoggingService } from "../services/LoggingService.js";
import type { CommandResult, SSHConnectionConfig } from "../types/index.js";
import { SSHClient } from "./SSHClient.js";

/**
 * Pooled connection wrapper
 */
interface PooledConnection {
  id: string;
  serverId: string;
  client: SSHClient;
  createdAt: Date;
  lastUsedAt: Date;
  inUse: boolean;
  healthCheckFailures: number;
}

/**
 * Connection pool options
 */
export interface ConnectionPoolOptions {
  maxConnections: number;
  connectionTimeout: number;
  commandTimeout: number;
  idleTimeout: number;
  healthCheckInterval: number;
  maxHealthCheckFailures: number;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequestsServed: number;
}

/**
 * Internal connection request
 */
interface ConnectionRequest {
  serverId: string;
  config: SSHConnectionConfig;
  resolve: (connection: PooledConnection) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: Date;
}

/**
 * Connection pool for managing multiple SSH connections
 */
export class ConnectionPool extends EventEmitter {
  private readonly connections: Map<string, PooledConnection> = new Map();
  private readonly waitingQueue: ConnectionRequest[] = [];
  private readonly options: ConnectionPoolOptions;
  private readonly logger: LoggingService;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  private totalRequestsServed = 0;
  private isDraining = false;

  constructor(options: Partial<ConnectionPoolOptions>, logger: LoggingService) {
    super();
    this.options = {
      maxConnections: options.maxConnections ?? 10,
      connectionTimeout: options.connectionTimeout ?? 30000,
      commandTimeout: options.commandTimeout ?? 60000,
      idleTimeout: options.idleTimeout ?? 300000, // 5 minutes
      healthCheckInterval: options.healthCheckInterval ?? 60000, // 1 minute
      maxHealthCheckFailures: options.maxHealthCheckFailures ?? 3,
    };
    this.logger = logger;
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    this.startHealthCheck();
    this.startIdleCheck();
    this.logger.info("Connection pool initialized", {
      maxConnections: this.options.maxConnections,
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(
    serverId: string,
    config: SSHConnectionConfig,
  ): Promise<PooledConnection> {
    if (this.isDraining) {
      throw new Error("Connection pool is draining");
    }

    // Check for existing idle connection
    const existingConn = this.findIdleConnection(serverId);
    if (existingConn) {
      existingConn.inUse = true;
      existingConn.lastUsedAt = new Date();
      this.totalRequestsServed++;
      this.logger.debug("Reusing existing connection", {
        serverId,
        connectionId: existingConn.id,
      });
      return existingConn;
    }

    // Check if we can create a new connection
    if (this.connections.size < this.options.maxConnections) {
      return this.createConnection(serverId, config);
    }

    // Wait for a connection to become available
    return this.waitForConnection(serverId, config);
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    const pooled = this.connections.get(connection.id);
    if (!pooled) {
      return;
    }

    pooled.inUse = false;
    pooled.lastUsedAt = new Date();

    // Process waiting queue
    this.processWaitingQueue();

    this.logger.debug("Connection released", {
      connectionId: connection.id,
      serverId: connection.serverId,
    });
  }

  /**
   * Remove a connection from the pool
   */
  async remove(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      await connection.client.disconnect();
    } catch (error) {
      this.logger.warn("Error disconnecting during removal", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.connections.delete(connectionId);
    this.emit("connectionRemoved", connectionId);

    this.logger.info("Connection removed from pool", { connectionId });
  }

  /**
   * Drain all connections and shutdown pool
   */
  async drain(): Promise<void> {
    this.isDraining = true;

    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }

    // Reject all waiting requests
    for (const request of this.waitingQueue) {
      clearTimeout(request.timeoutId);
      request.reject(new Error("Connection pool is draining"));
    }
    this.waitingQueue.length = 0;

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(
      async (conn) => {
        try {
          await conn.client.disconnect();
        } catch (error) {
          this.logger.warn("Error disconnecting during drain", {
            connectionId: conn.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    await Promise.allSettled(closePromises);
    this.connections.clear();

    this.logger.info("Connection pool drained");
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let activeConnections = 0;
    let idleConnections = 0;

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        activeConnections++;
      } else {
        idleConnections++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      waitingRequests: this.waitingQueue.length,
      totalRequestsServed: this.totalRequestsServed,
    };
  }

  /**
   * Get active connection count
   */
  getActiveCount(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        count++;
      }
    }
    return count;
  }

  /**
   * Execute a command on a pooled connection
   */
  async executeCommand(
    serverId: string,
    config: SSHConnectionConfig,
    command: string,
  ): Promise<CommandResult> {
    const connection = await this.acquire(serverId, config);

    try {
      const result = await connection.client.execute(command);
      return result;
    } finally {
      this.release(connection);
    }
  }

  /**
   * Find an idle connection for the given server
   */
  private findIdleConnection(serverId: string): PooledConnection | null {
    for (const conn of this.connections.values()) {
      if (conn.serverId === serverId && !conn.inUse) {
        return conn;
      }
    }
    return null;
  }

  /**
   * Create a new connection
   */
  private async createConnection(
    serverId: string,
    config: SSHConnectionConfig,
  ): Promise<PooledConnection> {
    const connectionId = this.generateConnectionId();
    const client = new SSHClient({
      connectionTimeout: this.options.connectionTimeout,
      commandTimeout: this.options.commandTimeout,
    });

    try {
      await client.connect(config);
      client.setServerId(serverId);

      const pooled: PooledConnection = {
        id: connectionId,
        serverId,
        client,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        inUse: true,
        healthCheckFailures: 0,
      };

      this.connections.set(connectionId, pooled);
      this.totalRequestsServed++;

      this.logger.info("New connection created", {
        connectionId,
        serverId,
        totalConnections: this.connections.size,
      });

      this.emit("connectionCreated", connectionId, serverId);

      return pooled;
    } catch (error) {
      if (error instanceof ConnectionTimeoutError) {
        throw error;
      }
      throw new ConnectionFailedError(
        config.host,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(
    serverId: string,
    config: SSHConnectionConfig,
  ): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      let request: ConnectionRequest;
      let handled = false;
      let timeoutId: NodeJS.Timeout;

      const cleanup = (): void => {
        // Remove from queue
        const index = this.waitingQueue.indexOf(request);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
      };

      const handleResolve = (conn: PooledConnection): void => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve(conn);
      };

      const handleReject = (error: Error): void => {
        if (handled) return;
        handled = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(error);
      };

      timeoutId = setTimeout(() => {
        if (handled) return;
        handled = true;
        cleanup();

        this.logger.debug("Connection request timed out", {
          serverId,
          queueLength: this.waitingQueue.length,
        });

        reject(
          new PoolExhaustedError(
            this.options.maxConnections,
            this.options.connectionTimeout,
          ),
        );
      }, this.options.connectionTimeout);

      // Create the request object
      request = {
        serverId,
        config,
        resolve: handleResolve,
        reject: handleReject,
        timeoutId,
        createdAt: new Date(),
      };

      this.waitingQueue.push(request);

      this.logger.debug("Connection request queued", {
        serverId,
        queueLength: this.waitingQueue.length,
      });
    });
  }

  /**
   * Process waiting queue when connections become available
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) {
      return;
    }

    // Find a request that can be served
    for (let i = 0; i < this.waitingQueue.length; i++) {
      const request = this.waitingQueue[i];
      if (!request) continue;

      // Check for idle connection
      const idleConn = this.findIdleConnection(request.serverId);
      if (idleConn) {
        this.waitingQueue.splice(i, 1);
        clearTimeout(request.timeoutId);
        idleConn.inUse = true;
        idleConn.lastUsedAt = new Date();
        this.totalRequestsServed++;
        request.resolve(idleConn);
        return;
      }

      // Create new connection if possible
      if (this.connections.size < this.options.maxConnections) {
        this.waitingQueue.splice(i, 1);
        clearTimeout(request.timeoutId);
        this.createConnection(request.serverId, request.config)
          .then(request.resolve)
          .catch(request.reject);
        return;
      }
    }
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        continue;
      }

      try {
        // Simple health check - execute echo command
        await conn.client.execute("echo 'health_check'");
        conn.healthCheckFailures = 0;
      } catch (error) {
        conn.healthCheckFailures++;
        this.logger.warn("Connection health check failed", {
          connectionId: conn.id,
          serverId: conn.serverId,
          failures: conn.healthCheckFailures,
        });

        if (conn.healthCheckFailures >= this.options.maxHealthCheckFailures) {
          this.logger.error(
            "Connection removed due to health check failures",
            undefined,
            {
              connectionId: conn.id,
              serverId: conn.serverId,
            },
          );
          await this.remove(conn.id);
        }
      }
    }
  }

  /**
   * Start idle connection check timer
   */
  private startIdleCheck(): void {
    this.idleCheckTimer = setInterval(() => {
      this.removeIdleConnections();
    }, 60000); // Check every minute
  }

  /**
   * Remove idle connections that have exceeded idle timeout
   */
  private async removeIdleConnections(): Promise<void> {
    const now = Date.now();

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        continue;
      }

      const idleTime = now - conn.lastUsedAt.getTime();
      if (idleTime > this.options.idleTimeout) {
        this.logger.info("Removing idle connection", {
          connectionId: conn.id,
          serverId: conn.serverId,
          idleTime: Math.floor(idleTime / 1000),
        });
        await this.remove(conn.id);
      }
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
