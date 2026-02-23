/**
 * SSH Client
 * Provides SSH connection management and command execution with timeout and cancellation support
 */

import { Client, ClientChannel } from "ssh2";
import {
  CommandFailedError,
  ConnectionFailedError,
  ConnectionTimeoutError,
  DisconnectedError,
} from "../errors/index.js";
import type {
  CommandResult,
  ISSHClient,
  SSHConnectionConfig,
  SSHConnectionState,
} from "../types/index.js";

/**
 * Cancellation token for aborting operations
 */
export class CancellationToken {
  private cancelled = false;
  private readonly listeners: Array<() => void> = [];

  /**
   * Check if cancellation has been requested
   */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Request cancellation
   */
  cancel(): void {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors
      }
    }
    this.listeners.length = 0;
  }

  /**
   * Register a callback for cancellation
   */
  onCancel(callback: () => void): void {
    if (this.cancelled) {
      callback();
    } else {
      this.listeners.push(callback);
    }
  }

  /**
   * Throw if cancelled
   */
  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new Error("Operation cancelled");
    }
  }
}

/**
 * Cancellation token source for creating tokens
 */
export class CancellationTokenSource {
  readonly token: CancellationToken;

  constructor() {
    this.token = new CancellationToken();
  }

  /**
   * Cancel the operation
   */
  cancel(): void {
    this.token.cancel();
  }
}

/**
 * Execute options for command execution
 */
export interface ExecuteOptions {
  timeout?: number;
  cancellationToken?: CancellationToken;
  maxBufferSize?: number;
  chunkCallback?: (chunk: string, isStderr: boolean) => void;
}

/**
 * Stream chunk for large outputs
 */
export interface StreamChunk {
  data: string;
  isStderr: boolean;
  timestamp: Date;
}

/**
 * SSH Client implementation with enhanced timeout and cancellation support
 */
export class SSHClient implements ISSHClient {
  private client: Client | null = null;
  private serverId: string | undefined;
  private state: SSHConnectionState = { status: "disconnected" };
  private readonly connectionTimeout: number;
  private readonly commandTimeout: number;
  private activeExecutions: Map<
    string,
    { stream: ClientChannel; timeoutId: NodeJS.Timeout }
  > = new Map();

  constructor(options?: {
    connectionTimeout?: number;
    commandTimeout?: number;
  }) {
    this.connectionTimeout = options?.connectionTimeout ?? 30000;
    this.commandTimeout = options?.commandTimeout ?? 60000;
  }

