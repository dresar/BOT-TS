import NodeCache from 'node-cache';
import { createWhatsAppLogger } from './logger.js';

const logger = createWhatsAppLogger();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  burstLimit?: number; // Allow burst of requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  burstCount?: number;
}

export class RateLimiter {
  private cache: NodeCache;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cache = new NodeCache({
      stdTTL: Math.ceil(config.windowMs / 1000), // Convert to seconds
      checkperiod: Math.ceil(config.windowMs / 1000 / 10), // Check every 10% of TTL
    });
  }

  /**
   * Check if a request is allowed for the given identifier
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    
    let entry = this.cache.get<RateLimitEntry>(key);
    
    if (!entry || now >= entry.resetTime) {
      // Create new entry or reset expired entry
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs,
        burstCount: this.config.burstLimit ? 1 : undefined,
      };
      this.cache.set(key, entry);
      return true;
    }

    // Check burst limit first (if configured)
    if (this.config.burstLimit && entry.burstCount !== undefined) {
      if (entry.burstCount >= this.config.burstLimit) {
        logger.warn({
          identifier,
          burstCount: entry.burstCount,
          burstLimit: this.config.burstLimit,
        }, 'Burst limit exceeded');
        return false;
      }
      entry.burstCount++;
    }

    // Check regular rate limit
    if (entry.count >= this.config.maxRequests) {
      logger.warn({
        identifier,
        count: entry.count,
        maxRequests: this.config.maxRequests,
        resetTime: new Date(entry.resetTime).toISOString(),
      }, 'Rate limit exceeded');
      return false;
    }

    entry.count++;
    this.cache.set(key, entry);
    return true;
  }

  /**
   * Get current rate limit status for an identifier
   */
  getStatus(identifier: string): {
    allowed: boolean;
    count: number;
    maxRequests: number;
    resetTime: number;
    remaining: number;
  } {
    const key = `rate_limit:${identifier}`;
    const entry = this.cache.get<RateLimitEntry>(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        allowed: true,
        count: 0,
        maxRequests: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        remaining: this.config.maxRequests,
      };
    }

    return {
      allowed: entry.count < this.config.maxRequests,
      count: entry.count,
      maxRequests: this.config.maxRequests,
      resetTime: entry.resetTime,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    const key = `rate_limit:${identifier}`;
    this.cache.del(key);
    logger.info({ identifier }, 'Rate limit reset');
  }

  /**
   * Get all active rate limits (for monitoring)
   */
  getActiveRateLimits(): Array<{
    identifier: string;
    count: number;
    resetTime: number;
  }> {
    const keys = this.cache.keys();
    const results: Array<{
      identifier: string;
      count: number;
      resetTime: number;
    }> = [];

    for (const key of keys) {
      if (key.startsWith('rate_limit:')) {
        const entry = this.cache.get<RateLimitEntry>(key);
        if (entry) {
          results.push({
            identifier: key.replace('rate_limit:', ''),
            count: entry.count,
            resetTime: entry.resetTime,
          });
        }
      }
    }

    return results;
  }
}

// Default WhatsApp rate limiter
// 1 message per second, burst of 3 messages
export const whatsappRateLimiter = new RateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 1,
  burstLimit: 3,
});

// API rate limiter
// 100 requests per minute
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

// Helper function to extract identifier from WhatsApp JID
export const getWhatsAppIdentifier = (jid: string): string => {
  // Remove @s.whatsapp.net or @g.us suffix
  return jid.split('@')[0] || jid;
};

// Helper function to check WhatsApp rate limit
export const checkWhatsAppRateLimit = (jid: string): boolean => {
  const identifier = getWhatsAppIdentifier(jid);
  return whatsappRateLimiter.isAllowed(identifier);
};

// Helper function to get WhatsApp rate limit status
export const getWhatsAppRateLimitStatus = (jid: string) => {
  const identifier = getWhatsAppIdentifier(jid);
  return whatsappRateLimiter.getStatus(identifier);
};