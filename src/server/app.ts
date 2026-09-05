import express from 'express';
import { env } from '../config/env.js';
import {
  requestIdMiddleware,
  timingMiddleware,
  loggingMiddleware,
  rateLimitMiddleware,
  errorHandler,
  notFoundHandler,
  securityMiddleware,
  corsMiddleware,
  healthCheckBypass,
  responseTimeMiddleware,
} from '../middlewares/index.js';
import routes from './routes/index.js';
import { logger } from '../utils/logger.js';

const app = express();

// Trust proxy for rate limiting and security
app.set('trust proxy', 1);

// Health check bypass (should be first)
app.use(healthCheckBypass);

// Security middleware
app.use(securityMiddleware);

// CORS
app.use(corsMiddleware);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking and timing
app.use(requestIdMiddleware);
app.use(responseTimeMiddleware);
app.use(timingMiddleware);

// Logging
app.use(loggingMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Bot API Server',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    docs: '/api',
  });
});

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

export default app;