  /**
   * Connect to SSH server
   */
  async connect(config: SSHConnectionConfig): Promise<void> {
    // Disconnect existing connection
    if (this.isConnected()) {
      await this.disconnect();
    }

    this.state = { status: "connecting" };

    return new Promise((resolve, reject) => {
      const client = new Client();

      const timeoutId = setTimeout(() => {
        client.removeAllListeners();
        client.destroy();
        this.state = {
          status: "error",
          lastError: new Error("Connection timeout"),
        };
        reject(new ConnectionTimeoutError(config.host, this.connectionTimeout));
      }, this.connectionTimeout);

      client.on("ready", () => {
        clearTimeout(timeoutId);
        this.client = client;
        this.state = {
          status: "connected",
          connectedAt: new Date(),
        };
        resolve();
      });

      client.on("error", (err: Error) => {
        clearTimeout(timeoutId);
        this.state = { status: "error", lastError: err };
        reject(new ConnectionFailedError(config.host, err));
      });

      client.on("close", () => {
        this.client = null;
        this.state = { status: "disconnected" };
        // Cancel all active executions
        this.cancelAllExecutions();
      });

      // Build connection options
      const connectOptions: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: this.connectionTimeout,
        keepaliveInterval: config.keepaliveInterval ?? 10000,
      };

      if (config.password) {
        connectOptions.password = config.password;
      }

      if (config.privateKey) {
        connectOptions.privateKey = config.privateKey;
        if (config.passphrase) {
          connectOptions.passphrase = config.passphrase;
        }
      }

      try {
        client.connect(connectOptions);
      } catch (err) {
        clearTimeout(timeoutId);
        reject(
          new ConnectionFailedError(
            config.host,
            err instanceof Error ? err : new Error(String(err)),
          ),
        );
      }
    });
  }

  /**
   * Disconnect from SSH server
   */
  async disconnect(): Promise<void> {
    // Cancel all active executions first
    this.cancelAllExecutions();

    if (this.client) {
      return new Promise((resolve) => {
        if (this.client) {
          this.client.removeAllListeners();
          this.client.on("close", () => {
            this.client = null;
            this.state = { status: "disconnected" };
            resolve();
          });
          this.client.end();
        } else {
          resolve();
        }
      });
    }
    this.state = { status: "disconnected" };
  }

  /**
   * Check if connected to SSH server
   */
  isConnected(): boolean {
    return this.state.status === "connected" && this.client !== null;
  }

  /**
   * Execute a command on the SSH server
   */
  async execute(
    command: string,
    options?: ExecuteOptions,
  ): Promise<CommandResult> {
    if (!this.isConnected() || !this.client) {
      throw new DisconnectedError("Not connected to SSH server");
    }

    const timeout = options?.timeout ?? this.commandTimeout;
    const cancellationToken = options?.cancellationToken;
    const maxBufferSize = options?.maxBufferSize ?? 10 * 1024 * 1024; // 10MB default
    const chunkCallback = options?.chunkCallback;

    // Check if already cancelled
    if (cancellationToken?.isCancelled) {
      throw new CommandFailedError(
        command,
        -1,
        "Command cancelled before execution",
      );
    }

    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;
      let signal: string | null = null;
      let cancelled = false;

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(
          new CommandFailedError(
            command,
            -1,
            `Command timeout after ${timeout}ms`,
          ),
        );
      }, timeout);

      const cleanup = (): void => {
        clearTimeout(timeoutId);
        this.activeExecutions.delete(executionId);
      };

      // Handle cancellation
      const cancelHandler = (): void => {
        cancelled = true;
        cleanup();
        // Close the stream
        const exec = this.activeExecutions.get(executionId);
        if (exec?.stream) {
          try {
            exec.stream.close();
          } catch {
            // Ignore close errors
          }
        }
        reject(
          new CommandFailedError(command, -1, "Command cancelled by user"),
        );
      };

      if (cancellationToken) {
        cancellationToken.onCancel(cancelHandler);
      }

      // Check if cancelled before exec
      if (cancellationToken?.isCancelled) {
        cleanup();
        reject(
          new CommandFailedError(
            command,
            -1,
            "Command cancelled before execution",
          ),
        );
        return;
      }

      this.client!.exec(
        command,
        (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            cleanup();
            reject(new CommandFailedError(command, 1, err.message));
            return;
          }

          // Store the stream for potential cancellation
          this.activeExecutions.set(executionId, { stream, timeoutId });

          stream.on("close", (code: number | null, sig: string | null) => {
            if (cancelled) {
              return;
            }
            cleanup();
            exitCode = code;
            signal = sig;

            const duration = Date.now() - startTime;

            resolve({
              stdout,
              stderr,
              exitCode,
              signal,
              duration,
            });
          });

          stream.on("data", (data: Buffer) => {
            const chunk = data.toString();

            // Check buffer size limit
            if (stdout.length + chunk.length > maxBufferSize) {
              cleanup();
              stream.close();
              reject(
                new CommandFailedError(
                  command,
                  -1,
                  `Output exceeds maximum buffer size (${maxBufferSize} bytes)`,
                ),
              );
              return;
            }

            stdout += chunk;

            // Call chunk callback if provided
            if (chunkCallback) {
              try {
                chunkCallback(chunk, false);
              } catch {
                // Ignore callback errors
              }
            }
          });

          stream.stderr.on("data", (data: Buffer) => {
            const chunk = data.toString();

            // Check buffer size limit for stderr
            if (stderr.length + chunk.length > maxBufferSize) {
              cleanup();
              stream.close();
              reject(
                new CommandFailedError(
                  command,
                  -1,
                  `Stderr exceeds maximum buffer size (${maxBufferSize} bytes)`,
                ),
              );
              return;
            }

            stderr += chunk;

            // Call chunk callback if provided
            if (chunkCallback) {
              try {
                chunkCallback(chunk, true);
              } catch {
                // Ignore callback errors
              }
            }
          });

          stream.on("error", (streamErr: Error) => {
            if (cancelled) {
              return;
            }
            cleanup();
            reject(new CommandFailedError(command, 1, streamErr.message));
          });
        },
      );
    });
  }

  /**
   * Execute a command with streaming output
   */
  async executeStreaming(
    command: string,
    onChunk: (chunk: StreamChunk) => void,
    options?: ExecuteOptions,
  ): Promise<CommandResult> {
    return this.execute(command, {
      ...options,
      chunkCallback: (data, isStderr) => {
        onChunk({
          data,
          isStderr,
          timestamp: new Date(),
        });
      },
    });
  }

  /**
   * Cancel all active executions
   */
  private cancelAllExecutions(): void {
    for (const [_id, exec] of this.activeExecutions) {
      try {
        clearTimeout(exec.timeoutId);
        exec.stream.close();
      } catch {
        // Ignore close errors
      }
    }
    this.activeExecutions.clear();
  }

  /**
   * Get the server ID if connected
   */
  getServerId(): string | undefined {
    return this.serverId;
  }

  /**
   * Set the server ID
   */
  setServerId(id: string): void {
    this.serverId = id;
  }

  /**
   * Get current connection state
   */
  getState(): SSHConnectionState {
    return { ...this.state };
  }

  /**
   * Get active execution count
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }
}
