/**
 * Command Handler
 * Handles SSH command execution
 */

import { ServerManager } from "../core/ServerManager.js";
import { SSHClient } from "../core/SSHClient.js";
import {
  ConnectionFailedError,
  ConnectionTimeoutError,
  DisconnectedError,
} from "../errors/index.js";
import { LoggingService } from "../services/LoggingService.js";
import { ValidationService } from "../services/ValidationService.js";
import type { CommandContext } from "../types/index.js";
import { IBot } from "../types/index.js";
import { BaseHandler } from "./BaseHandler.js";

/**
 * Handler for SSH command execution (non-command messages when connected)
 */
export class SSHCommandHandler extends BaseHandler {
  readonly name = "_message";
  readonly description = "Execute SSH commands";
  readonly pattern = /.*/;

  private readonly validationService: ValidationService;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
    validationService: ValidationService,
  ) {
    super(serverManager, sshClient, bot, logger);
    this.validationService = validationService;
  }

  async execute(context: CommandContext): Promise<void> {
    const command = context.args.trim();

    if (!command) {
      return;
    }

    // Check connection
    if (!this.sshClient.isConnected()) {
      await this.send(
        context.chatId,
        "❌ Not connected to any server.\nUse /ssh <index> to connect first.",
      );
      return;
    }

    // Validate and sanitize command
    const validation = this.validationService.validateCommand(command);
    if (!validation.valid) {
      await this.send(context.chatId, `❌ ${validation.error}`);
      this.logger.warn("Blocked unsafe command", {
        command,
        reason: validation.error,
        chatId: context.chatId,
      });
      return;
    }

    if (!validation.data) {
      throw new Error("Validation data is missing");
    }
    const sanitizedCommand = validation.data;
    this.logger.info("Executing SSH command", {
      command: sanitizedCommand.sanitized,
      chatId: context.chatId,
    });

    try {
      const result = await this.sshClient.execute(sanitizedCommand.sanitized);

      // Format output
      let output = "";

      if (result.stdout) {
        output += result.stdout;
      }

      if (result.stderr) {
        output += `\n⚠️ stderr:\n${result.stderr}`;
      }

      // Truncate if too long
      if (output.length > 4000) {
        output = output.substring(0, 4000) + "\n... (output truncated)";
      }

      if (output.trim()) {
        await this.send(context.chatId, `\`\`\`\n${output}\n\`\`\``);
      } else {
        await this.send(context.chatId, "✅ Command executed (no output)");
      }

      // Log if non-zero exit code
      if (result.exitCode !== 0 && result.exitCode !== null) {
        this.logger.warn("Command exited with non-zero code", {
          command: sanitizedCommand.sanitized,
          exitCode: result.exitCode,
          chatId: context.chatId,
        });
      }
    } catch (error) {
      if (error instanceof DisconnectedError) {
        await this.send(
          context.chatId,
          "❌ Connection lost. Please reconnect with /ssh <index>",
        );
        this.serverManager.clearCurrent();
      } else if (error instanceof ConnectionTimeoutError) {
        await this.send(
          context.chatId,
          "❌ Connection timed out. The server may be unreachable.",
        );
      } else if (error instanceof ConnectionFailedError) {
        await this.send(
          context.chatId,
          "❌ Connection failed. Please check the server status and try again.",
        );
      } else {
        const message =
          error instanceof Error ? error.message : "Command execution failed";
        await this.send(context.chatId, `❌ ${message}`);
      }

      this.logger.error(
        "SSH command failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          command: sanitizedCommand.sanitized,
          chatId: context.chatId,
        },
      );
    }
  }
}
