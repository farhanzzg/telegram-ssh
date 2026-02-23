#!/usr/bin/env node
/**
 * Shared utility for setting up the .env configuration file
 * Used by both install.sh and postinstall.js
 */

import { randomBytes } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Get the configuration directory path
 * @returns {string} The configuration directory path
 */
export function getConfigDir() {
  return join(homedir(), ".config", "telegram-ssh-bot");
}

/**
 * Get the .env file path
 * @returns {string} The .env file path
 */
export function getEnvFilePath() {
  return join(getConfigDir(), ".env");
}

/**
 * Get the .env.example file path
 * This file can be in different locations depending on the installation method
 * @returns {string|null} The .env.example file path or null if not found
 */
export function getEnvExamplePath() {
  const possiblePaths = [
    // For npm/pnpm global install
    join(
      new URL(".", import.meta.url).pathname,
      "..",
      "deploy",
      ".env.example",
    ),
    // For binary installation (running from project root)
    join(process.cwd(), "deploy", ".env.example"),
    // For development
    join(
      new URL(".", import.meta.url).pathname,
      "..",
      "..",
      "deploy",
      ".env.example",
    ),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Ensure the configuration directory exists
 * @returns {string} The configuration directory path
 */
export function ensureConfigDir() {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    console.log(`Created configuration directory: ${configDir}`);
  }
  return configDir;
}

/**
 * Generate a secure random encryption key
 * Generates a 64-character hex string (32 bytes)
 * @returns {string} The generated encryption key
 */
export function generateEncryptionKey() {
  return randomBytes(32).toString("hex");
}

/**
 * Check if the .env file already exists
 * @returns {boolean} True if the file exists
 */
export function envFileExists() {
  return existsSync(getEnvFilePath());
}

/**
 * Create the .env file from the template
 * @param {Object} options - Options for creating the .env file
 * @param {boolean} options.generateKey - Whether to generate a new encryption key
 * @returns {boolean} True if the file was created successfully
 */
export function createEnvFile(options = { generateKey: true }) {
  const envPath = getEnvFilePath();
  const examplePath = getEnvExamplePath();

  if (!examplePath) {
    console.warn(
      "Warning: .env.example not found. Creating minimal .env file.",
    );
    const encryptionKey = options.generateKey ? generateEncryptionKey() : "";
    const minimalEnv = `# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
BOT_CHAT_ID=your_chat_id_here
BOT_OWNER_IDS=123456789,987654321

# Security
ENCRYPTION_KEY=${encryptionKey}

# SSH Configuration
SSH_DEFAULT_PORT=22
SSH_CONNECTION_TIMEOUT=30000
SSH_COMMAND_TIMEOUT=30000
SSH_DEFAULT_PRIVATE_KEY_PATH=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL_MS=3600000
BACKUP_MAX_COUNT=10

# Monitoring
MONITORING_ENABLED=true
MONITORING_INTERVAL_MS=300000
`;
    writeFileSync(envPath, minimalEnv);
    console.log(`Created minimal .env file at: ${envPath}`);
    return true;
  }

  // Copy the example file
  copyFileSync(examplePath, envPath);
  console.log(`Created .env file from template at: ${envPath}`);

  // Generate and set encryption key if requested
  if (options.generateKey) {
    const encryptionKey = generateEncryptionKey();
    let envContent = readFileSync(envPath, "utf-8");

    // Replace the ENCRYPTION_KEY line with the generated key
    envContent = envContent.replace(
      /^ENCRYPTION_KEY=.*$/m,
      `ENCRYPTION_KEY=${encryptionKey}`,
    );

    writeFileSync(envPath, envContent);
    console.log("Generated secure encryption key");
  }

  return true;
}

/**
 * Write a .env file with specific values
 * Used by the installation wizard
 * @param {Object} values - Configuration values
 * @param {string} values.botToken - Telegram bot token
 * @param {string} values.botChatId - Telegram chat ID
 * @param {string[]} values.botOwnerIds - Array of owner IDs
 * @param {string} values.encryptionKey - Encryption key (64 hex chars)
 * @returns {boolean} True if the file was written successfully
 */
export function writeEnvFile(values) {
  const { botToken, botChatId, botOwnerIds, encryptionKey } = values;

  // Ensure config directory exists
  ensureConfigDir();

  const envPath = getEnvFilePath();

  // Build .env content
  const envContent = `# Telegram Bot Configuration
BOT_TOKEN=${botToken}
BOT_CHAT_ID=${botChatId}
BOT_OWNER_IDS=${botOwnerIds.join(",")}

# Security
ENCRYPTION_KEY=${encryptionKey}

# SSH Configuration
SSH_DEFAULT_PORT=22
SSH_CONNECTION_TIMEOUT=30000
SSH_COMMAND_TIMEOUT=30000
SSH_DEFAULT_PRIVATE_KEY_PATH=

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL_MS=3600000
BACKUP_MAX_COUNT=10

# Monitoring
MONITORING_ENABLED=true
MONITORING_INTERVAL_MS=300000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
`;

  writeFileSync(envPath, envContent);
  return true;
}

/**
 * Main function to set up the environment
 * @param {Object} options - Setup options
 * @param {boolean} options.force - Force overwrite existing .env file
 * @param {boolean} options.generateKey - Generate a new encryption key
 * @param {boolean} options.silent - Suppress output messages
 * @returns {Object} Result object with success status and messages
 */
export function main(options = {}) {
  const { force = false, generateKey = true, silent = false } = options;

  const result = {
    success: false,
    created: false,
    envPath: getEnvFilePath(),
    configDir: getConfigDir(),
    message: "",
  };

  try {
    // Check if .env already exists
    if (envFileExists() && !force) {
      result.message = `.env file already exists at ${result.envPath}`;
      result.success = true;
      if (!silent) {
        console.log(result.message);
      }
      return result;
    }

    // Ensure config directory exists
    ensureConfigDir();

    // Create the .env file
    createEnvFile({ generateKey });
    result.created = true;
    result.success = true;
    result.message = `Created .env file at ${result.envPath}`;

    if (!silent) {
      console.log("");
      console.log("=".repeat(60));
      console.log("Telegram SSH Bot - Configuration Setup");
      console.log("=".repeat(60));
      console.log(`Configuration file created at: ${result.envPath}`);
      console.log("");
      console.log(
        "IMPORTANT: Please edit the .env file and fill in the required values:",
      );
      console.log("  - BOT_TOKEN: Your Telegram bot token");
      console.log("  - BOT_CHAT_ID: Your Telegram chat ID");
      console.log("  - BOT_OWNER_IDS: Comma-separated list of owner user IDs");
      console.log("");
      console.log("A secure ENCRYPTION_KEY has been generated for you.");
      console.log("=".repeat(60));
    }

    return result;
  } catch (error) {
    result.message = `Error setting up .env file: ${error.message}`;
    if (!silent) {
      console.error(result.message);
    }
    return result;
  }
}

// Run main if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
