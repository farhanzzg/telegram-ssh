/**
 * Error type definitions
 */

export enum ErrorCode {
  // Validation Errors (1xxx)
  INVALID_INPUT = 1001,
  INVALID_SERVER_CONFIG = 1002,
  INVALID_COMMAND = 1003,
  INVALID_PATH = 1004,

  // Authentication Errors (2xxx)
  UNAUTHORIZED = 2001,
  INVALID_CREDENTIALS = 2002,
  RATE_LIMITED = 2003,

  // SSH Errors (3xxx)
  CONNECTION_FAILED = 3001,
  COMMAND_FAILED = 3002,
  CONNECTION_TIMEOUT = 3003,
  DISCONNECTED = 3004,

  // Configuration Errors (4xxx)
  MISSING_CONFIG = 4001,
  INVALID_CONFIG = 4002,

  // Storage Errors (5xxx)
  FILE_NOT_FOUND = 5001,
  FILE_READ_ERROR = 5002,
  FILE_WRITE_ERROR = 5003,

  // Pool Errors (6xxx)
  POOL_EXHAUSTED = 6001,
  CONNECTION_ACQUIRE_TIMEOUT = 6002,

  // Internal Errors (9xxx)
  INTERNAL_ERROR = 9001,
  UNKNOWN_ERROR = 9999,
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
  cause?: Error;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}
