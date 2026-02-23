/**
 * Command sanitization utility
 * Provides safe command execution by sanitizing and validating commands
 */

import type { SanitizedCommand, ValidationResult } from "../types/index.js";

/**
 * Dangerous pattern definition
 */
interface DangerousPattern {
  pattern: RegExp;
  description: string;
}

/**
 * Dangerous patterns that should be blocked or warned about
 */
const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /;\s*rm\s+-rf/i, description: "rm -rf chain" },
  { pattern: /\|\s*rm\s+/i, description: "pipe to rm" },
  { pattern: />\s*\/dev\//i, description: "device redirection" },
  { pattern: /\$\([^)]+\)/, description: "command substitution" },
  { pattern: /`[^`]+`/, description: "backtick execution" },
  { pattern: /\$\{[^}]+\}/, description: "variable expansion" },
  { pattern: /&&\s*rm/i, description: "chained rm" },
  { pattern: /\|\|\s*rm/i, description: "or-chained rm" },
  { pattern: />\s*\//i, description: "root file write" },
  { pattern: /<\s*\//i, description: "root file read" },
  { pattern: /sudo\s+/i, description: "sudo commands" },
  { pattern: /chmod\s+777/i, description: "dangerous permissions" },
  { pattern: /chown\s+.*:.*\s+\//i, description: "ownership changes" },
];

/**
 * Shell metacharacters that need escaping
 */
const SHELL_METACHARACTERS = /[;&|`$\\]/g;

/**
 * Sanitize a command for safe execution
 */
export function sanitizeCommand(command: string): SanitizedCommand {
  const warnings: string[] = [];
  let sanitized = command.trim();

  // Check for dangerous patterns
  for (const { pattern, description } of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push(`Dangerous pattern detected: ${description}`);
    }
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Escape shell metacharacters for SSH
  sanitized = sanitized.replace(SHELL_METACHARACTERS, "\\$&");

  return {
    original: command,
    sanitized,
    warnings,
    isSafe: warnings.length === 0,
  };
}

/**
 * Validate a command for execution
 */
export function validateCommand(
  command: string,
): ValidationResult<SanitizedCommand> {
  if (!command || command.trim().length === 0) {
    return { valid: false, error: "Command cannot be empty" };
  }

  if (command.length > 10000) {
    return {
      valid: false,
      error: "Command is too long (max 10000 characters)",
    };
  }

  const sanitized = sanitizeCommand(command);

  // Block commands with dangerous patterns
  if (sanitized.warnings.length > 0) {
    return {
      valid: false,
      error: `Command contains dangerous patterns: ${sanitized.warnings.join(", ")}`,
    };
  }

  return { valid: true, data: sanitized };
}

/**
 * Parse command arguments safely
 */
export function parseCommandArgs(input: string): {
  command: string;
  args: string;
} {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(" ");

  if (spaceIndex === -1) {
    return { command: trimmed, args: "" };
  }

  return {
    command: trimmed.slice(0, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Escape a string for safe use in shell
 */
export function escapeShellArg(arg: string): string {
  // Use single quotes and escape any existing single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
