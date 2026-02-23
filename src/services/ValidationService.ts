/**
 * Validation Service
 * Provides input validation and sanitization
 */

import type {
  SanitizedCommand,
  ServerConfig,
  SSHConnectionConfig,
  ValidationResult,
} from "../types/index.js";
import { sanitizeCommand, validateCommand } from "../utils/commandUtils.js";
import {
  parsePort,
  validateHost,
  validatePath,
  validatePort,
  validatePrivateKeyPath,
} from "../utils/pathUtils.js";

/**
 * Validation service for input sanitization and validation
 */
export class ValidationService {
  private readonly allowedCommands: string[] | undefined;
  private readonly blockedCommands: string[] | undefined;

  constructor(options?: {
    allowedCommands?: string[];
    blockedCommands?: string[];
  }) {
    this.allowedCommands = options?.allowedCommands;
    this.blockedCommands = options?.blockedCommands;
  }

  /**
   * Validate and sanitize a command
   */
  validateCommand(command: string): ValidationResult<SanitizedCommand> {
    // Basic validation
    if (!command || command.trim().length === 0) {
      return { valid: false, error: "Command cannot be empty" };
    }

    // Check against blocklist
    if (this.blockedCommands) {
      const parts = command.trim().split(/\s+/);
      const commandBase = parts[0];
      if (commandBase && this.blockedCommands.includes(commandBase)) {
        return { valid: false, error: `Command '${commandBase}' is blocked` };
      }
    }

    // Check against allowlist (if configured)
    if (this.allowedCommands && this.allowedCommands.length > 0) {
      const parts = command.trim().split(/\s+/);
      const commandBase = parts[0];
      if (commandBase && !this.allowedCommands.includes(commandBase)) {
        return {
          valid: false,
          error: `Command '${commandBase}' is not allowed`,
        };
      }
    }

    // Sanitize command
    return validateCommand(command);
  }

  /**
   * Validate server configuration
   */
  validateServerConfig(
    data: Partial<ServerConfig>,
  ): ValidationResult<ServerConfig> {
    const errors: string[] = [];

    // Validate host
    if (!data.host) {
      errors.push("Host is required");
    } else {
      const hostResult = validateHost(data.host);
      if (!hostResult.valid) {
        errors.push(hostResult.error ?? "Invalid host");
      }
    }

    // Validate port
    if (data.port !== undefined) {
      const portResult = validatePort(data.port);
      if (!portResult.valid) {
        errors.push(portResult.error ?? "Invalid port");
      }
    }

    // Validate username
    if (!data.username || data.username.trim().length === 0) {
      errors.push("Username is required");
    }

    // Validate authentication
    if (!data.password && !data.privateKeyPath) {
      errors.push("Either password or privateKeyPath is required");
    }

    // Validate private key path if provided
    if (data.privateKeyPath) {
      const pathResult = validatePrivateKeyPath(data.privateKeyPath);
      if (!pathResult.valid) {
        errors.push(`Invalid private key path: ${pathResult.error}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join("; ") };
    }

    // Build valid config
    const config: ServerConfig = {
      host: data.host!.trim(),
      port: data.port ?? 22,
      username: data.username!.trim(),
      password: data.password,
      privateKeyPath: data.privateKeyPath,
      keyPassphrase: data.keyPassphrase,
      note: data.note?.trim(),
    };

    return { valid: true, data: config };
  }

  /**
   * Validate SSH connection configuration
   */
  validateSSHConfig(
    config: SSHConnectionConfig,
  ): ValidationResult<SSHConnectionConfig> {
    const errors: string[] = [];

    // Validate host
    const hostResult = validateHost(config.host);
    if (!hostResult.valid) {
      errors.push(hostResult.error ?? "Invalid host");
    }

    // Validate port
    const portResult = validatePort(config.port);
    if (!portResult.valid) {
      errors.push(portResult.error ?? "Invalid port");
    }

    // Validate username
    if (!config.username || config.username.trim().length === 0) {
      errors.push("Username is required");
    }

    // Validate authentication
    if (!config.password && !config.privateKey) {
      errors.push("Either password or privateKey is required");
    }

    if (errors.length > 0) {
      return { valid: false, error: errors.join("; ") };
    }

    return { valid: true, data: config };
  }

  /**
   * Validate a path for file operations
   */
  validatePath(inputPath: string, basePath?: string): ValidationResult<string> {
    return validatePath(inputPath, basePath);
  }

  /**
   * Validate a host address
   */
  validateHost(host: string): ValidationResult<string> {
    return validateHost(host);
  }

  /**
   * Validate a port number
   */
  validatePort(port: number): ValidationResult<number> {
    return validatePort(port);
  }

  /**
   * Parse and validate a port from string
   */
  parsePort(portStr: string): ValidationResult<number> {
    return parsePort(portStr);
  }

  /**
   * Sanitize a command string
   */
  sanitizeCommand(command: string): SanitizedCommand {
    return sanitizeCommand(command);
  }
}
