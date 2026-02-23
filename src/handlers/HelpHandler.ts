/**
 * Help Handler
 * Handles /help and /start commands
 */

import { BaseHandler } from './BaseHandler.js';
import type { CommandContext } from '../types/index.js';
import { ServerManager } from '../core/ServerManager.js';
import { SSHClient } from '../core/SSHClient.js';
import { LoggingService } from '../services/LoggingService.js';
import { IBot } from '../types/index.js';

/**
 * Handler for /help command
 */
export class HelpHandler extends BaseHandler {
  readonly name = 'help';
  readonly description = 'Show help message';
  readonly pattern = /^\/help/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const message = this.getHelpMessage();
    await this.sendMarkdown(context.chatId, message);
  }

  private getHelpMessage(): string {
    return `🤖 *Telegram SSH Bot*

*Available Commands:*

📋 *Server Management:*
• /add <host> <user> [pass] [port] [note] - Add server
• /rm <index> - Remove server
• /list - List all servers
• /current - Show current server

🔌 *SSH Connection:*
• /ssh <index> - Connect to server
• /exit - Disconnect from server

❓ *Help:*
• /help - Show this message
• /start - Start the bot

*Usage:*
1. Add a server with /add
2. Connect with /ssh <index>
3. Send any command to execute on server
4. Use /exit to disconnect

⚠️ *Security Notes:*
• Only authorized users can use this bot
• Commands are sanitized for safety
• Credentials are encrypted at rest
`;
  }
}

/**
 * Handler for /start command
 */
export class StartHandler extends BaseHandler {
  readonly name = 'start';
  readonly description = 'Start the bot';
  readonly pattern = /^\/start/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const message = `🤖 *Welcome to Telegram SSH Bot!*

This bot allows you to manage and connect to SSH servers directly from Telegram.

Use /help to see available commands.
`;

    await this.sendMarkdown(context.chatId, message);
    
    this.logger.info('Bot started for user', { 
      userId: context.userId, 
      chatId: context.chatId 
    });
  }
}
