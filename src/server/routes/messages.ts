import { Router, Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { validateSchema, validateQuery, validateParams, apiKeyAuth } from '../../middlewares/index.js';
import { messageHandler } from '../../wa/handler.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const messageQuerySchema = z.object({
  fromNumber: z.string().optional(),
  intent: z.string().optional(),
  isGroup: z.string().transform(val => val === 'true').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
  sortBy: z.enum(['timestamp', 'confidence', 'intent']).optional().default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const messageIdSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
});

const sendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient number is required'),
  message: z.string().min(1, 'Message content is required'),
  isGroup: z.boolean().optional().default(false),
});

const bulkMessageSchema = z.object({
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  message: z.string().min(1, 'Message content is required'),
  delayMs: z.number().min(1000).max(10000).optional().default(2000),
});

/**
 * GET /messages
 * Get message logs with filtering and pagination
 */
router.get('/',
  apiKeyAuth,
  validateQuery(messageQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        fromNumber,
        intent,
        isGroup,
        startDate,
        endDate,
        limit,
        offset,
        sortBy,
        sortOrder,
      } = req.query as any;
      
      // Build where clause
      const where: any = {};
      
      if (fromNumber) {
        where.fromNumber = { contains: fromNumber, mode: 'insensitive' };
      }
      
      if (intent) {
        where.intent = intent;
      }
      
      if (isGroup !== undefined) {
        where.isGroup = isGroup;
      }
      
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }
      
      const [messages, total] = await Promise.all([
        prisma.messageLog.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
          select: {
            id: true,
            messageId: true,
            fromNumber: true,
            messageText: true,
            intent: true,
            confidence: true,
            response: true,
            timestamp: true,
            isGroup: true,
            groupId: true,
            participantId: true,
          },
        }),
        prisma.messageLog.count({ where }),
      ]);
      
      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
      }, 'Failed to get messages');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
      });
    }
  }
);

/**
 * GET /messages/:messageId
 * Get specific message by ID
 */
router.get('/:messageId',
  apiKeyAuth,
  validateParams(messageIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      
      const message = await prisma.messageLog.findUnique({
        where: { messageId },
      });
      
      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: message,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        messageId: req.params.messageId,
      }, 'Failed to get message');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get message',
      });
    }
  }
);

/**
 * POST /messages/send
 * Send a message via WhatsApp
 */
router.post('/send',
  apiKeyAuth,
  validateSchema(sendMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const { to, message, isGroup } = req.body;
      
      // TODO: Implement actual message sending via WhatsApp client
      // This would require access to the WhatsApp client instance
      
      logger.info({
        requestId: req.requestId,
        to,
        messageLength: message.length,
        isGroup,
      }, 'Message send requested');
      
      // For now, return success response
      // In real implementation, you would:
      // 1. Get WhatsApp client instance
      // 2. Send message using client.sendMessage()
      // 3. Log the sent message
      
      res.json({
        success: true,
        data: {
          messageId: `sent_${Date.now()}`,
          to,
          message,
          timestamp: new Date().toISOString(),
          status: 'sent',
        },
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        to: req.body?.to,
      }, 'Failed to send message');
      
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
      });
    }
  }
);

/**
 * POST /messages/bulk-send
 * Send bulk messages
 */
router.post('/bulk-send',
  apiKeyAuth,
  validateSchema(bulkMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const { recipients, message, delayMs } = req.body;
      
      logger.info({
        requestId: req.requestId,
        recipientCount: recipients.length,
        messageLength: message.length,
        delayMs,
      }, 'Bulk message send requested');
      
      // TODO: Implement actual bulk message sending
      // This should be done asynchronously with proper rate limiting
      
      const results = recipients.map((recipient: string, index: number) => ({
        recipient,
        messageId: `bulk_${Date.now()}_${index}`,
        status: 'queued',
        scheduledTime: new Date(Date.now() + (index * delayMs)).toISOString(),
      }));
      
      res.json({
        success: true,
        data: {
          totalRecipients: recipients.length,
          results,
          estimatedCompletionTime: new Date(Date.now() + (recipients.length * delayMs)).toISOString(),
        },
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        recipientCount: req.body?.recipients?.length,
      }, 'Failed to send bulk messages');
      
      res.status(500).json({
        success: false,
        error: 'Failed to send bulk messages',
      });
    }
  }
);

/**
 * GET /messages/stats
 * Get message statistics
 */
router.get('/stats/overview',
  apiKeyAuth,
  async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const [totalMessages, todayMessages, weekMessages, monthMessages] = await Promise.all([
        prisma.messageLog.count(),
        prisma.messageLog.count({
          where: { timestamp: { gte: today } },
        }),
        prisma.messageLog.count({
          where: { timestamp: { gte: thisWeek } },
        }),
        prisma.messageLog.count({
          where: { timestamp: { gte: thisMonth } },
        }),
      ]);
      
      // Get intent distribution
      const intentStats = await prisma.messageLog.groupBy({
        by: ['intent'],
        _count: { intent: true },
        orderBy: { _count: { intent: 'desc' } },
        take: 10,
      });
      
      // Get unique users
      const uniqueUsers = await prisma.messageLog.groupBy({
        by: ['fromNumber'],
        where: { timestamp: { gte: thisMonth } },
      });
      
      // Get average confidence
      const avgConfidence = await prisma.messageLog.aggregate({
        _avg: { confidence: true },
        where: { timestamp: { gte: thisMonth } },
      });
      
      res.json({
        success: true,
        data: {
          overview: {
            totalMessages,
            todayMessages,
            weekMessages,
            monthMessages,
            uniqueUsersThisMonth: uniqueUsers.length,
            averageConfidence: avgConfidence._avg.confidence || 0,
          },
          intentDistribution: intentStats.map(stat => ({
            intent: stat.intent,
            count: stat._count.intent,
          })),
        },
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
      }, 'Failed to get message stats');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get message statistics',
      });
    }
  }
);

/**
 * GET /messages/stats/daily
 * Get daily message statistics for the last 30 days
 */
router.get('/stats/daily',
  apiKeyAuth,
  async (req: Request, res: Response) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const dailyStats = await prisma.$queryRaw`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as message_count,
          COUNT(DISTINCT "fromNumber") as unique_users,
          AVG(confidence) as avg_confidence
        FROM "MessageLog"
        WHERE timestamp >= ${thirtyDaysAgo}
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `;
      
      res.json({
        success: true,
        data: dailyStats,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
      }, 'Failed to get daily stats');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get daily statistics',
      });
    }
  }
);

/**
 * DELETE /messages/:messageId
 * Delete a specific message log
 */
router.delete('/:messageId',
  apiKeyAuth,
  validateParams(messageIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      
      const message = await prisma.messageLog.findUnique({
        where: { messageId },
      });
      
      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found',
        });
        return;
      }
      
      await prisma.messageLog.delete({
        where: { messageId },
      });
      
      logger.info({
        requestId: req.requestId,
        messageId,
      }, 'Message log deleted');
      
      res.json({
        success: true,
        message: 'Message log deleted successfully',
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        messageId: req.params.messageId,
      }, 'Failed to delete message');
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete message',
      });
    }
  }
);

export default router;