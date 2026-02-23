/**
 * Health Handler
 * Handles /health command to show system health status
 */

import { ServerManager } from "../core/ServerManager.js";
import { SSHClient } from "../core/SSHClient.js";
import { HealthService } from "../services/HealthService.js";
import { LoggingService } from "../services/LoggingService.js";
import type { CommandContext, IBot, ICommandHandler } from "../types/index.js";

/**
 * Handler for /health command - show system health status
 */
export class HealthHandler implements ICommandHandler {
  readonly name = "health";
  readonly description = "Show system health status";
  readonly pattern = /^\/health/;

  private readonly serverManager: ServerManager;
  private readonly sshClient: SSHClient;
  private readonly bot: IBot;
  private readonly logger: LoggingService;
  private readonly healthService: HealthService;

  constructor(
    serverManager: ServerManager,
    sshClient: SSHClient,
    bot: IBot,
    logger: LoggingService,
    healthService: HealthService,
  ) {
    this.serverManager = serverManager;
    this.sshClient = sshClient;
    this.bot = bot;
    this.logger = logger;
    this.healthService = healthService;
  }

  async execute(context: CommandContext): Promise<void> {
    try {
      // Update health service with current metrics
      const servers = await this.serverManager.list();
      this.healthService.setTotalServers(servers.length);
      this.healthService.setActiveConnections(
        this.sshClient.isConnected() ? 1 : 0,
      );
      this.healthService.setStorageHealth(true);
      this.healthService.setBotHealth(true);

      // Get formatted health report
      const report = this.healthService.getFormattedHealthReport();

      await this.bot.sendMessage(context.chatId, report, {
        parseMode: "Markdown",
      });

      this.logger.debug("Health status requested", {
        chatId: context.chatId,
        ...this.healthService.getLogContext(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get health status";
      await this.bot.sendMessage(context.chatId, `❌ ${message}`);
      this.logger.error("Failed to get health status", error as Error, {
        chatId: context.chatId,
      });
    }
  }
}
