/**
 * Notification Service
 * Provides admin notifications for important events
 */

import { LoggingService } from "./LoggingService.js";
import type { IBot, LogContext, Server } from "../types/index.js";

/**
 * Notification types
 */
export type NotificationType =
  | "startup"
  | "shutdown"
  | "error"
  | "security"
  | "server_added"
  | "server_removed"
  | "connection_lost"
  | "connection_restored"
  | "backup_created"
  | "backup_restored"
  | "config_reloaded"
  | "rate_limited"
  | "unauthorized_access";

/**
 * Notification priority
 */
export type NotificationPriority = "low" | "normal" | "high" | "critical";

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  notifyOnStartup: boolean;
  notifyOnShutdown: boolean;
  notifyOnErrors: boolean;
  notifyOnSecurity: boolean;
  adminChatId: string;
}

/**
 * Service for sending admin notifications
 */
export class NotificationService {
  private readonly logger: LoggingService;
  private readonly config: NotificationConfig;
  private bot: IBot | null = null;
  private notificationCount = 0;
  private readonly startTime: Date;

  constructor(config: Partial<NotificationConfig>, logger: LoggingService) {
    this.config = {
      enabled: config.enabled ?? true,
      notifyOnStartup: config.notifyOnStartup ?? true,
      notifyOnShutdown: config.notifyOnShutdown ?? true,
      notifyOnErrors: config.notifyOnErrors ?? true,
      notifyOnSecurity: config.notifyOnSecurity ?? true,
      adminChatId: config.adminChatId ?? "",
    };
    this.logger = logger;
    this.startTime = new Date();
  }

  /**
   * Set the bot instance for sending messages
   */
  setBot(bot: IBot): void {
    this.bot = bot;
  }

  /**
   * Send a notification
   */
  async notify(payload: Omit<NotificationPayload, "timestamp">): Promise<boolean> {
    if (!this.config.enabled || !this.bot || !this.config.adminChatId) {
      this.logger.debug("Notification skipped", {
        enabled: this.config.enabled,
        hasBot: !!this.bot,
        hasChatId: !!this.config.adminChatId,
      });
      return false;
    }

    const fullPayload: NotificationPayload = {
      ...payload,
      timestamp: new Date(),
    };

    try {
      const message = this.formatNotification(fullPayload);
      await this.bot.sendMessage(
        parseInt(this.config.adminChatId, 10),
        message,
        { parseMode: "Markdown" },
      );

      this.notificationCount++;
      this.logger.debug("Notification sent", {
        type: payload.type,
        priority: payload.priority,
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to send notification", error as Error, {
        type: payload.type,
      });
      return false;
    }
  }

  /**
   * Send startup notification
   */
  async notifyStartup(version: string): Promise<boolean> {
    if (!this.config.notifyOnStartup) {
      return false;
    }

    return this.notify({
      type: "startup",
      priority: "normal",
      title: "🚀 Bot Started",
      message: `Telegram SSH Bot has started successfully.\n\nVersion: ${version}\nStarted at: ${this.startTime.toISOString()}`,
    });
  }

  /**
   * Send shutdown notification
   */
  async notifyShutdown(reason: string): Promise<boolean> {
    if (!this.config.notifyOnShutdown) {
      return false;
    }

    const uptime = Math.floor(
      (Date.now() - this.startTime.getTime()) / 1000,
    );

    return this.notify({
      type: "shutdown",
      priority: "high",
      title: "🛑 Bot Shutting Down",
      message: `Telegram SSH Bot is shutting down.\n\nReason: ${reason}\nUptime: ${this.formatUptime(uptime)}`,
    });
  }

  /**
   * Send error notification
   */
  async notifyError(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.config.notifyOnErrors) {
      return false;
    }

