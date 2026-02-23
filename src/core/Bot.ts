/**
 * Telegram Bot Core
 * Provides bot lifecycle management and command routing
 */

import TelegramBot from "node-telegram-bot-api";
import { UnauthorizedError } from "../errors/index.js";
import { LoggingService } from "../services/LoggingService.js";
import type {
  BotCommand,
  CommandContext,
  IBot,
  ICommandHandler,
  IMiddleware,
  MessageContext,
  MessageOptions,
} from "../types/index.js";

/**
 * Bot configuration
 */
interface BotConfig {
  token: string;
  ownerIds: string[];
  polling: boolean;
  /** Optional custom API URL for Telegram Bot API proxies */
  apiUrl?: string;
}

/**
 * Pre-compiled command regex pattern
 * Matches: /command[@bot_username] [args]
 */
const COMMAND_REGEX = /^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/;

/**
 * Telegram Bot implementation
 */
export class Bot implements IBot {
  private readonly bot: TelegramBot;
  private readonly ownerIds: Set<string>;
  private readonly logger: LoggingService;
  private readonly commands: Map<string, ICommandHandler> = new Map();
  private readonly middlewares: IMiddleware[] = [];
  private started = false;

  constructor(config: BotConfig, logger: LoggingService) {
    const options: TelegramBot.ConstructorOptions = { polling: config.polling };
    if (config.apiUrl) {
      options.baseApiUrl = config.apiUrl;
    }
    this.bot = new TelegramBot(config.token, options);
    this.ownerIds = new Set(config.ownerIds);
    this.logger = logger;
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    // Register command handlers
    this.setupHandlers();

    // Set bot commands
    try {
      await this.setCommands();
    } catch (error) {
      // Check for 404 error which indicates invalid bot token
      if (
        error instanceof Error &&
        (error.message.includes("404") || error.message.includes("Not Found"))
      ) {
        throw new Error(
          "Invalid bot token. Please check your BOT_TOKEN in .env file.\n" +
            "Get your token from @BotFather on Telegram.\n" +
            "Config file: " +
            (process.env.HOME ?? "~") +
            "/.config/telegram-ssh-bot/.env"
        );
      }
      throw error;
    }

    this.started = true;
    this.logger.info("Bot started");
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    if (this.bot.isPolling()) {
      await this.bot.stopPolling();
    }

    this.started = false;
    this.logger.info("Bot stopped");
  }

  /**
   * Register a command handler
   */
  registerCommand(handler: ICommandHandler): void {
    this.commands.set(handler.name, handler);
    this.logger.debug("Command registered", { command: handler.name });
  }

