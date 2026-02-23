/**
 * Pool-related errors
 */

import { ErrorCode } from "../types/Errors.js";
import { BaseError } from "./BaseError.js";

/**
 * Error thrown when connection pool is exhausted
 */
export class PoolExhaustedError extends BaseError {
  readonly maxConnections: number;
  readonly timeout: number;

  constructor(maxConnections: number, timeout: number) {
    super(
      ErrorCode.POOL_EXHAUSTED,
      `Connection pool exhausted (max: ${maxConnections}, timeout: ${timeout}ms)`,
    );
    this.maxConnections = maxConnections;
    this.timeout = timeout;
  }
}

/**
 * Error thrown when a connection acquisition times out
 */
export class ConnectionAcquireTimeoutError extends BaseError {
  readonly serverId: string;
  readonly timeout: number;

  constructor(serverId: string, timeout: number) {
    super(
      ErrorCode.CONNECTION_ACQUIRE_TIMEOUT,
      `Timeout acquiring connection for server ${serverId} after ${timeout}ms`,
    );
    this.serverId = serverId;
    this.timeout = timeout;
  }
}
