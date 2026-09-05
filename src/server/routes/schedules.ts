import { Router, Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { validateSchema, validateQuery, validateParams, apiKeyAuth } from '../../middlewares/index.js';
import { ScheduleType } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const scheduleQuerySchema = z.object({
  type: z.nativeEnum(ScheduleType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  upcoming: z.string().transform(val => val === 'true').optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
  sortBy: z.enum(['title', 'scheduledDate', 'createdAt']).optional().default('scheduledDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const scheduleIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const createScheduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  type: z.nativeEnum(ScheduleType),
  scheduledDate: z.string().datetime(),
  location: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  isRecurring: z.boolean().optional().default(false),
  recurringPattern: z.string().optional(),
});

const updateScheduleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().optional(),
  type: z.nativeEnum(ScheduleType).optional(),
  scheduledDate: z.string().datetime().optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
});

/**
 * GET /schedules
 * Get schedules with filtering and pagination
 */
router.get('/',
  validateQuery(scheduleQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        type,
        startDate,
        endDate,
        isActive,
        upcoming,
        limit,
        offset,
        sortBy,
        sortOrder,
      } = req.query as any;
      
      // Build where clause
      const where: any = {};
      
      if (type) {
        where.type = type;
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive;
      }
      
      if (upcoming) {
        where.scheduledDate = { gte: new Date() };
      } else if (startDate || endDate) {
        where.scheduledDate = {};
        if (startDate) where.scheduledDate.gte = new Date(startDate);
        if (endDate) where.scheduledDate.lte = new Date(endDate);
      }
      
      const [schedules, total] = await Promise.all([
        prisma.schedule.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        prisma.schedule.count({ where }),
      ]);
      
      res.json({
        success: true,
        data: {
          schedules,
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
      }, 'Failed to get schedules');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get schedules',
      });
    }
  }
);

/**
 * GET /schedules/types
 * Get all available schedule types
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    const types = Object.values(ScheduleType).map(type => ({
      value: type,
      label: getTypeLabel(type),
      description: getTypeDescription(type),
    }));
    
    // Get count for each type
    const typeCounts = await prisma.schedule.groupBy({
      by: ['type'],
      _count: { type: true },
      where: { isActive: true },
    });
    
    const typesWithCounts = types.map(type => {
      const count = typeCounts.find(c => c.type === type.value)?._count.type || 0;
      return { ...type, count };
    });
    
    res.json({
      success: true,
      data: typesWithCounts,
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get schedule types');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get schedule types',
    });
  }
});

/**
 * GET /schedules/upcoming
 * Get upcoming schedules (public endpoint)
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as ScheduleType;
    
    const where: any = {
      isActive: true,
      scheduledDate: { gte: new Date() },
    };
    
    if (type) {
      where.type = type;
    }
    
    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { scheduledDate: 'asc' },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        scheduledDate: true,
        location: true,
      },
    });
    
    res.json({
      success: true,
      data: schedules,
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get upcoming schedules');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get upcoming schedules',
    });
  }
});

/**
 * GET /schedules/today
 * Get today's schedules (public endpoint)
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const schedules = await prisma.schedule.findMany({
      where: {
        isActive: true,
        scheduledDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: { scheduledDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        scheduledDate: true,
        location: true,
      },
    });
    
    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        schedules,
        count: schedules.length,
      },
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get today schedules');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get today schedules',
    });
  }
});

/**
 * GET /schedules/:id
 * Get specific schedule by ID
 */
router.get('/:id',
  validateParams(scheduleIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const schedule = await prisma.schedule.findUnique({
        where: { id: Number(id) },
      });
      
      if (!schedule) {
        res.status(404).json({
          success: false,
          error: 'Schedule not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: schedule,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        scheduleId: req.params.id,
      }, 'Failed to get schedule');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get schedule',
      });
    }
  }
);

/**
 * POST /schedules
 * Create new schedule
 */
router.post('/',
  apiKeyAuth,
  validateSchema(createScheduleSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        title,
        description,
        type,
        scheduledDate,
        location,
        isActive,
        isRecurring,
        recurringPattern,
      } = req.body;
      
      const schedule = await prisma.schedule.create({
        data: {
          title,
          description,
          type,
          scheduledDate: new Date(scheduledDate),
          location,
          isActive,
          isRecurring,
          recurringPattern,
        },
      });
      
      logger.info({
        requestId: req.requestId,
        scheduleId: schedule.id,
        type,
        title,
        scheduledDate,
      }, 'Schedule created');
      
      res.status(201).json({
        success: true,
        data: schedule,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        type: req.body?.type,
        title: req.body?.title,
      }, 'Failed to create schedule');
      
      res.status(500).json({
        success: false,
        error: 'Failed to create schedule',
      });
    }
  }
);

