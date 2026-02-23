/**
 * Storage error classes
 */

import { ErrorCode } from "../types/index.js";
import { BaseError } from "./BaseError.js";

export class StorageError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(code, message, options);
  }
}

export class FileNotFoundError extends StorageError {
  constructor(
    filePath: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
      ...options,
      context: { ...options?.context, filePath },
    });
  }
}

export class FileReadError extends StorageError {
  constructor(filePath: string, cause?: Error) {
    super(ErrorCode.FILE_READ_ERROR, `Failed to read file: ${filePath}`, {
      context: { filePath },
      cause,
    });
  }
}

export class FileWriteError extends StorageError {
  constructor(filePath: string, cause?: Error) {
    super(ErrorCode.FILE_WRITE_ERROR, `Failed to write file: ${filePath}`, {
      context: { filePath },
      cause,
    });
  }
}
