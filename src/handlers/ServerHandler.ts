/**
 * Server Handler
 * Handles server management commands: /add, /rm, /list, /ssh, /exit, /current
 */

import { promises as fs } from "fs";
import { ServerManager } from "../core/ServerManager.js";
import { SSHClient } from "../core/SSHClient.js";
import { ConnectionFailedError } from "../errors/index.js";
import { LoggingService } from "../services/LoggingService.js";
import type { CommandContext, SSHConnectionConfig } from "../types/index.js";
import { IBot } from "../types/index.js";
import { BaseHandler } from "./BaseHandler.js";

/**
 * Handler for /add command - add a new server
 */
export class AddServerHandler extends BaseHandler {
  readonly name = "add";
  readonly description = "Add a new server configuration";
  readonly pattern = /^\/add/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const args = context.args.trim();

    if (!args) {
      await this.send(
        context.chatId,
        "Usage: /add <host> <username> [password] [port] [note]\n" +
          'Example: /add 192.168.1.1 root password123 22 "My Server"',
      );
      return;
    }

    try {
      const parts = this.parseArgs(args);

      if (!parts[0] || !parts[1]) {
        await this.send(context.chatId, "❌ Host and username are required.");
        return;
      }

      const config = {
        host: parts[0],
        username: parts[1],
        password: parts[2],
        port: parts[3] ? parseInt(parts[3], 10) : 22,
        note: parts[4],
      };

      const server = await this.serverManager.add(config);
      await this.send(
        context.chatId,
        `✅ Server added successfully!\n\n${this.formatServerInfo(server)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add server";
      await this.send(context.chatId, `❌ ${message}`);
    }
  }

  private parseArgs(args: string): string[] {
    // Handle quoted strings for note
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of args) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === " " && !inQuotes) {
        if (current) {
          result.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }
}

/**
 * Handler for /rm command - remove a server
 */
export class RemoveServerHandler extends BaseHandler {
  readonly name = "rm";
  readonly description = "Remove a server by index";
  readonly pattern = /^\/rm/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const args = context.args.trim();

    if (!args) {
      await this.send(
        context.chatId,
        "Usage: /rm <index>\nUse /list to see server indices.",
      );
      return;
    }

    // BUG-003 FIX: Use parseInt instead of parseFloat
    const index = parseInt(args, 10);

    if (isNaN(index) || index < 1) {
      await this.send(
        context.chatId,
        "❌ Invalid index. Please provide a valid number.",
      );
      return;
    }

    try {
      const server = await this.serverManager.getByIndex(index);
      if (!server) {
        await this.send(
          context.chatId,
          `❌ Server at index ${index} not found.`,
        );
        return;
      }

      // Disconnect if removing current server
      if (
        this.sshClient.isConnected() &&
        this.serverManager.getCurrent()?.id === server.id
      ) {
        await this.sshClient.disconnect();
        this.serverManager.clearCurrent();
      }

      await this.serverManager.removeByIndex(index);
      await this.send(
        context.chatId,
        `✅ Server removed: \`${server.username}@${server.host}\``,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove server";
      await this.send(context.chatId, `❌ ${message}`);
    }
  }
}

/**
 * Handler for /list command - list all servers
 */
export class ListServerHandler extends BaseHandler {
  readonly name = "list";
  readonly description = "List all configured servers";
  readonly pattern = /^\/list/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const servers = await this.serverManager.list();
    const message = this.formatServerList(servers);
    await this.sendMarkdown(context.chatId, message);
  }
}

/**
 * Handler for /ssh command - connect to a server
 */
export class SSHServerHandler extends BaseHandler {
  readonly name = "ssh";
  readonly description = "Connect to a server by index";
  readonly pattern = /^\/ssh/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const args = context.args.trim();

    if (!args) {
      await this.send(
        context.chatId,
        "Usage: /ssh <index>\nUse /list to see server indices.",
      );
      return;
    }

    // BUG-003 FIX: Use parseInt instead of parseFloat
    const index = parseInt(args, 10);

    if (isNaN(index) || index < 1) {
      await this.send(
        context.chatId,
        "❌ Invalid index. Please provide a valid number.",
      );
      return;
    }

    const server = await this.serverManager.getByIndex(index);
    if (!server) {
      await this.send(context.chatId, `❌ Server at index ${index} not found.`);
      return;
    }

    // Disconnect current connection
    if (this.sshClient.isConnected()) {
      await this.sshClient.disconnect();
      this.serverManager.clearCurrent();
    }

    await this.send(
      context.chatId,
      `🔌 Connecting to \`${server.username}@${server.host}\`...`,
    );

    try {
      // Get decrypted credentials
      const credentials = this.serverManager.getDecryptedCredentials(server);

      // Build SSH config
      const sshConfig: SSHConnectionConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        password: credentials.password,
        passphrase: credentials.passphrase,
      };

      // Load private key if needed
      if (server.auth.type === "privateKey" && credentials.privateKeyPath) {
        try {
          const keyBuffer = await fs.readFile(credentials.privateKeyPath);
          sshConfig.privateKey = keyBuffer;
        } catch (error) {
          throw new Error(
            `Failed to read private key: ${credentials.privateKeyPath}`,
          );
        }
      }

      // Connect
      await this.sshClient.connect(sshConfig);
      this.sshClient.setServerId(server.id);
      this.serverManager.setCurrent(server);

      await this.send(
        context.chatId,
        `✅ Connected to \`${server.username}@${server.host}\`\n` +
          `Send any command to execute on the server.`,
      );

      this.logger.info("SSH connection established", {
        serverId: server.id,
        host: server.host,
        chatId: context.chatId,
      });
    } catch (error) {
      if (error instanceof ConnectionFailedError) {
        await this.send(
          context.chatId,
          `❌ Connection failed: ${error.message}`,
        );
      } else {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        await this.send(context.chatId, `❌ Failed to connect: ${message}`);
      }

      this.logger.error(
        "SSH connection failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          serverId: server.id,
          host: server.host,
        },
      );
    }
  }
}

/**
 * Handler for /exit command - disconnect from current server
 */
export class ExitServerHandler extends BaseHandler {
  readonly name = "exit";
  readonly description = "Disconnect from current SSH session";
  readonly pattern = /^\/exit/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    if (!this.sshClient.isConnected()) {
      await this.send(context.chatId, "❌ Not connected to any server.");
      return;
    }

    const current = this.serverManager.getCurrent();
    await this.sshClient.disconnect();
    this.serverManager.clearCurrent();

    const host = current?.host ?? "unknown";
    await this.send(context.chatId, `👋 Disconnected from \`${host}\``);

    this.logger.info("SSH disconnected", {
      serverId: current?.id,
      chatId: context.chatId,
    });
  }
}

/**
 * Handler for /current command - show current server
 */
export class CurrentServerHandler extends BaseHandler {
  readonly name = "current";
  readonly description = "Show current connected server";
  readonly pattern = /^\/current/;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
  ) {
    super(serverManager, sshClient, bot, logger);
  }

  async execute(context: CommandContext): Promise<void> {
    const current = this.serverManager.getCurrent();

    if (!current) {
      await this.send(
        context.chatId,
        "❌ Not connected to any server.\nUse /ssh <index> to connect.",
      );
      return;
    }

    const connected = this.sshClient.isConnected();
    const status = connected ? "🟢 Connected" : "🔴 Disconnected";

    await this.sendMarkdown(
      context.chatId,
      `${status}\n\n${this.formatServerInfo(current)}`,
    );
  }
}