  /**
   * Add middleware
   */
  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.debug("Middleware added");
  }

  /**
   * Send a message
   */
  async sendMessage(
    chatId: number,
    message: string,
    options?: MessageOptions,
  ): Promise<void> {
    const sendOptions: TelegramBot.SendMessageOptions = {};

    if (options?.parseMode) {
      sendOptions.parse_mode = options.parseMode;
    }

    if (options?.disableWebPagePreview) {
      sendOptions.disable_web_page_preview = options.disableWebPagePreview;
    }

    if (options?.protectContent) {
      sendOptions.protect_content = options.protectContent;
    }

    await this.bot.sendMessage(chatId, message, sendOptions);
  }

  /**
   * Check if user is owner
   */
  isOwner(userId: number): boolean {
    return this.ownerIds.has(String(userId));
  }

  /**
   * Get the underlying TelegramBot instance
   */
  getTelegramBot(): TelegramBot {
    return this.bot;
  }

  /**
   * Setup message and command handlers
   */
  private setupHandlers(): void {
    // Handle all messages
    this.bot.on("message", async (msg: TelegramBot.Message) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        this.logger.error(
          "Error handling message",
          error instanceof Error ? error : new Error(String(error)),
          {
            chatId: msg.chat.id,
          },
        );
      }
    });

    // Handle polling errors
    this.bot.on("polling_error", (error: Error) => {
      // Check for 404 error which indicates invalid bot token
      if (error.message.includes("404") || error.message.includes("Not Found")) {
        this.logger.error(
          "Bot token is invalid. Please check your BOT_TOKEN in .env file.",
          error,
        );
        console.error("");
        console.error("╔═══════════════════════════════════════════════════════════════╗");
        console.error("║  ERROR: Invalid Bot Token                                     ║");
        console.error("╚═══════════════════════════════════════════════════════════════╝");
        console.error("");
        console.error("The bot token you provided is not valid.");
        console.error("Please:");
        console.error("  1. Go to @BotFather on Telegram");
        console.error("  2. Get your bot token");
        console.error("  3. Update BOT_TOKEN in your .env file:");
        console.error(`     ${process.env.HOME}/.config/telegram-ssh-bot/.env`);
        console.error("  4. Restart the bot");
        console.error("");
      } else {
        this.logger.error("Polling error", error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const context = this.createMessageContext(msg);

    // Check if it's a command
    if (msg.text?.startsWith("/")) {
      await this.handleCommand(msg, context);
    } else {
      // Handle as regular message (SSH command if connected)
      await this.handleRegularMessage(msg, context);
    }
  }

  /**
   * Handle command message
   */
  private async handleCommand(
    msg: TelegramBot.Message,
    context: MessageContext,
  ): Promise<void> {
    const text = msg.text;
    if (!text) {
      return;
    }

    // Parse command using pre-compiled regex
    const match = text.match(COMMAND_REGEX);
    if (!match) {
      return;
    }

    const commandName = match[1] ?? "";
    const args = match[2] ?? "";

    // Find handler
    const handler = this.commands.get(commandName);
    if (!handler) {
      await this.sendMessage(
        context.chatId,
        `Unknown command: /${commandName}`,
      );
      return;
    }

    // Create command context
    const commandContext: CommandContext = {
      ...context,
      command: commandName,
      args,
      match,
    };

    // Execute middleware stack
    try {
      await this.executeMiddleware(commandContext, async () => {
        await handler.execute(commandContext);
      });
    } catch (error) {
      await this.handleError(context.chatId, error);
    }
  }

  /**
   * Handle regular (non-command) message
   */
  private async handleRegularMessage(
    msg: TelegramBot.Message,
    context: MessageContext,
  ): Promise<void> {
    // Find a default handler for regular messages
    const defaultHandler = this.commands.get("_message");
    if (defaultHandler) {
      try {
        await this.executeMiddleware(context, async () => {
          await defaultHandler.execute({
            ...context,
            command: "_message",
            args: msg.text ?? "",
            match: [] as unknown as RegExpMatchArray,
          });
        });
      } catch (error) {
        await this.handleError(context.chatId, error);
      }
    }
  }

  /**
   * Execute middleware stack
   */
  private async executeMiddleware(
    context: MessageContext,
    final: () => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index];
        if (middleware) {
          index++;
          await middleware.execute({
            ...context,
            next,
            state: {},
          });
        }
      } else {
        await final();
      }
    };

    await next();
  }

  /**
   * Create message context from Telegram message
   */
  private createMessageContext(msg: TelegramBot.Message): MessageContext {
    return {
      message: msg,
      chatId: msg.chat.id,
      userId: msg.from?.id ?? 0,
      text: msg.text,
      isOwner: this.isOwner(msg.from?.id ?? 0),
      timestamp: new Date(),
    };
  }

  /**
   * Handle error and send user-friendly message
   */
  private async handleError(chatId: number, error: unknown): Promise<void> {
    if (error instanceof UnauthorizedError) {
      await this.sendMessage(
        chatId,
        "⛔ Unauthorized: You are not allowed to use this bot.",
      );
      return;
    }

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    await this.sendMessage(chatId, `❌ Error: ${message}`);

    this.logger.error(
      "Command error",
      error instanceof Error ? error : new Error(String(error)),
      {
        chatId,
      },
    );
  }

  /**
   * Set bot commands in Telegram
   */
  private async setCommands(): Promise<void> {
    const commands: BotCommand[] = [];

    for (const [, handler] of this.commands) {
      if (handler.name !== "_message") {
        commands.push({
          command: handler.name,
          description: handler.description,
        });
      }
    }

    if (commands.length > 0) {
      await this.bot.setMyCommands(commands);
      this.logger.debug("Bot commands set", { count: commands.length });
    }
  }
}
