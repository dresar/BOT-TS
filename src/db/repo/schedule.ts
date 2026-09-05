import { Prisma, Schedule, ScheduleType } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../../utils/logger.js';

export interface CreateScheduleData {
  title: string;
  description?: string;
  type: ScheduleType;
  startTime: Date;
  endTime?: Date;
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  isActive?: boolean;
}

export interface UpdateScheduleData {
  title?: string;
  description?: string;
  type?: ScheduleType;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  isActive?: boolean;
}

export interface ScheduleFilters {
  type?: ScheduleType;
  isActive?: boolean;
  isRecurring?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class ScheduleRepository {
  static async create(data: CreateScheduleData): Promise<Schedule> {
    try {
      const schedule = await prisma.schedule.create({
        data: {
          title: data.title,
          description: data.description,
          type: data.type,
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location,
          isRecurring: data.isRecurring ?? false,
          recurringPattern: data.recurringPattern,
          isActive: data.isActive ?? true,
        },
      });
      
      logger.db.info({ scheduleId: schedule.id }, 'Schedule created');
      return schedule;
    } catch (error) {
      logger.db.error({ error, data }, 'Failed to create schedule');
      throw error;
    }
  }

  static async findById(id: string): Promise<Schedule | null> {
    try {
      return await prisma.schedule.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to find schedule by ID');
      throw error;
    }
  }

  static async findMany(
    filters: ScheduleFilters = {},
    page = 1,
    limit = 20
  ): Promise<{ schedules: Schedule[]; total: number; pages: number }> {
    try {
      const where: Prisma.ScheduleWhereInput = {};

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.isRecurring !== undefined) {
        where.isRecurring = filters.isRecurring;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.startTime = {};
        if (filters.dateFrom) {
          where.startTime.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.startTime.lte = filters.dateTo;
        }
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { location: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [schedules, total] = await Promise.all([
        prisma.schedule.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startTime: 'asc' },
        }),
        prisma.schedule.count({ where }),
      ]);

      return {
        schedules,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.db.error({ error, filters }, 'Failed to find schedules');
      throw error;
    }
  }

  static async getUpcoming(limit = 10): Promise<Schedule[]> {
    try {
      const now = new Date();
      
      return await prisma.schedule.findMany({
        where: {
          isActive: true,
          startTime: {
            gte: now,
          },
        },
        take: limit,
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get upcoming schedules');
      throw error;
    }
  }

  static async getToday(): Promise<Schedule[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      return await prisma.schedule.findMany({
        where: {
          isActive: true,
          startTime: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get today\'s schedules');
      throw error;
    }
  }

  static async getByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    try {
      return await prisma.schedule.findMany({
        where: {
          isActive: true,
          OR: [
            {
              startTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              endTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              AND: [
                { startTime: { lte: startDate } },
                { endTime: { gte: endDate } },
              ],
            },
          ],
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error, startDate, endDate }, 'Failed to get schedules by date range');
      throw error;
    }
  }

  static async getByType(type: ScheduleType): Promise<Schedule[]> {
    try {
      return await prisma.schedule.findMany({
        where: {
          type,
          isActive: true,
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error, type }, 'Failed to get schedules by type');
      throw error;
    }
  }

  static async update(id: string, data: UpdateScheduleData): Promise<Schedule> {
    try {
      const schedule = await prisma.schedule.update({
        where: { id },
        data,
      });
      
      logger.db.info({ scheduleId: id }, 'Schedule updated');
      return schedule;
    } catch (error) {
      logger.db.error({ error, id, data }, 'Failed to update schedule');
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await prisma.schedule.delete({
        where: { id },
      });
      
      logger.db.info({ scheduleId: id }, 'Schedule deleted');
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to delete schedule');
      throw error;
    }
  }

  static async toggleActive(id: string): Promise<Schedule> {
    try {
      const current = await this.findById(id);
      if (!current) {
        throw new Error('Schedule not found');
      }

      return await this.update(id, { isActive: !current.isActive });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to toggle schedule status');
      throw error;
    }
  }

  static async getTypeCounts(): Promise<Array<{ type: ScheduleType; count: number }>> {
    try {
      const counts = await prisma.schedule.groupBy({
        by: ['type'],
        where: { isActive: true },
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } },
      });

      return counts.map(count => ({
        type: count.type,
        count: count._count.type,
      }));
    } catch (error) {
      logger.db.error({ error }, 'Failed to get schedule type counts');
      throw error;
    }
  }

  static async getRecurringSchedules(): Promise<Schedule[]> {
    try {
      return await prisma.schedule.findMany({
        where: {
          isRecurring: true,
          isActive: true,
        },
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get recurring schedules');
      throw error;
    }
  }

  static async getConflictingSchedules(
    startTime: Date,
    endTime: Date,
    excludeId?: string
  ): Promise<Schedule[]> {
    try {
      const where: Prisma.ScheduleWhereInput = {
        isActive: true,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gte: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lte: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { startTime: { lte: endTime } },
            ],
          },
        ],
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      return await prisma.schedule.findMany({
        where,
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error, startTime, endTime }, 'Failed to get conflicting schedules');
      throw error;
    }
  }

  static async cleanupPastSchedules(olderThanDays = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.schedule.deleteMany({
        where: {
          isRecurring: false,
          endTime: {
            lt: cutoffDate,
          },
        },
      });

      logger.db.info({ deletedCount: result.count, cutoffDate }, 'Past schedules cleaned up');
      return result.count;
    } catch (error) {
      logger.db.error({ error, olderThanDays }, 'Failed to cleanup past schedules');
      throw error;
    }
  }
}