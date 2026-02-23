/**
 * Input validation functions for the installation wizard
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate Telegram bot token format
 * Expected format: \d+:[A-Za-z0-9_-]+
 * Example: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 *
 * @param token - The bot token to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateBotToken(token: string): ValidationResult {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: "Bot token is required" };
  }

  const trimmed = token.trim();

  // Telegram bot token format: number:alphanumeric_chars
  const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;

  if (!tokenRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Invalid token format. Expected format: 123456789:ABCdefGHI...",
    };
  }

  return { valid: true };
}

/**
 * Validate Telegram chat ID
 * Must be a numeric string (can be negative for groups/channels)
 *
 * @param chatId - The chat ID to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateChatId(chatId: string): ValidationResult {
  if (!chatId || chatId.trim().length === 0) {
    return { valid: false, error: "Chat ID is required" };
  }

  const trimmed = chatId.trim();

  // Chat ID must be numeric (can be negative for groups/channels)
  if (!/^-?\d+$/.test(trimmed)) {
    return { valid: false, error: "Chat ID must be a number" };
  }

  return { valid: true };
}

/**
 * Validate owner IDs (comma-separated list of numeric IDs)
 *
 * @param ownerIds - Comma-separated owner IDs to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateOwnerIds(ownerIds: string): ValidationResult {
  if (!ownerIds || ownerIds.trim().length === 0) {
    // Owner IDs are optional - empty is valid
    return { valid: true };
  }

  const trimmed = ownerIds.trim();
  const ids = trimmed.split(",").map((id) => id.trim());

  for (const id of ids) {
    if (id.length === 0) {
      continue;
    }
    if (!/^\d+$/.test(id)) {
      return {
        valid: false,
        error: "Owner IDs must be numbers separated by commas",
      };
    }
  }

  return { valid: true };
}

/**
 * Validate encryption key
 * Must be a 64-character hex string
 *
 * @param key - The encryption key to validate
 * @returns ValidationResult indicating success or failure with error message
 */
export function validateEncryptionKey(key: string): ValidationResult {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "Encryption key is required" };
  }

  const trimmed = key.trim();

  // Must be exactly 64 hex characters (32 bytes)
  if (!/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return {
      valid: false,
      error: "Encryption key must be exactly 64 hex characters",
    };
  }

  return { valid: true };
}

/**
 * Parse owner IDs string into array
 *
 * @param ownerIds - Comma-separated owner IDs
 * @returns Array of owner ID strings
 */
export function parseOwnerIds(ownerIds: string): string[] {
  if (!ownerIds || ownerIds.trim().length === 0) {
    return [];
  }

  return ownerIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}
