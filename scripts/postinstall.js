#!/usr/bin/env node
/**
 * Post-install script for npm/pnpm global installation
 * Sets up the .env configuration file if it doesn't exist
 * Updates systemd service if installed
 */

import { envFileExists, main } from "./setup-env.js";
import {
  isSystemdServiceInstalled,
  updateSystemdService,
  getSystemdServiceStatus,
} from "./systemd-service.js";

/**
 * Check if this is a global installation
 * @returns {boolean} True if running as a global install
 */
function isGlobalInstall() {
  // Check various npm config indicators for global install
  const npmConfigGlobal = process.env.npm_config_global;

  // npm_config_global is 'true' when installed with -g flag
  if (npmConfigGlobal === "true") {
    return true;
  }

  // Check if we're in a global node_modules directory
  // This is a heuristic that works for most cases
  const cwd = process.cwd();
  if (
    cwd.includes("node_modules") &&
    (cwd.includes("/usr/local") ||
      cwd.includes("/usr/lib") ||
      cwd.includes("/lib/node_modules") ||
      cwd.includes(".npm-global") ||
      cwd.includes(".pnpm-global") ||
      cwd.includes("pnpm/global"))
  ) {
    return true;
  }

  // Check for pnpm global install
  if (
    process.env.npm_config_user_agent &&
    process.env.npm_config_user_agent.includes("pnpm")
  ) {
    // pnpm sets different paths for global installs
    if (cwd.includes("pnpm-global") || cwd.includes(".pnpm-global") || cwd.includes("pnpm/global")) {
      return true;
    }
  }

  return false;
}

/**
 * Run the postinstall script
 */
function runPostinstall() {
  // Only run for global installations
  if (!isGlobalInstall()) {
    console.log("Local installation detected. Skipping setup.");
    console.log(
      "For global installation, the .env file would be created at ~/.config/telegram-ssh-bot/.env",
    );
    return;
  }

  console.log("Global installation detected. Setting up configuration...");

  // Check if .env already exists
  if (envFileExists()) {
    console.log("Configuration file already exists. Skipping setup.");
    console.log("Configuration location: ~/.config/telegram-ssh-bot/.env");
  } else {
    // Run the main setup function
    const result = main({ generateKey: true, silent: false });

    if (result.success) {
      console.log("\nConfiguration setup complete!");
      console.log(
        'Run "telegram-ssh-bot" to start the bot after configuring your credentials.',
      );
    } else {
      console.error("Configuration setup failed:", result.message);
    }
  }

  // Update systemd service if installed
  console.log("");
  if (isSystemdServiceInstalled()) {
    console.log("Updating systemd service...");
    const result = updateSystemdService();
    if (result.success) {
      console.log("✓ Systemd service updated successfully!");
      console.log(`  Executable: ${result.execPath}`);
      if (result.wasRunning) {
        console.log("  Service was running and has been restarted.");
      }
    } else {
      console.log(`✗ Failed to update systemd service: ${result.message}`);
    }
  } else {
    console.log("Systemd service not installed.");
    console.log("To setup systemd service, run: telegram-ssh-bot-systemd setup");
  }
}

// Run the postinstall script
runPostinstall();
