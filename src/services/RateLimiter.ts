/**
 * Rate Limiter Service
 * Provides rate limiting for API requests
 */

import { RateLimitedError } from "../errors/index.js";
import type { RateLimitConfig } from "../types/index.js";

/**
 * Rate limit record for a single identifier
 */
interface RateLimitRecord {
  requests: number[];
  blocked: boolean;
  blockedUntil?: number;
}

/**
 * Rate limiter service for controlling request frequency
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly store: Map<string, RateLimitRecord> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given identifier
   * @throws RateLimitedError if rate limit is exceeded
   */
  checkLimit(identifier: string): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const now = Date.now();

    // Get or create record
    let record = this.store.get(identifier);
    if (!record) {
      record = { requests: [], blocked: false };
      this.store.set(identifier, record);
    }

    // Check if blocked
    if (record.blocked) {
      if (record.blockedUntil && now < record.blockedUntil) {
        const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
        throw new RateLimitedError(retryAfter, { context: { identifier } });
      }
      // Reset block
      record.blocked = false;
      record.blockedUntil = undefined;
    }

    // Clean old requests
    record.requests = record.requests.filter(
      (time) => now - time < this.config.windowMs,
    );

    // Check limit
    if (record.requests.length >= this.config.maxRequests) {
      record.blocked = true;
      record.blockedUntil = now + this.config.windowMs;
      throw new RateLimitedError(Math.ceil(this.config.windowMs / 1000), {
        context: { identifier },
      });
    }

    // Record request
    record.requests.push(now);
    return true;
  }

  /**
   * Check if identifier is currently rate limited
   */
  isLimited(identifier: string): boolean {
    const record = this.store.get(identifier);
    if (!record) {
      return false;
    }

    if (record.blocked && record.blockedUntil) {
      return Date.now() < record.blockedUntil;
    }

    return false;
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier: string): number {
    const record = this.store.get(identifier);
    if (!record) {
      return this.config.maxRequests;
    }

    const now = Date.now();
    const validRequests = record.requests.filter(
      (time) => now - time < this.config.windowMs,
    );

    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      // Remove expired blocked records
      if (record.blocked && record.blockedUntil && now >= record.blockedUntil) {
        this.store.delete(key);
        continue;
      }

      // Remove records with no valid requests
      const validRequests = record.requests.filter(
        (time) => now - time < this.config.windowMs,
      );
      if (validRequests.length === 0) {
        this.store.delete(key);
      } else {
        record.requests = validRequests;
      }
    }
  }
}
