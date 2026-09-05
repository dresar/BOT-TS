import { Prisma, MessageLog } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../../utils/logger.js';

export interface CreateMessageData {
  userId: string;
  whatsappJid: string;
  messageId: string;
  content: string;
  intent?: string;
  confidence?: number;
  response?: string;
  isIncoming: boolean;
}

export interface MessageFilters {
  userId?: string;
  whatsappJid?: string;
  intent?: string;
  isIncoming?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface MessageStats {
  totalMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  uniqueUsers: number;
  topIntents: Array<{ intent: string; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
}

export class MessageRepository {
  static async create(data: CreateMessageData): Promise<MessageLog> {
    try {
      const message = await prisma.messageLog.create({
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
      });
      
      logger.db.info({ messageId: message.id }, 'Message logged');
      return message;
    } catch (error) {
      logger.db.error({ error, data }, 'Failed to create message log');
      throw error;
    }
  }

  static async findById(id: string): Promise<MessageLog | null> {
    try {
      return await prisma.messageLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              whatsappJid: true,
            },
          },
        },
      });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to find message by ID');
      throw error;
    }
  }

  static async findMany(
    filters: MessageFilters = {},
    page = 1,
    limit = 50
  ): Promise<{ messages: MessageLog[]; total: number; pages: number }> {
    try {
      const where: Prisma.MessageLogWhereInput = {};

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.whatsappJid) {
        where.whatsappJid = filters.whatsappJid;
      }

      if (filters.intent) {
        where.intent = filters.intent;
      }

      if (filters.isIncoming !== undefined) {
        where.isIncoming = filters.isIncoming;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) {
          where.createdAt.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.createdAt.lte = filters.dateTo;
        }
      }

      if (filters.search) {
        where.OR = [
          { content: { contains: filters.search, mode: 'insensitive' } },
          { response: { contains: filters.search, mode: 'insensitive' } },
          { intent: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [messages, total] = await Promise.all([
        prisma.messageLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
                whatsappJid: true,
              },
            },
          },
        }),
        prisma.messageLog.count({ where }),
      ]);

      return {
        messages,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.db.error({ error, filters }, 'Failed to find messages');
      throw error;
    }
  }

  static async getStats(dateFrom?: Date, dateTo?: Date): Promise<MessageStats> {
    try {
      const where: Prisma.MessageLogWhereInput = {};
      
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [totalMessages, incomingMessages, outgoingMessages, uniqueUsers] = await Promise.all([
        prisma.messageLog.count({ where }),
        prisma.messageLog.count({ where: { ...where, isIncoming: true } }),
        prisma.messageLog.count({ where: { ...where, isIncoming: false } }),
        prisma.messageLog.findMany({
          where,
          select: { userId: true },
          distinct: ['userId'],
        }).then(result => result.length),
      ]);

      // Get top intents
      const intentStats = await prisma.messageLog.groupBy({
        by: ['intent'],
        where: {
          ...where,
          intent: { not: null },
          isIncoming: true,
        },
        _count: { intent: true },
        orderBy: { _count: { intent: 'desc' } },
        take: 10,
      });

      const topIntents = intentStats.map(stat => ({
        intent: stat.intent || 'unknown',
        count: stat._count.intent,
      }));

      // Get daily stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyStats = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>(
        Prisma.sql`
          SELECT 
            DATE("createdAt") as date,
            COUNT(*) as count
          FROM "MessageLog"
          WHERE "createdAt" >= ${thirtyDaysAgo}
          GROUP BY DATE("createdAt")
          ORDER BY date DESC
          LIMIT 30
        `
      );

      return {
        totalMessages,
        incomingMessages,
        outgoingMessages,
        uniqueUsers,
        topIntents,
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          count: Number(stat.count),
        })),
      };
    } catch (error) {
      logger.db.error({ error }, 'Failed to get message stats');
      throw error;
    }
  }

  static async getRecentMessages(limit = 10): Promise<MessageLog[]> {
    try {
      return await prisma.messageLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get recent messages');
      throw error;
    }
  }

  static async getUserMessageHistory(
    userId: string,
    limit = 20
  ): Promise<MessageLog[]> {
    try {
      return await prisma.messageLog.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.db.error({ error, userId }, 'Failed to get user message history');
      throw error;
    }
  }

  static async deleteOldMessages(olderThanDays = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.messageLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.db.info({ deletedCount: result.count, cutoffDate }, 'Old messages deleted');
      return result.count;
    } catch (error) {
      logger.db.error({ error, olderThanDays }, 'Failed to delete old messages');
      throw error;
    }
  }
}