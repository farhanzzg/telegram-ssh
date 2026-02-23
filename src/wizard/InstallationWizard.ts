/**
 * Installation Wizard - Main wizard class
 * Orchestrates the interactive configuration setup process
 */

import { existsSync } from "fs";
import {
  generateEncryptionKey,
  getEnvFilePath,
  writeEnvFile,
} from "../../scripts/setup-env.js";
import { displaySummary, promptConfirmation, runPrompts } from "./prompts.js";

/**
 * Installation wizard class
 * Handles the interactive setup process for first-time configuration
 */
export class InstallationWizard {
  private readonly envPath: string;

  constructor() {
    this.envPath = getEnvFilePath();
  }

  /**
   * Check if the wizard should run
   * Returns true if .env file is missing or required variables are missing
   */
  static shouldRun(): boolean {
    const envPath = getEnvFilePath();

    // If .env file doesn't exist, wizard should run
    if (!existsSync(envPath)) {
      return true;
    }

    // Check for required environment variables
    const requiredVars = ["BOT_TOKEN", "BOT_CHAT_ID", "ENCRYPTION_KEY"];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Run the installation wizard
   * Guides user through configuration and creates .env file
   */
  async run(): Promise<void> {
    try {
      // Collect configuration from user
      const config = await runPrompts(generateEncryptionKey);

      // Display summary
      displaySummary(config, this.envPath);

      // Confirm and save
      const confirmed = await promptConfirmation();

      if (!confirmed) {
        console.log("");
        console.log("Configuration not saved. Running wizard again...");
        console.log("");
        // Run wizard again
        await this.run();
        return;
      }

      // Write the .env file
      await this.saveConfiguration(config);

      console.log("");
      console.log("✓ Configuration saved successfully!");
      console.log(`  File: ${this.envPath}`);
      console.log("");
      console.log("Starting application...");
      console.log("");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "User cancelled the wizard") {
          console.log("");
          console.log("Wizard cancelled. Exiting...");
          process.exit(0);
        }
        throw error;
      }
      throw new Error("Wizard failed with unknown error");
    }
  }

  /**
   * Save the configuration to .env file
   */
  private async saveConfiguration(config: {
    botToken: string;
    botChatId: string;
    botOwnerIds: string[];
    encryptionKey: string;
  }): Promise<void> {
    writeEnvFile({
      botToken: config.botToken,
      botChatId: config.botChatId,
      botOwnerIds: config.botOwnerIds,
      encryptionKey: config.encryptionKey,
    });
  }
}

/**
 * Check if the installation wizard should run
 * Convenience function for external use
 */
export function shouldRunWizard(): boolean {
  return InstallationWizard.shouldRun();
}
