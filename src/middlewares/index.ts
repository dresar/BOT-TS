import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../utils/logger.js';
import { apiRateLimit } from '../utils/rate-limiter.js';
import { env } from '../config/env.js';
import { z } from 'zod';

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Generate unique request ID
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * Request timing middleware
 */
export function timingMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.startTime = Date.now();
  next();
}

/**
 * Request logging middleware
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestLogger = logger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  requestLogger.info('Incoming request');

  // Log response when finished
  const originalSend = res.send;
  res.send = function(body) {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    requestLogger.info({
      statusCode: res.statusCode,
      duration,
      responseSize: Buffer.byteLength(body || '', 'utf8'),
    }, 'Request completed');

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.ip || 'unknown';
  const rateLimitCheck = apiRateLimit.checkAllowance(clientId);

  if (!rateLimitCheck.allowed) {
    logger.warn({
      requestId: req.requestId,
      clientId,
      resetTime: rateLimitCheck.resetTime,
    }, 'API rate limit exceeded');

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000),
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', rateLimitCheck.limit);
  res.setHeader('X-RateLimit-Remaining', rateLimitCheck.remaining);
  res.setHeader('X-RateLimit-Reset', new Date(rateLimitCheck.resetTime).toISOString());

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestLogger = logger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  });

  // Log error
  requestLogger.error({
    error: err.message,
    stack: err.stack,
  }, 'Request error');

  // Handle different error types
  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  if (err.status && err.status < 500) {
    res.status(err.status).json({
      success: false,
      error: err.message || 'Client error',
    });
    return;
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: env.isDevelopment() ? err.message : 'Internal server error',
    ...(env.isDevelopment() && { stack: err.stack }),
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  }, 'Route not found');

  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}

/**
 * Security middleware configuration
 */
export function securityMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
}

/**
 * CORS middleware configuration
 */
export function corsMiddleware() {
  return cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });
}

/**
 * API key authentication middleware
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('X-API-Key') || req.query.apiKey as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
    });
    return;
  }

  if (apiKey !== env.API_KEY) {
    logger.warn({
      requestId: req.requestId,
      providedKey: apiKey.substring(0, 8) + '...',
    }, 'Invalid API key provided');

    res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Validation middleware factory
 */
export function validateSchema(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Query validation middleware factory
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Params validation middleware factory
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Health check bypass middleware
 */
export function healthCheckBypass(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health' || req.path === '/') {
    // Skip rate limiting and API key for health checks
    next();
    return;
  }
  
  // Apply normal middleware chain
  next();
}

/**
 * Response time header middleware
 */
export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  next();
}

export default {
  requestIdMiddleware,
  timingMiddleware,
  loggingMiddleware,
  rateLimitMiddleware,
  errorHandler,
  notFoundHandler,
  securityMiddleware,
  corsMiddleware,
  apiKeyAuth,
  validateSchema,
  validateQuery,
  validateParams,
  healthCheckBypass,
  responseTimeMiddleware,
};