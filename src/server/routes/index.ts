import { Router } from 'express';
import healthRoutes from './health.js';
import configRoutes from './config.js';
import messageRoutes from './messages.js';
import knowledgeRoutes from './knowledge.js';
import scheduleRoutes from './schedules.js';

const router = Router();

// Mount all route modules
router.use('/health', healthRoutes);
router.use('/config', configRoutes);
router.use('/messages', messageRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/schedules', scheduleRoutes);

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Bot API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      config: '/config',
      messages: '/messages',
      knowledge: '/knowledge',
      schedules: '/schedules',
    },
  });
});

export default router;