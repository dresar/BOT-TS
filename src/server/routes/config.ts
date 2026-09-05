import { Router, Request, Response } from 'express';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { validateSchema, validateParams, apiKeyAuth } from '../../middlewares/index.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const configKeySchema = z.object({
  key: z.string().min(1, 'Config key is required'),
});

const updateConfigSchema = z.object({
  value: z.string().min(1, 'Config value is required'),
  description: z.string().optional(),
});

const createConfigSchema = z.object({
  key: z.string().min(1, 'Config key is required'),
  value: z.string().min(1, 'Config value is required'),
  description: z.string().optional(),
});

const configQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
});

/**
 * GET /config
 * Get all configuration items
 */
router.get('/', 
  validateSchema(configQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { search, limit, offset } = req.query as any;
      
      const where = search ? {
        OR: [
          { key: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {};
      
      const [configs, total] = await Promise.all([
        prisma.config.findMany({
          where,
          orderBy: { key: 'asc' },
          take: limit,
          skip: offset,
        }),
        prisma.config.count({ where }),
      ]);
      
      res.json({
        success: true,
        data: {
          configs,
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
      }, 'Failed to get configs');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get configurations',
      });
    }
  }
);

/**
 * GET /config/:key
 * Get specific configuration by key
 */
router.get('/:key',
  validateParams(configKeySchema),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      
      const config = await prisma.config.findUnique({
        where: { key },
      });
      
      if (!config) {
        res.status(404).json({
          success: false,
          error: 'Configuration not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: config,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        key: req.params.key,
      }, 'Failed to get config');
      
      res.status(500).json({
        success: false,
        error: 'Failed to get configuration',
      });
    }
  }
);

/**
 * POST /config
 * Create new configuration
 */
router.post('/',
  apiKeyAuth,
  validateSchema(createConfigSchema),
  async (req: Request, res: Response) => {
    try {
      const { key, value, description } = req.body;
      
      // Check if config already exists
      const existingConfig = await prisma.config.findUnique({
        where: { key },
      });
      
      if (existingConfig) {
        res.status(409).json({
          success: false,
          error: 'Configuration already exists',
        });
        return;
      }
      
      const config = await prisma.config.create({
        data: {
          key,
          value,
          description,
        },
      });
      
      logger.info({
        requestId: req.requestId,
        configKey: key,
      }, 'Configuration created');
      
      res.status(201).json({
        success: true,
        data: config,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        configKey: req.body?.key,
      }, 'Failed to create config');
      
      res.status(500).json({
        success: false,
        error: 'Failed to create configuration',
      });
    }
  }
);

/**
 * PUT /config/:key
 * Update configuration
 */
router.put('/:key',
  apiKeyAuth,
  validateParams(configKeySchema),
  validateSchema(updateConfigSchema),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      
      // Check if config exists
      const existingConfig = await prisma.config.findUnique({
        where: { key },
      });
      
      if (!existingConfig) {
        res.status(404).json({
          success: false,
          error: 'Configuration not found',
        });
        return;
      }
      
      const config = await prisma.config.update({
        where: { key },
        data: {
          value,
          description: description !== undefined ? description : existingConfig.description,
          updatedAt: new Date(),
        },
      });
      
      logger.info({
        requestId: req.requestId,
        configKey: key,
        oldValue: existingConfig.value,
        newValue: value,
      }, 'Configuration updated');
      
      res.json({
        success: true,
        data: config,
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        configKey: req.params.key,
      }, 'Failed to update config');
      
      res.status(500).json({
        success: false,
        error: 'Failed to update configuration',
      });
    }
  }
);

/**
 * DELETE /config/:key
 * Delete configuration
 */
router.delete('/:key',
  apiKeyAuth,
  validateParams(configKeySchema),
  async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      
      // Check if config exists
      const existingConfig = await prisma.config.findUnique({
        where: { key },
      });
      
      if (!existingConfig) {
        res.status(404).json({
          success: false,
          error: 'Configuration not found',
        });
        return;
      }
      
      await prisma.config.delete({
        where: { key },
      });
      
      logger.info({
        requestId: req.requestId,
        configKey: key,
      }, 'Configuration deleted');
      
      res.json({
        success: true,
        message: 'Configuration deleted successfully',
      });
      
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        requestId: req.requestId,
        configKey: req.params.key,
      }, 'Failed to delete config');
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete configuration',
      });
    }
  }
);

/**
 * GET /config/public/office-hours
 * Get office hours (public endpoint)
 */
router.get('/public/office-hours', async (req: Request, res: Response) => {
  try {
    const config = await prisma.config.findUnique({
      where: { key: 'office_hours' },
    });
    
    res.json({
      success: true,
      data: {
        officeHours: config?.value || 'Sen–Jum 08.00–16.00 WIB, istirahat 12.00–13.00 WIB',
      },
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get office hours');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get office hours',
    });
  }
});

/**
 * GET /config/public/contact
 * Get contact information (public endpoint)
 */
router.get('/public/contact', async (req: Request, res: Response) => {
  try {
    const config = await prisma.config.findUnique({
      where: { key: 'contact_phone' },
    });
    
    res.json({
      success: true,
      data: {
        phone: config?.value || 'Hubungi kantor desa',
      },
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get contact info');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get contact information',
    });
  }
});

/**
 * GET /config/public/bot-settings
 * Get bot settings (public endpoint)
 */
router.get('/public/bot-settings', async (req: Request, res: Response) => {
  try {
    const configs = await prisma.config.findMany({
      where: {
        key: {
          in: ['bot_name', 'welcome_message', 'help_message'],
        },
      },
    });
    
    const settings = configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string>);
    
    res.json({
      success: true,
      data: {
        botName: settings.bot_name || 'Bot Pelayanan Desa',
        welcomeMessage: settings.welcome_message || 'Selamat datang di Bot Pelayanan Desa!',
        helpMessage: settings.help_message || 'Ketik /help untuk melihat menu bantuan.',
      },
    });
    
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      requestId: req.requestId,
    }, 'Failed to get bot settings');
    
    res.status(500).json({
      success: false,
      error: 'Failed to get bot settings',
    });
  }
});

export default router;