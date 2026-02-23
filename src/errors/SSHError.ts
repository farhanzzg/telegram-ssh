/**
 * SSH error classes
 */

import { ErrorCode } from "../types/index.js";
import { BaseError } from "./BaseError.js";

export class SSHError extends BaseError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error },
  ) {
    super(code, message, options);
  }
}

export class ConnectionFailedError extends SSHError {
  constructor(host: string, cause?: Error) {
    super(ErrorCode.CONNECTION_FAILED, `Failed to connect to ${host}`, {
      context: { host },
      cause,
    });
  }
}

export class CommandFailedError extends SSHError {
  constructor(command: string, exitCode: number | null, stderr: string) {
    super(
      ErrorCode.COMMAND_FAILED,
      `Command failed with exit code ${exitCode ?? "unknown"}`,
      {
        context: { command, exitCode, stderr },
      },
    );
  }
}

export class ConnectionTimeoutError extends SSHError {
  constructor(host: string, timeout: number) {
    super(
      ErrorCode.CONNECTION_TIMEOUT,
      `Connection to ${host} timed out after ${timeout}ms`,
      {
        context: { host, timeout },
      },
    );
  }
}

export class DisconnectedError extends SSHError {
  constructor(message: string = "No active SSH connection") {
    super(ErrorCode.DISCONNECTED, message);
  }
}
