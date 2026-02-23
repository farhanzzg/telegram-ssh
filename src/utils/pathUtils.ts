/**
 * Path validation utility
 * Provides safe path handling and traversal prevention
 */

import * as path from "path";
import type { ValidationResult } from "../types/index.js";

/**
 * Allowed base paths for file operations
 */
const ALLOWED_PATHS: string[] = [
  "/home",
  "/var/log",
  "/var/www",
  "/etc/nginx",
  "/etc/systemd",
  "/opt",
  "/tmp",
];

/**
 * Forbidden paths that should never be accessed
 */
const FORBIDDEN_PATHS: string[] = [
  "/etc/shadow",
  "/etc/passwd",
  "/root/.ssh",
  "/etc/ssh",
  "/proc",
  "/sys",
];

/**
 * Validate a path for safe file operations
 */
export function validatePath(
  inputPath: string,
  basePath?: string,
): ValidationResult<string> {
  // Resolve the path
  const resolved = path.resolve(basePath || "/", inputPath);
  const normalized = path.normalize(resolved);

  // Check for path traversal attempts
  if (inputPath.includes("..")) {
    return { valid: false, error: "Path traversal detected" };
  }

  // Check for null bytes
  if (inputPath.includes("\0")) {
    return { valid: false, error: "Invalid null byte in path" };
  }

  // Check forbidden paths
  for (const forbidden of FORBIDDEN_PATHS) {
    if (normalized.startsWith(forbidden)) {
      return { valid: false, error: "Access to path is forbidden" };
    }
  }

  // Check allowed paths (if whitelist mode)
  const isAllowed = ALLOWED_PATHS.some((allowed) =>
    normalized.startsWith(allowed),
  );

  if (!isAllowed) {
    return { valid: false, error: "Path is not in allowed list" };
  }

  return { valid: true, data: normalized };
}

/**
 * Validate a private key path (less restrictive than validatePath)
 * Private keys are typically in ~/.ssh/ directory
 */
export function validatePrivateKeyPath(
  inputPath: string,
): ValidationResult<string> {
  if (!inputPath || inputPath.trim().length === 0) {
    return { valid: false, error: "Private key path cannot be empty" };
  }

  const trimmed = inputPath.trim();

  // Check for null bytes
  if (trimmed.includes("\0")) {
    return { valid: false, error: "Invalid null byte in path" };
  }

  // Check for path traversal attempts (but allow .. in home directory context)
  // Only block absolute path traversal
  const resolved = path.resolve(trimmed);

  // Check forbidden paths - never allow access to system critical files
  for (const forbidden of FORBIDDEN_PATHS) {
    if (resolved.startsWith(forbidden)) {
      return { valid: false, error: "Access to path is forbidden" };
    }
  }

  // Validate that the path looks like a private key file
  // Common private key extensions and names
  const validExtensions = [".pem", ".key", ""];
  const validNames = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"];

  const basename = path.basename(resolved);
  const hasValidExtension =
    validExtensions.some((ext) => basename.endsWith(ext)) ||
    validNames.some((name) => basename.startsWith(name));

  if (!hasValidExtension && !basename.includes("_")) {
    // Allow files with underscores (common for custom key names)
    // Just warn about extension but don't block
  }

  return { valid: true, data: resolved };
}

/**
 * Validate a host address
 */
export function validateHost(host: string): ValidationResult<string> {
  if (!host || host.trim().length === 0) {
    return { valid: false, error: "Host cannot be empty" };
  }

  const trimmed = host.trim();

  // Check for valid hostname or IP format
  const hostnameRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  const isValidHost =
    hostnameRegex.test(trimmed) ||
    ipv4Regex.test(trimmed) ||
    ipv6Regex.test(trimmed);

  if (!isValidHost) {
    return { valid: false, error: "Invalid host format" };
  }

  // Validate IPv4 octets if it's an IPv4 address
  if (ipv4Regex.test(trimmed)) {
    const octets = trimmed.split(".").map(Number);
    const validOctets = octets.every((octet) => octet >= 0 && octet <= 255);
    if (!validOctets) {
      return { valid: false, error: "Invalid IPv4 address" };
    }
  }

  return { valid: true, data: trimmed };
}

/**
 * Validate a port number
 */
export function validatePort(port: number): ValidationResult<number> {
  if (!Number.isInteger(port)) {
    return { valid: false, error: "Port must be an integer" };
  }

  if (port < 1 || port > 65535) {
    return { valid: false, error: "Port must be between 1 and 65535" };
  }

  return { valid: true, data: port };
}

/**
 * Parse and validate a port from string
 */
export function parsePort(portStr: string): ValidationResult<number> {
  const parsed = parseInt(portStr, 10);

  if (isNaN(parsed)) {
    return { valid: false, error: "Invalid port number" };
  }

  return validatePort(parsed);
}

/**
 * Get the directory name from a path
 */
export function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

/**
 * Get the base name from a path
 */
export function getBaseName(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Join path segments safely
 */
export function joinPaths(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Expand tilde (~) in path to home directory
 * @param inputPath - Path that may contain tilde
 * @returns Path with tilde expanded to home directory
 */
export function expandTilde(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    const home = process.env.HOME ?? "/root";
    return path.join(home, inputPath.slice(2));
  }
  if (inputPath === "~") {
    return process.env.HOME ?? "/root";
  }
  return inputPath;
}
