/**
 * Bot-related type definitions
 */

import type TelegramBot from "node-telegram-bot-api";

export interface MessageContext {
  message: TelegramBot.Message;
  chatId: number;
  userId: number;
  text?: string;
  isOwner: boolean;
  timestamp: Date;
}

export interface CommandContext extends MessageContext {
  command: string;
  args: string;
  match: RegExpMatchArray;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface MessageOptions {
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disableWebPagePreview?: boolean;
  protectContent?: boolean;
}

export interface MiddlewareContext extends MessageContext {
  next: () => Promise<void>;
  state: Record<string, unknown>;
}

export interface ICommandHandler {
  name: string;
  description: string;
  pattern: RegExp;
  execute(context: CommandContext): Promise<void>;
}

export interface IMiddleware {
  execute(context: MiddlewareContext): Promise<void>;
}

export interface IBot {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(
    chatId: number,
    message: string,
    options?: MessageOptions,
  ): Promise<void>;
}

export interface LogContext {
  chatId?: number;
  userId?: number;
  command?: string;
  serverId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
