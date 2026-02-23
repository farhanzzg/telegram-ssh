/**
 * Interactive prompt definitions for the installation wizard
 */

import prompts from "prompts";
import {
  validateBotToken,
  validateChatId,
  validateOwnerIds,
  validateEncryptionKey,
} from "./validators.js";

/**
 * Wizard configuration values collected from user
 */
export interface WizardConfig {
  botToken: string;
  botChatId: string;
  botOwnerIds: string[];
  encryptionKey: string;
}

/**
 * Encryption key choice options
 */
type EncryptionKeyChoice = "generate" | "manual";

/**
 * Display the welcome banner
 */
export function displayWelcomeBanner(): void {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     Telegram SSH Bot - Installation Wizard                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Welcome! This wizard will help you set up your bot configuration.");
  console.log("Press Ctrl+C at any time to exit.");
  console.log("");
}

/**
 * Display a summary of the collected configuration
 */
export function displaySummary(config: WizardConfig, envPath: string): void {
  console.log("");
  console.log("─────────────────────────────────────────────");
  console.log("Configuration Summary:");
  console.log("─────────────────────────────────────────────");
  console.log(`  BOT_TOKEN:        ${maskToken(config.botToken)}`);
  console.log(`  BOT_CHAT_ID:      ${config.botChatId}`);
  console.log(
    `  BOT_OWNER_IDS:    ${config.botOwnerIds.length > 0 ? config.botOwnerIds.join(", ") : "(none)"}`,
  );
  console.log(`  ENCRYPTION_KEY:   ${maskEncryptionKey(config.encryptionKey)}`);
  console.log("─────────────────────────────────────────────");
  console.log(`Config location: ${envPath}`);
  console.log("");
}

/**
 * Mask a bot token for display (show first 10 chars and last 4)
 */
function maskToken(token: string): string {
  if (token.length <= 14) {
    return token.substring(0, 4) + "...";
  }
  return token.substring(0, 10) + "..." + token.substring(token.length - 4);
}

/**
 * Mask an encryption key for display
 */
function maskEncryptionKey(key: string): string {
  if (key.length <= 16) {
    return "[hidden]";
  }
  return key.substring(0, 8) + "..." + key.substring(key.length - 8);
}

/**
 * Prompt for bot token with validation
 */
export async function promptBotToken(): Promise<string> {
  const response = await prompts({
    type: "password",
    name: "token",
    message: "Enter your Telegram Bot Token",
    hint: "Get this from @BotFather on Telegram",
    validate: (value: string) => {
      const result = validateBotToken(value);
      return result.valid ? true : result.error || "Invalid token";
    },
  });

  if (response.token === undefined) {
    throw new Error("User cancelled the wizard");
  }

  return response.token.trim();
}

/**
 * Prompt for chat ID with validation
 */
export async function promptChatId(): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "chatId",
    message: "Enter your Chat ID",
    hint: "Use @userinfobot to find your Chat ID",
    validate: (value: string) => {
      const result = validateChatId(value);
      return result.valid ? true : result.error || "Invalid chat ID";
    },
  });

  if (response.chatId === undefined) {
    throw new Error("User cancelled the wizard");
  }

  return response.chatId.trim();
}

/**
 * Prompt for owner IDs (optional)
 */
export async function promptOwnerIds(): Promise<string[]> {
  const response = await prompts({
    type: "text",
    name: "ownerIds",
    message: "Enter Owner IDs (comma-separated, optional)",
    hint: "These users will have full bot access. Press Enter to skip.",
    validate: (value: string) => {
      const result = validateOwnerIds(value);
      return result.valid ? true : result.error || "Invalid owner IDs";
    },
  });

  if (response.ownerIds === undefined) {
    throw new Error("User cancelled the wizard");
  }

  const trimmed = response.ownerIds.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0);
}

/**
 * Prompt for encryption key choice and value
 */
export async function promptEncryptionKey(
  generateKey: () => string,
): Promise<string> {
  // First, ask if user wants to auto-generate or enter manually
  const choiceResponse = await prompts({
    type: "select",
    name: "choice",
    message: "Encryption Key",
    choices: [
      {
        title: "Auto-generate a secure key (recommended)",
        value: "generate",
      },
      {
        title: "Enter my own key",
        value: "manual",
      },
    ],
    initial: 0,
  });

  if (choiceResponse.choice === undefined) {
    throw new Error("User cancelled the wizard");
  }

  const choice = choiceResponse.choice as EncryptionKeyChoice;

  if (choice === "generate") {
    const key = generateKey();
    console.log(`  Generated key: ${key}`);
    return key;
  }

  // Manual entry
  const keyResponse = await prompts({
    type: "password",
    name: "key",
    message: "Enter your encryption key",
    hint: "Must be exactly 64 hex characters (32 bytes)",
    validate: (value: string) => {
      const result = validateEncryptionKey(value);
      return result.valid ? true : result.error || "Invalid encryption key";
    },
  });

  if (keyResponse.key === undefined) {
    throw new Error("User cancelled the wizard");
  }

  return keyResponse.key.trim();
}

/**
 * Prompt for confirmation to save configuration
 */
export async function promptConfirmation(): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Save this configuration?",
    initial: true,
  });

  if (response.confirm === undefined) {
    throw new Error("User cancelled the wizard");
  }

  return response.confirm;
}

/**
 * Run all prompts to collect wizard configuration
 */
export async function runPrompts(generateKey: () => string): Promise<WizardConfig> {
  displayWelcomeBanner();

  const botToken = await promptBotToken();
  const botChatId = await promptChatId();
  const botOwnerIds = await promptOwnerIds();
  const encryptionKey = await promptEncryptionKey(generateKey);

  return {
    botToken,
    botChatId,
    botOwnerIds,
    encryptionKey,
  };
}
