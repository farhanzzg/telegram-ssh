/**
 * Base Command Handler
 * Provides common functionality for all command handlers
 */

import { ServerManager } from "../core/ServerManager.js";
import { SSHClient } from "../core/SSHClient.js";
import { LoggingService } from "../services/LoggingService.js";
import type {
  CommandContext,
  IBot,
  ICommandHandler,
  Server,
} from "../types/index.js";

/**
 * Base command handler with common functionality
 */
export abstract class BaseHandler implements ICommandHandler {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly pattern: RegExp;

  protected readonly serverManager: ServerManager;
  protected readonly sshClient: SSHClient;
  protected readonly bot: IBot;
  protected readonly logger: LoggingService;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    this.serverManager = serverManager;
    this.sshClient = sshClient;
    this.bot = bot;
    this.logger = logger;
  }

  /**
   * Execute the command handler
   */
  abstract execute(context: CommandContext): Promise<void>;

  /**
   * Send a message to the chat
   */
  protected async send(chatId: number, message: string): Promise<void> {
    await this.bot.sendMessage(chatId, message);
  }

  /**
   * Send a markdown message to the chat
   */
  protected async sendMarkdown(chatId: number, message: string): Promise<void> {
    await this.bot.sendMessage(chatId, message, { parseMode: "Markdown" });
  }

  /**
   * Get current server or send error message
   */
  protected getCurrentServerOrError(chatId: number): Server | null {
    const current = this.serverManager.getCurrent();
    if (!current) {
      this.send(
        chatId,
        "❌ No server connected. Use /ssh <index> to connect first.",
      );
      return null;
    }
    return current;
  }

  /**
   * Check if SSH is connected or send error message
   */
  protected checkConnectionOrError(chatId: number): boolean {
    if (!this.sshClient.isConnected()) {
      this.send(
        chatId,
        "❌ Not connected to SSH server. Use /ssh <index> to connect.",
      );
      return false;
    }
    return true;
  }

  /**
   * Format server list for display
   */
  protected formatServerList(servers: Server[]): string {
    if (servers.length === 0) {
      return "📋 No servers configured.\n\nUse /add to add a server.";
    }

    const current = this.serverManager.getCurrent();
    const lines: string[] = ["📋 *Configured Servers:*\n"];

    servers.forEach((server, index) => {
      const isCurrent = current?.id === server.id;
      const marker = isCurrent ? "✓ " : "  ";
      const note = server.note ? ` (${server.note})` : "";
      lines.push(
        `${marker}${index + 1}. \`${server.username}@${server.host}:${server.port}\`${note}`,
      );
    });

    lines.push("\n_use /ssh <index> to connect_");
    return lines.join("\n");
  }

  /**
   * Format server info for display
   */
  protected formatServerInfo(server: Server): string {
    const lines = [
      `🖥️ *Server Info*`,
      `• Host: \`${server.host}\``,
      `• Port: \`${server.port}\``,
      `• User: \`${server.username}\``,
      `• Auth: \`${server.auth.type}\``,
    ];

    if (server.note) {
      lines.push(`• Note: ${server.note}`);
    }

    return lines.join("\n");
  }
}
