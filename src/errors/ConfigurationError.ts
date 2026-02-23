/**
 * Configuration error classes
 */

import { ErrorCode } from "../types/index.js";
import { BaseError } from "./BaseError.js";

export class ConfigurationError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(code, message, options);
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(
    configKey: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(
      ErrorCode.MISSING_CONFIG,
      `Missing required configuration: ${configKey}`,
      {
        ...options,
        context: { ...options?.context, configKey },
      },
    );
  }
}

export class InvalidConfigError extends ConfigurationError {
  constructor(
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(ErrorCode.INVALID_CONFIG, message, options);
  }
}
