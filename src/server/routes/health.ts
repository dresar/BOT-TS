import { Router, Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { z } from 'zod';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    whatsapp: {
      status: 'healthy' | 'unhealthy' | 'connecting';
      connected?: boolean;
      error?: string;
    };
  };
  metrics?: {
    totalMessages: number;
    activeUsers: number;
    errorRate: number;
  };
}

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database health
    const dbHealth = await checkDatabaseHealth();
    
    // Check WhatsApp client health (if available)
    const waHealth = await checkWhatsAppHealth();
    
    // Get basic metrics
    const metrics = await getBasicMetrics();
    
    const responseTime = Date.now() - startTime;
    
    const healthStatus: HealthStatus = {
      status: determineOverallStatus(dbHealth.status, waHealth.status),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      services: {
        database: dbHealth,
        whatsapp: waHealth,
      },
      metrics,
    };
    
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthStatus.status !== 'unhealthy',
      data: healthStatus,
      responseTime,
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, 'Health check failed');
    
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: env.NODE_ENV,
        uptime: process.uptime(),
        error: 'Health check failed',
      },
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health check with more metrics
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Get detailed database metrics
    const dbMetrics = await prisma.getDatabaseMetrics();
    
    // Get system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    };
    
    // Get recent error logs (last 24 hours)
    const recentErrors = await getRecentErrors();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: env.NODE_ENV,
        uptime: process.uptime(),
        system: systemInfo,
        database: dbMetrics,
        recentErrors,
        responseTime,
      },
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, 'Detailed health check failed');
    
    res.status(500).json({
      success: false,
      error: 'Detailed health check failed',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes/Docker
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if database is ready
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      ready: true,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      ready: false,
      error: 'Service not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes/Docker
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check WhatsApp client health
 */
async function checkWhatsAppHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'connecting';
  connected?: boolean;
  error?: string;
}> {
  try {
    // This would need to be implemented based on your WhatsApp client instance
    // For now, return a placeholder
    return {
      status: 'healthy',
      connected: true,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      error: error instanceof Error ? error.message : 'WhatsApp client error',
    };
  }
}

/**
 * Get basic metrics
 */
async function getBasicMetrics(): Promise<{
  totalMessages: number;
  activeUsers: number;
  errorRate: number;
}> {
  try {
    const [totalMessages, activeUsers] = await Promise.all([
      prisma.messageLog.count(),
      prisma.messageLog.groupBy({
        by: ['fromNumber'],
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }).then(groups => groups.length),
    ]);
    
    // Calculate error rate (placeholder - would need proper error tracking)
    const errorRate = 0; // Implement based on your error tracking
    
    return {
      totalMessages,
      activeUsers,
      errorRate,
    };
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to get basic metrics');
    
    return {
      totalMessages: 0,
      activeUsers: 0,
      errorRate: 0,
    };
  }
}

/**
 * Get recent errors
 */
async function getRecentErrors(): Promise<any[]> {
  try {
    // This would need to be implemented based on your error logging strategy
    // For now, return empty array
    return [];
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, 'Failed to get recent errors');
    
    return [];
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(
  dbStatus: 'healthy' | 'unhealthy',
  waStatus: 'healthy' | 'unhealthy' | 'connecting'
): 'healthy' | 'unhealthy' | 'degraded' {
  if (dbStatus === 'unhealthy') {
    return 'unhealthy';
  }
  
  if (waStatus === 'unhealthy') {
    return 'degraded';
  }
  
  if (waStatus === 'connecting') {
    return 'degraded';
  }
  
  return 'healthy';
}

export default router;