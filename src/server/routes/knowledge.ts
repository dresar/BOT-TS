import { Router, Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { validateSchema, validateQuery, validateParams, apiKeyAuth } from '../../middlewares/index.js';
import { KnowledgeCategory } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const knowledgeQuerySchema = z.object({
  category: z.nativeEnum(KnowledgeCategory).optional(),
  search: z.string().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
  sortBy: z.enum(['title', 'priority', 'createdAt', 'updatedAt']).optional().default('priority'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const knowledgeIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const createKnowledgeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required'),
  category: z.nativeEnum(KnowledgeCategory),
  keywords: z.array(z.string()).optional().default([]),
  priority: z.number().min(1).max(10).optional().default(5),
  isActive: z.boolean().optional().default(true),
});

const updateKnowledgeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  category: z.nativeEnum(KnowledgeCategory).optional(),
  keywords: z.array(z.string()).optional(),
  priority: z.number().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

const searchKnowledgeSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.nativeEnum(KnowledgeCategory).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
});

/**
 * GET /knowledge
 * Get knowledge items with filtering and pagination
 */
router.get('/',
  validateQuery(knowledgeQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        category,
        search,
        isActive,
        limit,
        offset,
        sortBy,
        sortOrder,
      } = req.query as any;
      
      // Build where clause
      const where: any = {};
      
      if (category) {
        where.category = category;
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive;
      }
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { keywords: { has: search } },
        ];
      }
      
      const [knowledgeItems, total] = await Promise.all([
        prisma.knowledgeItem.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        prisma.knowledgeItem.count({ where }),
      ]);
      
      res.json({
        success: true,
        data: {
          knowledgeItems,
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
      }, 'Failed to get knowledge items');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get knowledge items',
      });
    }
  }
);

/**
 * GET /knowledge/categories
 * Get all available knowledge categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = Object.values(KnowledgeCategory).map(category => ({
      value: category,
      label: getCategoryLabel(category),
      description: getCategoryDescription(category),
    }));
    
    // Get count for each category
    const categoryCounts = await prisma.knowledgeItem.groupBy({
      by: ['category'],
      _count: { category: true },
      where: { isActive: true },
    });
    
    const categoriesWithCounts = categories.map(category => {
      const count = categoryCounts.find(c => c.category === category.value)?._count.category || 0;
      return { ...category, count };
    });
    
    res.json({
      success: true,
      data: categoriesWithCounts,
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get categories');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
    });
  }
});

/**
 * GET /knowledge/search
 * Search knowledge items
 */
router.get('/search',
  validateQuery(searchKnowledgeSchema),
  async (req: Request, res: Response) => {
    try {
      const { query, category, limit } = req.query as any;
      
      const where: any = {
        isActive: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { keywords: { has: query } },
        ],
      };
      
      if (category) {
        where.category = category;
      }
      
      const knowledgeItems = await prisma.knowledgeItem.findMany({
        where,
        orderBy: { priority: 'desc' },
        take: limit,
      });
      
      res.json({
        success: true,
        data: {
          query,
          results: knowledgeItems,
          count: knowledgeItems.length,
        },
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        query: req.query.query,
      }, 'Failed to search knowledge');
      
      res.status(500).json({
        success: false,
        error: 'Failed to search knowledge items',
      });
    }
  }
);

/**
 * GET /knowledge/:id
 * Get specific knowledge item by ID
 */
router.get('/:id',
  validateParams(knowledgeIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const knowledgeItem = await prisma.knowledgeItem.findUnique({
        where: { id: Number(id) },
      });
      
      if (!knowledgeItem) {
        res.status(404).json({
          success: false,
          error: 'Knowledge item not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: knowledgeItem,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        knowledgeId: req.params.id,
      }, 'Failed to get knowledge item');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get knowledge item',
      });
    }
  }
);

/**
 * POST /knowledge
 * Create new knowledge item
 */
router.post('/',
  apiKeyAuth,
  validateSchema(createKnowledgeSchema),
  async (req: Request, res: Response) => {
    try {
      const { title, content, category, keywords, priority, isActive } = req.body;
      
      const knowledgeItem = await prisma.knowledgeItem.create({
        data: {
          title,
          content,
          category,
          keywords,
          priority,
          isActive,
        },
      });
      
      logger.info({
        requestId: req.requestId,
        knowledgeId: knowledgeItem.id,
        category,
        title,
      }, 'Knowledge item created');
      
      res.status(201).json({
        success: true,
        data: knowledgeItem,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        category: req.body?.category,
        title: req.body?.title,
      }, 'Failed to create knowledge item');
      
      res.status(500).json({
        success: false,
        error: 'Failed to create knowledge item',
      });
    }
  }
);

/**
 * PUT /knowledge/:id
 * Update knowledge item
 */
