#!/usr/bin/env node
/**
 * Post-install script for npm/pnpm global installation
 * Sets up the .env configuration file if it doesn't exist
 */

import { envFileExists, main } from "./setup-env.js";

/**
 * Check if this is a global installation
 * @returns {boolean} True if running as a global install
 */
function isGlobalInstall() {
  // Check various npm config indicators for global install
  const npmConfigGlobal = process.env.npm_config_global;
  const npmPackageConfig = process.env.npm_package_config;

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
      cwd.includes(".pnpm-global"))
  ) {
    return true;
  }

  // Check for pnpm global install
  if (
    process.env.npm_config_user_agent &&
    process.env.npm_config_user_agent.includes("pnpm")
  ) {
    // pnpm sets different paths for global installs
    if (cwd.includes("pnpm-global") || cwd.includes(".pnpm-global")) {
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
    console.log("Local installation detected. Skipping .env setup.");
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
    return;
  }

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

// Run the postinstall script
runPostinstall();
