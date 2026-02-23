/**
 * Base error class for all application errors
 */

import { ErrorCode, type ErrorDetails } from "../types/index.js";

export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = options?.context;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown (only in V8/Node.js)
    const captureStackTrace = (
      Error as unknown as {
        captureStackTrace?: (
          targetObject: object,
          constructorOpt?: Function,
        ) => void;
      }
    ).captureStackTrace;

    if (captureStackTrace) {
      captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause,
    };
  }

  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}