router.put('/:id',
  apiKeyAuth,
  validateParams(knowledgeIdSchema),
  validateSchema(updateKnowledgeSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Check if knowledge item exists
      const existingItem = await prisma.knowledgeItem.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingItem) {
        res.status(404).json({
          success: false,
          error: 'Knowledge item not found',
        });
        return;
      }
      
      const knowledgeItem = await prisma.knowledgeItem.update({
        where: { id: Number(id) },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
      
      logger.info({
        requestId: req.requestId,
        knowledgeId: Number(id),
        updatedFields: Object.keys(updateData),
      }, 'Knowledge item updated');
      
      res.json({
        success: true,
        data: knowledgeItem,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        knowledgeId: req.params.id,
      }, 'Failed to update knowledge item');
      
      res.status(500).json({
        success: false,
        error: 'Failed to update knowledge item',
      });
    }
  }
);

/**
 * DELETE /knowledge/:id
 * Delete knowledge item
 */
router.delete('/:id',
  apiKeyAuth,
  validateParams(knowledgeIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if knowledge item exists
      const existingItem = await prisma.knowledgeItem.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingItem) {
        res.status(404).json({
          success: false,
          error: 'Knowledge item not found',
        });
        return;
      }
      
      await prisma.knowledgeItem.delete({
        where: { id: Number(id) },
      });
      
      logger.info({
        requestId: req.requestId,
        knowledgeId: Number(id),
        title: existingItem.title,
      }, 'Knowledge item deleted');
      
      res.json({
        success: true,
        message: 'Knowledge item deleted successfully',
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        knowledgeId: req.params.id,
      }, 'Failed to delete knowledge item');
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete knowledge item',
      });
    }
  }
);

/**
 * PATCH /knowledge/:id/toggle
 * Toggle knowledge item active status
 */
router.patch('/:id/toggle',
  apiKeyAuth,
  validateParams(knowledgeIdSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const existingItem = await prisma.knowledgeItem.findUnique({
        where: { id: Number(id) },
      });
      
      if (!existingItem) {
        res.status(404).json({
          success: false,
          error: 'Knowledge item not found',
        });
        return;
      }
      
      const knowledgeItem = await prisma.knowledgeItem.update({
        where: { id: Number(id) },
        data: {
          isActive: !existingItem.isActive,
          updatedAt: new Date(),
        },
      });
      
      logger.info({
        requestId: req.requestId,
        knowledgeId: Number(id),
        newStatus: knowledgeItem.isActive,
      }, 'Knowledge item status toggled');
      
      res.json({
        success: true,
        data: knowledgeItem,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        knowledgeId: req.params.id,
      }, 'Failed to toggle knowledge item');
      
      res.status(500).json({
        success: false,
        error: 'Failed to toggle knowledge item',
      });
    }
  }
);

/**
 * Helper function to get category label
 */
function getCategoryLabel(category: KnowledgeCategory): string {
  const labels: Record<KnowledgeCategory, string> = {
    [KnowledgeCategory.ADMIN_KTP]: 'KTP & E-KTP',
    [KnowledgeCategory.ADMIN_KK]: 'Kartu Keluarga',
    [KnowledgeCategory.ADMIN_PINDAH]: 'Surat Pindah',
    [KnowledgeCategory.ADMIN_AKTA]: 'Akta Kelahiran/Kematian',
    [KnowledgeCategory.SOS_BANSOS]: 'Bantuan Sosial',
    [KnowledgeCategory.POSYANDU]: 'Posyandu & Kesehatan',
    [KnowledgeCategory.KEUANGAN_PBB]: 'Pajak Bumi Bangunan',
    [KnowledgeCategory.KEUANGAN_SAMPAH]: 'Retribusi Sampah',
    [KnowledgeCategory.UMUM_JAM]: 'Jam Operasional',
    [KnowledgeCategory.UMUM_KONTAK]: 'Kontak & Informasi',
  };
  
  return labels[category] || category;
}

/**
 * Helper function to get category description
 */
function getCategoryDescription(category: KnowledgeCategory): string {
  const descriptions: Record<KnowledgeCategory, string> = {
    [KnowledgeCategory.ADMIN_KTP]: 'Informasi tentang pembuatan dan perpanjangan KTP',
    [KnowledgeCategory.ADMIN_KK]: 'Informasi tentang pengurusan Kartu Keluarga',
    [KnowledgeCategory.ADMIN_PINDAH]: 'Informasi tentang surat pindah domisili',
    [KnowledgeCategory.ADMIN_AKTA]: 'Informasi tentang akta kelahiran dan kematian',
    [KnowledgeCategory.SOS_BANSOS]: 'Informasi tentang bantuan sosial dan program pemerintah',
    [KnowledgeCategory.POSYANDU]: 'Informasi tentang jadwal dan layanan Posyandu',
    [KnowledgeCategory.KEUANGAN_PBB]: 'Informasi tentang pembayaran Pajak Bumi Bangunan',
    [KnowledgeCategory.KEUANGAN_SAMPAH]: 'Informasi tentang retribusi sampah',
    [KnowledgeCategory.UMUM_JAM]: 'Informasi jam operasional kantor desa',
    [KnowledgeCategory.UMUM_KONTAK]: 'Informasi kontak dan alamat kantor desa',
  };
  
  return descriptions[category] || 'Informasi umum';
}

export default router;