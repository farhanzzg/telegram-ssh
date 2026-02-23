#!/usr/bin/env node
/**
 * Systemd Service Management
 * Handles setup and updates of systemd user service for the bot
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

/**
 * Get the systemd user service directory
 */
export function getSystemdServiceDir() {
  return join(homedir(), ".config", "systemd", "user");
}

/**
 * Get the systemd service file path
 */
export function getSystemdServicePath() {
  return join(getSystemdServiceDir(), "telegram-ssh-bot.service");
}

/**
 * Get the config directory
 */
export function getConfigDir() {
  return join(homedir(), ".config", "telegram-ssh-bot");
}

/**
 * Get the executable path for the bot
 * This finds the actual path to the telegram-ssh-bot executable
 */
export function getExecutablePath() {
  try {
    // Try to find the executable using 'which'
    const result = execSync("which telegram-ssh-bot 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    
    if (result && existsSync(result)) {
      return result;
    }
  } catch {
    // Ignore errors
  }

  // Fallback paths to check
  const fallbackPaths = [
    join(homedir(), ".local", "bin", "telegram-ssh-bot"),
    "/usr/local/bin/telegram-ssh-bot",
    "/usr/bin/telegram-ssh-bot",
  ];

  for (const path of fallbackPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Try to find in pnpm global
  try {
    const pnpmGlobalDir = join(homedir(), ".local", "share", "pnpm", "global");
    if (existsSync(pnpmGlobalDir)) {
      const findResult = execSync(
        `find ${pnpmGlobalDir} -name "index.js" -path "*/telegram-ssh-bot/dist/index.js" 2>/dev/null | head -1`,
        { encoding: "utf-8" }
      ).trim();
      if (findResult && existsSync(findResult)) {
        return findResult;
      }
    }
  } catch {
    // Ignore
  }

  // Default fallback
  return join(homedir(), ".local", "bin", "telegram-ssh-bot");
}

/**
 * Generate systemd service file content
 */
export function generateServiceFile(execPath) {
  const configDir = getConfigDir();
  
  return `[Unit]
Description=Telegram SSH Bot - Remote server management via Telegram
Documentation=https://github.com/farhanzzg/telegram-ssh
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execPath}
WorkingDirectory=${configDir}
Restart=on-failure
RestartSec=10
TimeoutStartSec=30
TimeoutStopSec=30

# Environment
EnvironmentFile=${configDir}/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${configDir}
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=telegram-ssh-bot

[Install]
WantedBy=default.target
`;
}

/**
 * Check if systemd service is installed
 */
export function isSystemdServiceInstalled() {
  return existsSync(getSystemdServicePath());
}

/**
 * Check if systemd service is running
 */
export function isSystemdServiceRunning() {
  try {
    const result = execSync("systemctl --user is-active telegram-ssh-bot 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    return result === "active";
  } catch {
    return false;
  }
}

/**
 * Check if systemd service is enabled
 */
export function isSystemdServiceEnabled() {
  try {
    const result = execSync("systemctl --user is-enabled telegram-ssh-bot 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    return result === "enabled";
  } catch {
    return false;
  }
}

/**
 * Setup systemd service
 */
export function setupSystemdService(execPath) {
  const result = {
    success: false,
    servicePath: getSystemdServicePath(),
    execPath: execPath || getExecutablePath(),
    message: "",
    wasRunning: false,
  };

  try {
    // Check if service was running before update
    result.wasRunning = isSystemdServiceRunning();

    // Create systemd directory if it doesn't exist
    const serviceDir = getSystemdServiceDir();
    if (!existsSync(serviceDir)) {
      mkdirSync(serviceDir, { recursive: true });
    }

    // Generate and write service file
    const serviceContent = generateServiceFile(result.execPath);
    writeFileSync(result.servicePath, serviceContent, "utf-8");

    // Reload systemd daemon
    execSync("systemctl --user daemon-reload", { encoding: "utf-8" });

    result.success = true;
    result.message = `Systemd service installed at ${result.servicePath}`;
    
    return result;
  } catch (error) {
    result.message = `Failed to setup systemd service: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}

/**
 * Enable systemd service
 */
export function enableSystemdService() {
  try {
    execSync("systemctl --user enable telegram-ssh-bot", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start systemd service
 */
export function startSystemdService() {
  try {
    execSync("systemctl --user start telegram-ssh-bot", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restart systemd service
 */
export function restartSystemdService() {
  try {
    execSync("systemctl --user restart telegram-ssh-bot", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop systemd service
 */
export function stopSystemdService() {
  try {
    execSync("systemctl --user stop telegram-ssh-bot", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Disable systemd service
 */
export function disableSystemdService() {
  try {
    execSync("systemctl --user disable telegram-ssh-bot", { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get systemd service status
 */
export function getSystemdServiceStatus() {
  const servicePath = getSystemdServicePath();
  let execPath = null;

  // Try to read ExecStart from service file
  if (existsSync(servicePath)) {
    try {
      const content = readFileSync(servicePath, "utf-8");
      const match = content.match(/ExecStart=(.+)/);
      if (match && match[1]) {
        execPath = match[1].trim();
      }
    } catch {
      // Ignore
    }
  }

  return {
    installed: existsSync(servicePath),
    running: isSystemdServiceRunning(),
    enabled: isSystemdServiceEnabled(),
    servicePath,
    execPath,
  };
}

/**
 * Update systemd service with new executable path
 * This is called after npm/pnpm update to ensure the service points to the correct path
 */
export function updateSystemdService() {
  const wasRunning = isSystemdServiceRunning();
  const result = setupSystemdService();

  if (result.success && wasRunning) {
    // If service was running before update, restart it
    restartSystemdService();
    result.message += "\nService restarted (was running before update).";
  }

  return result;
}

/**
 * Full systemd setup with optional auto-start
 */
export function fullSystemdSetup(options = {}) {
  const { enable = true, start = false, execPath } = options;
  
  const setupResult = setupSystemdService(execPath);
  
  if (!setupResult.success) {
    return {
      success: false,
      message: setupResult.message,
      servicePath: setupResult.servicePath,
      execPath: setupResult.execPath,
      enabled: false,
      started: false,
    };
  }

  let enabled = false;
  let started = false;

  if (enable) {
    enabled = enableSystemdService();
    if (!enabled) {
      return {
        success: false,
        message: "Service installed but failed to enable.",
        servicePath: setupResult.servicePath,
        execPath: setupResult.execPath,
        enabled: false,
        started: false,
      };
    }
  }

  if (start) {
    started = startSystemdService();
  }

  return {
    success: true,
    message: `Systemd service setup complete. Enabled: ${enabled}, Started: ${started}`,
    servicePath: setupResult.servicePath,
    execPath: setupResult.execPath,
    enabled,
    started,
  };
}

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "setup":
    case "install": {
      const result = fullSystemdSetup({ enable: true, start: false });
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    }
    case "update": {
      const result = updateSystemdService();
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    }
    case "status": {
      const status = getSystemdServiceStatus();
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    }
    case "start": {
      const success = startSystemdService();
      console.log(success ? "Service started" : "Failed to start service");
      process.exit(success ? 0 : 1);
    }
    case "stop": {
      const success = stopSystemdService();
      console.log(success ? "Service stopped" : "Failed to stop service");
      process.exit(success ? 0 : 1);
    }
    case "restart": {
      const success = restartSystemdService();
      console.log(success ? "Service restarted" : "Failed to restart service");
      process.exit(success ? 0 : 1);
    }
    case "enable": {
      const success = enableSystemdService();
      console.log(success ? "Service enabled" : "Failed to enable service");
      process.exit(success ? 0 : 1);
    }
    case "disable": {
      const success = disableSystemdService();
      console.log(success ? "Service disabled" : "Failed to disable service");
      process.exit(success ? 0 : 1);
    }
    default:
      console.log(`
Telegram SSH Bot - Systemd Service Management

Commands:
  setup, install  - Install and enable the systemd service
  update          - Update service with new executable path (use after npm update)
  status          - Show service status
  start           - Start the service
  stop            - Stop the service
  restart         - Restart the service
  enable          - Enable the service (auto-start on login)
  disable         - Disable the service

Service file: ${getSystemdServicePath()}
Config dir:   ${getConfigDir()}
`);
      process.exit(0);
  }
}
