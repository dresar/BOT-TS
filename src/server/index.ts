import app from './app.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/prisma.js';
import { WhatsAppClient } from '../wa/index.js';

const PORT = env.PORT;
const HOST = env.HOST;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Initialize WhatsApp client (optional for API-only mode)
    if (env.WHATSAPP_ENABLED) {
      const waClient = new WhatsAppClient();
      await waClient.initialize();
      logger.info('WhatsApp client initialized');
    } else {
      logger.info('WhatsApp client disabled, running in API-only mode');
    }

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info({
        port: PORT,
        host: HOST,
        env: env.NODE_ENV,
        timezone: env.TIMEZONE,
      }, 'Server started successfully');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await prisma.$disconnect();
          logger.info('Database disconnected');
        } catch (error) {
          logger.error({ error }, 'Error disconnecting from database');
        }
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
      
      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error({ error }, 'Unhandled error during server startup');
  process.exit(1);
});