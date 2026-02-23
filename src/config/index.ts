/**
 * Configuration loader module with hot reload support
 */

import "dotenv/config";
import { EventEmitter } from "events";
import { existsSync, watch } from "fs";
import * as path from "path";
import { InvalidConfigError, MissingConfigError } from "../errors/index.js";
import type { AppConfig, RateLimitConfig } from "../types/index.js";
import { configSchema } from "./schema.js";

/**
 * Configuration reload event
 */
export interface ConfigReloadEvent {
  oldConfig: AppConfig;
  newConfig: AppConfig;
  changedKeys: string[];
  timestamp: Date;
}

/**
 * Configuration reloader for hot reload support
 */
export class ConfigReloader extends EventEmitter {
  private currentConfig: AppConfig;
  private readonly envPath: string;
  private watcher: ReturnType<typeof watch> | null = null;
  private reloadDebounce: NodeJS.Timeout | null = null;
  private isReloading = false;

  constructor(initialConfig: AppConfig, envPath?: string) {
    super();
    this.currentConfig = initialConfig;
    this.envPath = envPath ?? path.resolve(process.cwd(), ".env");
  }

  /**
   * Start watching for configuration changes
   */
  startWatching(): void {
    if (this.watcher) {
      return;
    }

    // Check if .env file exists
    if (!existsSync(this.envPath)) {
      return;
    }

    this.watcher = watch(this.envPath, (eventType) => {
      if (eventType === "change") {
        this.scheduleReload();
      }
    });

    this.watcher.on("error", (error) => {
      this.emit("error", error);
    });
  }

  /**
   * Stop watching for configuration changes
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.reloadDebounce) {
      clearTimeout(this.reloadDebounce);
      this.reloadDebounce = null;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return this.currentConfig;
  }

  /**
   * Schedule a configuration reload (debounced)
   */
  private scheduleReload(): void {
    if (this.reloadDebounce) {
      clearTimeout(this.reloadDebounce);
    }

    this.reloadDebounce = setTimeout(() => {
      this.reload();
    }, 1000); // 1 second debounce
  }

  /**
   * Reload configuration from environment
   */
  async reload(): Promise<boolean> {
    if (this.isReloading) {
      return false;
    }

    this.isReloading = true;

    try {
      // Re-read .env file
      const result = await this.loadEnvFile();
      if (!result.success) {
        this.emit("error", new Error(`Failed to reload .env: ${result.error}`));
        return false;
      }

      // Load new configuration
      const newConfig = await loadConfig();
      const changedKeys = this.findChangedKeys(this.currentConfig, newConfig);

      if (changedKeys.length === 0) {
        return false;
      }

      const event: ConfigReloadEvent = {
        oldConfig: this.currentConfig,
        newConfig,
        changedKeys,
        timestamp: new Date(),
      };

      this.currentConfig = newConfig;
      this.emit("reload", event);

      return true;
    } catch (error) {
      this.emit(
        "error",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * Load .env file manually
   */
  private async loadEnvFile(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!existsSync(this.envPath)) {
        return { success: false, error: ".env file not found" };
      }

      // Re-import dotenv to reload
      // Note: This is a simplified approach; in production you might want
      // to manually parse the .env file and update process.env
      const { config } = await import("dotenv");
      config({ path: this.envPath, override: true });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Find changed keys between two configurations
   */
  private findChangedKeys(old: AppConfig, new_: AppConfig): string[] {
    const changed: string[] = [];

    // Compare telegram config
    if (old.telegram.token !== new_.telegram.token)
      changed.push("telegram.token");
    if (old.telegram.chatId !== new_.telegram.chatId)
      changed.push("telegram.chatId");
    if (
      JSON.stringify(old.telegram.ownerIds) !==
      JSON.stringify(new_.telegram.ownerIds)
    ) {
      changed.push("telegram.ownerIds");
    }

    // Compare security config
    if (old.security.encryptionKey !== new_.security.encryptionKey) {
      changed.push("security.encryptionKey");
    }
    if (old.security.rateLimit.enabled !== new_.security.rateLimit.enabled) {
      changed.push("security.rateLimit.enabled");
    }
    if (
      old.security.rateLimit.maxRequests !== new_.security.rateLimit.maxRequests
    ) {
      changed.push("security.rateLimit.maxRequests");
    }

    // Compare logging config
    if (old.logging.level !== new_.logging.level) changed.push("logging.level");

    return changed;
  }
}

/**
 * Get required environment variable or throw error
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new MissingConfigError(key);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Parse comma-separated string to array
 */
function parseArray(
  value: string | undefined,
  defaultValue: string[],
): string[] {
  if (!value) {
    return defaultValue;
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse boolean from string
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Parse number from string
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load and validate configuration from environment
 */
export async function loadConfig(): Promise<AppConfig> {
  // Build config from environment variables
  const envConfig = {
    telegram: {
      token: getRequiredEnv("BOT_TOKEN"),
      chatId: getRequiredEnv("BOT_CHAT_ID"),
      ownerIds: parseArray(process.env.BOT_OWNER_IDS, []),
      polling: parseBoolean(process.env.BOT_POLLING, true),
    },
    security: {
      encryptionKey: getRequiredEnv("ENCRYPTION_KEY"),
      rateLimit: {
        enabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
        windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
        maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 30),
        skipFailedRequests: parseBoolean(
          process.env.RATE_LIMIT_SKIP_FAILED,
          false,
        ),
      } satisfies RateLimitConfig,
      allowedCommands: parseArray(process.env.ALLOWED_COMMANDS, []),
      blockedCommands: parseArray(process.env.BLOCKED_COMMANDS, []),
    },
    ssh: {
      defaultPrivateKeyPath: getOptionalEnv(
        "SSH_DEFAULT_PRIVATE_KEY_PATH",
        `${process.env.HOME ?? "/root"}/.ssh/id_rsa`,
      ),
      connectionTimeout: parseNumber(process.env.SSH_CONNECTION_TIMEOUT, 30000),
      keepaliveInterval: parseNumber(process.env.SSH_KEEPALIVE_INTERVAL, 10000),
      maxConnections: parseNumber(process.env.SSH_MAX_CONNECTIONS, 5),
      commandTimeout: parseNumber(process.env.SSH_COMMAND_TIMEOUT, 60000),
    },
    logging: {
      level: getOptionalEnv("LOG_LEVEL", "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",
      format: getOptionalEnv("LOG_FORMAT", "json") as "json" | "pretty",
      file: process.env.LOG_FILE,
    },
    storage: {
      serversFile: getOptionalEnv(
        "STORAGE_SERVERS_FILE",
        "./conf/servers.json",
      ),
      encryptionEnabled: parseBoolean(
        process.env.STORAGE_ENCRYPTION_ENABLED,
        true,
      ),
    },
  };

  // Validate configuration
  const { error, value } = configSchema.validate(envConfig, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    const messages = error.details.map((d) => d.message).join(", ");
    throw new InvalidConfigError(
      `Configuration validation failed: ${messages}`,
    );
  }

  return value;
}

/**
 * Validate that owner IDs are configured
 */
export function validateOwnerIds(config: AppConfig): void {
  if (config.telegram.ownerIds.length === 0) {
    throw new InvalidConfigError(
      "At least one owner ID must be configured via BOT_OWNER_IDS",
    );
  }
}
