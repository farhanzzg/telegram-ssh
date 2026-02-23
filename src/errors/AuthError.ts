/**
 * Authentication error classes
 */

import { ErrorCode } from "../types/index.js";
import { BaseError } from "./BaseError.js";

export class AuthError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(code, message, options);
  }
}

export class UnauthorizedError extends AuthError {
  constructor(
    userId: number,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(ErrorCode.UNAUTHORIZED, "Unauthorized access attempt", {
      ...options,
      context: { ...options?.context, userId },
    });
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(
    serverId: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(ErrorCode.INVALID_CREDENTIALS, "Invalid credentials provided", {
      ...options,
      context: { ...options?.context, serverId },
    });
  }
}

export class RateLimitedError extends AuthError {
  constructor(
    retryAfter: number,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(
      ErrorCode.RATE_LIMITED,
      `Rate limited. Try again in ${retryAfter} seconds`,
      {
        ...options,
        context: { ...options?.context, retryAfter },
      },
    );
  }
}
