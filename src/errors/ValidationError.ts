/**
 * Validation error classes
 */

import { ErrorCode } from "../types/index.js";
import { BaseError } from "./BaseError.js";

export class ValidationError extends BaseError {
  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(ErrorCode.INVALID_INPUT, message, options);
  }
}

export class InvalidServerConfigError extends ValidationError {
  constructor(
    details: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(`Invalid server configuration: ${details}`, {
      ...options,
      context: { ...options?.context, details },
    });
  }
}

export class InvalidCommandError extends ValidationError {
  constructor(
    command: string,
    reason: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(`Invalid command: ${reason}`, {
      ...options,
      context: { ...options?.context, command },
    });
  }
}

export class InvalidPathError extends ValidationError {
  constructor(
    path: string,
    reason: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(`Invalid path: ${reason}`, {
      ...options,
      context: { ...options?.context, path },
    });
  }
}
