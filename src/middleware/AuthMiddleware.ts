/**
 * Auth Middleware
 * Validates that only authorized users can interact with the bot
 */

import { UnauthorizedError } from "../errors/index.js";
import { LoggingService } from "../services/LoggingService.js";
import type { IMiddleware, MiddlewareContext } from "../types/index.js";

/**
 * Authorization middleware
 */
export class AuthMiddleware implements IMiddleware {
  private readonly ownerIds: Set<string>;
  private readonly logger: LoggingService;

  constructor(ownerIds: string[], logger: LoggingService) {
    this.ownerIds = new Set(ownerIds);
    this.logger = logger;
  }

  async execute(context: MiddlewareContext): Promise<void> {
    const userId = context.userId;

    // Check if user is authorized
    if (!this.ownerIds.has(String(userId))) {
      this.logger.warn("Unauthorized access attempt", {
        userId,
        chatId: context.chatId,
        text: context.text,
      });

      throw new UnauthorizedError(userId);
    }

    // User is authorized, continue
    await context.next();
  }

  /**
   * Check if a user ID is authorized
   */
  isAuthorized(userId: number): boolean {
    return this.ownerIds.has(String(userId));
  }

  /**
   * Add an owner ID
   */
  addOwner(userId: string): void {
    this.ownerIds.add(userId);
  }

  /**
   * Remove an owner ID
   */
  removeOwner(userId: string): void {
    this.ownerIds.delete(userId);
  }
}