/**
 * PUT /schedules/:id
 * Update schedule
 */
router.put('/:id',
  apiKeyAuth,
  validateParams(scheduleIdSchema),
  validateSchema(updateScheduleSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Check if schedule exists
      const existingSchedule = await prisma.schedule.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingSchedule) {
        res.status(404).json({
          success: false,
          error: 'Schedule not found',
        });
        return;
      }
      
      // Convert scheduledDate if provided
      if (updateData.scheduledDate) {
        updateData.scheduledDate = new Date(updateData.scheduledDate);
      }
      
      const schedule = await prisma.schedule.update({
        where: { id: Number(id) },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
      
      logger.info({
        requestId: req.requestId,
        scheduleId: Number(id),
        updatedFields: Object.keys(updateData),
      }, 'Schedule updated');
      
      res.json({
        success: true,
        data: schedule,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        scheduleId: req.params.id,
      }, 'Failed to update schedule');
      
      res.status(500).json({
        success: false,
        error: 'Failed to update schedule',
      });
    }
  }
);

/**
 * DELETE /schedules/:id
 * Delete schedule
 */
router.delete('/:id',
  apiKeyAuth,
  validateParams(scheduleIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if schedule exists
      const existingSchedule = await prisma.schedule.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingSchedule) {
        res.status(404).json({
          success: false,
          error: 'Schedule not found',
        });
        return;
      }
      
      await prisma.schedule.delete({
        where: { id: Number(id) },
      });
      
      logger.info({
        requestId: req.requestId,
        scheduleId: Number(id),
        title: existingSchedule.title,
      }, 'Schedule deleted');
      
      res.json({
        success: true,
        message: 'Schedule deleted successfully',
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        scheduleId: req.params.id,
      }, 'Failed to delete schedule');
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete schedule',
      });
    }
  }
);

/**
 * PATCH /schedules/:id/toggle
 * Toggle schedule active status
 */
router.patch('/:id/toggle',
  apiKeyAuth,
  validateParams(scheduleIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const existingSchedule = await prisma.schedule.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingSchedule) {
        res.status(404).json({
          success: false,
          error: 'Schedule not found',
        });
        return;
      }
      
      const schedule = await prisma.schedule.update({
        where: { id: Number(id) },
        data: {
          isActive: !existingSchedule.isActive,
          updatedAt: new Date(),
        },
      });
      
      logger.info({
        requestId: req.requestId,
        scheduleId: Number(id),
        newStatus: schedule.isActive,
      }, 'Schedule status toggled');
      
      res.json({
        success: true,
        data: schedule,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        scheduleId: req.params.id,
      }, 'Failed to toggle schedule');
      
      res.status(500).json({
        success: false,
        error: 'Failed to toggle schedule',
      });
    }
  }
);

/**
 * Helper function to get type label
 */
function getTypeLabel(type: ScheduleType): string {
  const labels: Record<ScheduleType, string> = {
    [ScheduleType.POSYANDU]: 'Posyandu',
    [ScheduleType.MEETING]: 'Rapat',
    [ScheduleType.EVENT]: 'Acara',
    [ScheduleType.HOLIDAY]: 'Libur',
    [ScheduleType.MAINTENANCE]: 'Pemeliharaan',
  };
  
  return labels[type] || type;
}

/**
 * Helper function to get type description
 */
function getTypeDescription(type: ScheduleType): string {
  const descriptions: Record<ScheduleType, string> = {
    [ScheduleType.POSYANDU]: 'Jadwal pemeriksaan kesehatan balita dan ibu',
    [ScheduleType.MEETING]: 'Rapat desa dan pertemuan resmi',
    [ScheduleType.EVENT]: 'Acara dan kegiatan desa',
    [ScheduleType.HOLIDAY]: 'Hari libur dan cuti kantor',
    [ScheduleType.MAINTENANCE]: 'Pemeliharaan fasilitas dan sistem',
  };
  
  return descriptions[type] || 'Jadwal umum';
}

export default router;