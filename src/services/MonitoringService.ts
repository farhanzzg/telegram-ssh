/**
 * Monitoring Service
 * Provides server health monitoring and alerting
 */

import { EventEmitter } from "events";
import type { LogContext, Server } from "../types/index.js";
import { LoggingService } from "./LoggingService.js";

/**
 * Server monitoring status
 */
export interface ServerMonitorStatus {
  serverId: string;
  serverName: string;
  host: string;
  isReachable: boolean;
  lastCheck: Date | null;
  lastSuccessfulCheck: Date | null;
  consecutiveFailures: number;
  latency: number | null;
  error?: string;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number;
  timeout: number;
  alertThreshold: number;
  cooldownPeriod: number;
}

/**
 * Monitoring event types
 */
export type MonitoringEvent =
  | "server:unreachable"
  | "server:recovered"
  | "server:degraded"
  | "alert:triggered";

/**
 * Monitoring event payload
 */
export interface MonitoringEventPayload {
  server: Server;
  status: ServerMonitorStatus;
  previousStatus?: ServerMonitorStatus;
  timestamp: Date;
}

/**
 * Service for monitoring server health
 */
export class MonitoringService extends EventEmitter {
  private readonly logger: LoggingService;
  private readonly config: MonitoringConfig;
  private readonly serverStatuses: Map<string, ServerMonitorStatus> = new Map();
  private checkTimer: NodeJS.Timeout | null = null;
  private lastAlertTime: Map<string, Date> = new Map();
  private isRunning = false;
  private checkFunction: ((server: Server) => Promise<boolean>) | null = null;

  constructor(config: Partial<MonitoringConfig>, logger: LoggingService) {
    super();
    this.config = {
      enabled: config.enabled ?? true,
      checkInterval: config.checkInterval ?? 60000, // 1 minute
      timeout: config.timeout ?? 10000, // 10 seconds
      alertThreshold: config.alertThreshold ?? 3, // 3 consecutive failures
      cooldownPeriod: config.cooldownPeriod ?? 300000, // 5 minutes
    };
    this.logger = logger;
  }

