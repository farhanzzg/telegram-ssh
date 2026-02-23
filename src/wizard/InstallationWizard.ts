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
import {
  fullSystemdSetup,
} from "../../scripts/systemd-service.js";
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
   * Placeholder patterns for detecting unconfigured values
   */
  private static readonly PLACEHOLDER_PATTERNS: Record<string, RegExp> = {
    BOT_TOKEN: /your_telegram_bot_token_here|^your_bot_token|^<[^>]+>$/i,
    BOT_CHAT_ID: /your_chat_id_here|^<[^>]+>$/i,
    ENCRYPTION_KEY: /^$|^<[^>]+>$/i,
  };

  /**
   * Check if the wizard should run
   * Returns true if .env file is missing or required variables are missing/placeholder
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
      const value = process.env[varName];
      
      // Check if missing
      if (!value) {
        return true;
      }
      
      // Check if it's a placeholder value
      const pattern = this.PLACEHOLDER_PATTERNS[varName];
      if (pattern && pattern.test(value)) {
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

      // Setup systemd service if requested
      if (config.systemd?.setup) {
        console.log("Setting up systemd service...");
        const systemdResult = fullSystemdSetup({
          enable: config.systemd.enable,
          start: config.systemd.start,
        });

        if (systemdResult.success) {
          console.log("✓ Systemd service setup complete!");
          console.log(`  Service: ${systemdResult.servicePath}`);
          console.log(`  Executable: ${systemdResult.execPath}`);
          if (systemdResult.enabled) {
            console.log("  Status: Enabled (will start on login)");
          }
          if (systemdResult.started) {
            console.log("  Status: Running");
          }
          console.log("");
          console.log("Commands:");
          console.log("  Start:   systemctl --user start telegram-ssh-bot");
          console.log("  Stop:    systemctl --user stop telegram-ssh-bot");
          console.log("  Status:  systemctl --user status telegram-ssh-bot");
          console.log("  Logs:    journalctl --user -u telegram-ssh-bot -f");
        } else {
          console.log(`✗ Systemd setup failed: ${systemdResult.message}`);
          console.log("  You can run the bot manually with: telegram-ssh-bot");
        }
        console.log("");
      } else {
        console.log("Starting application...");
        console.log("");
      }
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
