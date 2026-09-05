import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from '../config/env.js';
import pino from 'pino';

const logger = pino({ name: 'prisma' });

// Prisma Client configuration
const prismaConfig = {
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  log: isDevelopment() ? [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
  ] as const : [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ] as const,
};

// Create Prisma Client instance
const prisma = new PrismaClient(prismaConfig);

// Log database queries in development
if (isDevelopment()) {
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    }, 'Database query executed');
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error({
    target: e.target,
    message: e.message,
  }, 'Database error occurred');
});

// Log database info
prisma.$on('info', (e) => {
  logger.info({
    target: e.target,
    message: e.message,
  }, 'Database info');
});

// Log database warnings
prisma.$on('warn', (e) => {
  logger.warn({
    target: e.target,
    message: e.message,
  }, 'Database warning');
});

// Database connection health check
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  latency?: number;
}> => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      message: 'Database connection is healthy',
      latency,
    };
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from database');
  }
};

// Database transaction helper
export const withTransaction = async <T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(callback);
};

// Database metrics
export const getDatabaseMetrics = async () => {
  try {
    const [userCount, messageLogCount, knowledgeItemCount, scheduleCount, configCount] = await Promise.all([
      prisma.user.count(),
      prisma.messageLog.count(),
      prisma.knowledgeItem.count(),
      prisma.schedule.count(),
      prisma.config.count(),
    ]);

    return {
      users: userCount,
      messageLogs: messageLogCount,
      knowledgeItems: knowledgeItemCount,
      schedules: scheduleCount,
      configs: configCount,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get database metrics');
    throw error;
  }
};

// Export the Prisma client instance
export { prisma };
export default prisma;

// Type exports for convenience
export type {
  User,
  MessageLog,
  KnowledgeItem,
  Schedule,
  Config,
  UserRole,
  KnowledgeCategory,
  ScheduleType,
} from '@prisma/client';