  /**
   * Set the check function for server reachability
   */
  setCheckFunction(fn: (server: Server) => Promise<boolean>): void {
    this.checkFunction = fn;
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.scheduleNextCheck();
    this.logger.info("Monitoring service started", {
      checkInterval: this.config.checkInterval,
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    this.isRunning = false;
    this.logger.info("Monitoring service stopped");
  }

  /**
   * Register a server for monitoring
   */
  registerServer(server: Server): void {
    const status: ServerMonitorStatus = {
      serverId: server.id,
      serverName: server.note ?? server.host,
      host: server.host,
      isReachable: true,
      lastCheck: null,
      lastSuccessfulCheck: null,
      consecutiveFailures: 0,
      latency: null,
    };

    this.serverStatuses.set(server.id, status);
    this.logger.debug("Server registered for monitoring", {
      serverId: server.id,
      serverName: status.serverName,
    });
  }

  /**
   * Unregister a server from monitoring
   */
  unregisterServer(serverId: string): void {
    this.serverStatuses.delete(serverId);
    this.lastAlertTime.delete(serverId);
    this.logger.debug("Server unregistered from monitoring", { serverId });
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): ServerMonitorStatus | undefined {
    return this.serverStatuses.get(serverId);
  }

  /**
   * Get all server statuses
   */
  getAllStatuses(): ServerMonitorStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  /**
   * Check a specific server
   */
  async checkServer(server: Server): Promise<ServerMonitorStatus> {
    const status = this.serverStatuses.get(server.id);
    if (!status) {
      throw new Error(`Server ${server.id} not registered for monitoring`);
    }

    const previousStatus = { ...status };
    const startTime = Date.now();

    try {
      if (!this.checkFunction) {
        throw new Error("Check function not configured");
      }

      const isReachable = await this.checkFunction(server);
      const latency = Date.now() - startTime;

      status.lastCheck = new Date();
      status.latency = latency;
      status.error = undefined;

      if (isReachable) {
        status.isReachable = true;
        status.lastSuccessfulCheck = new Date();

        // Check for recovery
        if (previousStatus.consecutiveFailures > 0) {
          this.emit("server:recovered", {
            server,
            status,
            previousStatus,
            timestamp: new Date(),
          } satisfies MonitoringEventPayload);
          this.logger.info("Server recovered", {
            serverId: server.id,
            serverName: status.serverName,
            previousFailures: previousStatus.consecutiveFailures,
          });
        }

        status.consecutiveFailures = 0;
      } else {
        this.handleFailure(
          server,
          status,
          previousStatus,
          "Health check returned false",
        );
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      status.lastCheck = new Date();
      status.latency = latency;
      status.error = error instanceof Error ? error.message : String(error);
      this.handleFailure(server, status, previousStatus, status.error);
    }

    return status;
  }

  /**
   * Handle server failure
   */
  private handleFailure(
    server: Server,
    status: ServerMonitorStatus,
    previousStatus: ServerMonitorStatus,
    error: string,
  ): void {
    status.isReachable = false;
    status.consecutiveFailures++;
    status.error = error;

    this.logger.warn("Server health check failed", {
      serverId: server.id,
      serverName: status.serverName,
      consecutiveFailures: status.consecutiveFailures,
      error,
    });

    // Emit unreachable event
    this.emit("server:unreachable", {
      server,
      status,
      previousStatus,
      timestamp: new Date(),
    } satisfies MonitoringEventPayload);

    // Check if alert should be triggered
    if (status.consecutiveFailures >= this.config.alertThreshold) {
      this.maybeTriggerAlert(server, status, previousStatus);
    }
  }

  /**
   * Maybe trigger an alert (respects cooldown)
   */
  private maybeTriggerAlert(
    server: Server,
    status: ServerMonitorStatus,
    previousStatus: ServerMonitorStatus,
  ): void {
    const lastAlert = this.lastAlertTime.get(server.id);
    const now = new Date();

    // Check cooldown
    if (lastAlert) {
      const timeSinceLastAlert = now.getTime() - lastAlert.getTime();
      if (timeSinceLastAlert < this.config.cooldownPeriod) {
        this.logger.debug("Alert skipped due to cooldown", {
          serverId: server.id,
          timeSinceLastAlert,
          cooldownPeriod: this.config.cooldownPeriod,
        });
        return;
      }
    }

    this.lastAlertTime.set(server.id, now);
    this.emit("alert:triggered", {
      server,
      status,
      previousStatus,
      timestamp: now,
    } satisfies MonitoringEventPayload);

    this.logger.error("Server alert triggered", undefined, {
      serverId: server.id,
      serverName: status.serverName,
      consecutiveFailures: status.consecutiveFailures,
      error: status.error,
    });
  }

  /**
   * Schedule next monitoring check
   */
  private scheduleNextCheck(): void {
    this.checkTimer = setTimeout(() => {
      this.performCheck();
    }, this.config.checkInterval);
  }

  /**
   * Perform monitoring check on all servers
   */
  private async performCheck(): Promise<void> {
    const servers = Array.from(this.serverStatuses.keys());

    if (servers.length === 0) {
      this.scheduleNextCheck();
      return;
    }

    this.logger.debug("Performing monitoring check", {
      serverCount: servers.length,
    });

    // Check all servers in parallel
    // Note: We need the actual Server objects, but we only have IDs here
    // In practice, this would be called with server objects from the caller
    // For now, we emit an event that the caller can handle
    this.emit("check:needed", servers);

    this.scheduleNextCheck();
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    totalServers: number;
    reachableServers: number;
    unreachableServers: number;
    isRunning: boolean;
  } {
    let reachable = 0;
    let unreachable = 0;

    for (const status of this.serverStatuses.values()) {
      if (status.isReachable) {
        reachable++;
      } else {
        unreachable++;
      }
    }

    return {
      totalServers: this.serverStatuses.size,
      reachableServers: reachable,
      unreachableServers: unreachable,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get log context for monitoring-related logs
   */
  getLogContext(): LogContext {
    const stats = this.getStats();
    return {
      monitoring: stats.isRunning,
      totalServers: stats.totalServers,
      reachableServers: stats.reachableServers,
      unreachableServers: stats.unreachableServers,
    };
  }
}