    return this.notify({
      type: "error",
      priority: "high",
      title: "⚠️ Error Occurred",
      message: `An error occurred:\n\n${error.message}\n\nStack: \`${error.stack?.split("\n")[0] ?? "N/A"}\``,
      details: { errorName: error.name, ...context },
    });
  }

  /**
   * Send security notification
   */
  async notifySecurity(
    event: string,
    details?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.config.notifyOnSecurity) {
      return false;
    }

    return this.notify({
      type: "security",
      priority: "critical",
      title: "🔒 Security Event",
      message: `Security event detected:\n\n${event}`,
      details,
    });
  }

  /**
   * Send server added notification
   */
  async notifyServerAdded(server: Server): Promise<boolean> {
    return this.notify({
      type: "server_added",
      priority: "normal",
      title: "➕ Server Added",
      message: `New server added:\n\nHost: \`${server.host}\`\nUsername: \`${server.username}\`\nPort: ${server.port}`,
      details: { serverId: server.id },
    });
  }

  /**
   * Send server removed notification
   */
  async notifyServerRemoved(server: Server): Promise<boolean> {
    return this.notify({
      type: "server_removed",
      priority: "normal",
      title: "➖ Server Removed",
      message: `Server removed:\n\nHost: \`${server.host}\`\nUsername: \`${server.username}\``,
      details: { serverId: server.id },
    });
  }

  /**
   * Send connection lost notification
   */
  async notifyConnectionLost(server: Server, error?: string): Promise<boolean> {
    return this.notify({
      type: "connection_lost",
      priority: "high",
      title: "🔌 Connection Lost",
      message: `Connection lost to server:\n\nHost: \`${server.host}\`\n${error ? `Error: ${error}` : ""}`,
      details: { serverId: server.id, error },
    });
  }

  /**
   * Send connection restored notification
   */
  async notifyConnectionRestored(server: Server): Promise<boolean> {
    return this.notify({
      type: "connection_restored",
      priority: "normal",
      title: "✅ Connection Restored",
      message: `Connection restored to server:\n\nHost: \`${server.host}\``,
      details: { serverId: server.id },
    });
  }

  /**
   * Send backup created notification
   */
  async notifyBackupCreated(
    backupId: string,
    size: number,
  ): Promise<boolean> {
    return this.notify({
      type: "backup_created",
      priority: "low",
      title: "💾 Backup Created",
      message: `Backup created successfully.\n\nID: \`${backupId}\`\nSize: ${this.formatBytes(size)}`,
      details: { backupId, size },
    });
  }

  /**
   * Send backup restored notification
   */
  async notifyBackupRestored(backupId: string): Promise<boolean> {
    return this.notify({
      type: "backup_restored",
      priority: "normal",
      title: "📂 Backup Restored",
      message: `Backup restored successfully.\n\nID: \`${backupId}\``,
      details: { backupId },
    });
  }

  /**
   * Send config reloaded notification
   */
  async notifyConfigReloaded(success: boolean): Promise<boolean> {
    return this.notify({
      type: "config_reloaded",
      priority: success ? "normal" : "high",
      title: success ? "⚙️ Config Reloaded" : "⚠️ Config Reload Failed",
      message: success
        ? "Configuration reloaded successfully."
        : "Configuration reload failed. Check logs for details.",
    });
  }

  /**
   * Send rate limited notification
   */
  async notifyRateLimited(
    chatId: number,
    command: string,
  ): Promise<boolean> {
    return this.notify({
      type: "rate_limited",
      priority: "normal",
      title: "⏱️ Rate Limited",
      message: `User rate limited.\n\nChat ID: ${chatId}\nCommand: \`${command}\``,
      details: { chatId, command },
    });
  }

  /**
   * Send unauthorized access notification
   */
  async notifyUnauthorizedAccess(
    chatId: number,
    username: string | undefined,
    command: string,
  ): Promise<boolean> {
    return this.notify({
      type: "unauthorized_access",
      priority: "critical",
      title: "🚫 Unauthorized Access",
      message: `Unauthorized access attempt.\n\nChat ID: ${chatId}\nUsername: ${username ?? "Unknown"}\nCommand: \`${command}\``,
      details: { chatId, username, command },
    });
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    enabled: boolean;
    totalNotifications: number;
    uptime: number;
  } {
    return {
      enabled: this.config.enabled,
      totalNotifications: this.notificationCount,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
    };
  }

  /**
   * Get log context for notification-related logs
   */
  getLogContext(): LogContext {
    const stats = this.getStats();
    return {
      notificationsEnabled: stats.enabled,
      totalNotifications: stats.totalNotifications,
    };
  }

  /**
   * Format notification message
   */
  private formatNotification(payload: NotificationPayload): string {
    const priorityEmoji = {
      low: "ℹ️",
      normal: "📢",
      high: "⚠️",
      critical: "🚨",
    };

    let message = `${priorityEmoji[payload.priority]} *${payload.title}*\n\n`;
    message += payload.message;
    message += `\n\n_Time: ${payload.timestamp.toISOString()}_`;

    return message;
  }

  /**
   * Format uptime as human-readable string
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(" ");
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }
}
