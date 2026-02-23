/**
 * Rate Limit Middleware
 * Limits the number of requests per user
 */

import { RateLimiter } from "../services/RateLimiter.js";
import type { IMiddleware, MiddlewareContext } from "../types/index.js";

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware implements IMiddleware {
  private readonly rateLimiter: RateLimiter;

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async execute(context: MiddlewareContext): Promise<void> {
    // Use chat ID as identifier for rate limiting
    const identifier = String(context.chatId);

    // Check rate limit (throws if exceeded)
    this.rateLimiter.checkLimit(identifier);

    // Continue to next middleware/handler
    await context.next();
  }

  /**
   * Get remaining requests for a chat
   */
  getRemaining(chatId: number): number {
    return this.rateLimiter.getRemaining(String(chatId));
  }

  /**
   * Reset rate limit for a chat
   */
  reset(chatId: number): void {
    this.rateLimiter.reset(String(chatId));
  }
}
