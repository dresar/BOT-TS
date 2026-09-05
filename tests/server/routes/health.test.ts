import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRouter } from '../../../src/server/routes/health.js';
import { prisma } from '../../../src/db/client.js';

// Mock dependencies
vi.mock('../../../src/db/client.js');
vi.mock('../../../src/utils/logger.js');

const app = express();
app.use('/health', healthRouter);

describe('Health Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should return valid timestamp format', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return positive uptime', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status when database is healthy', async () => {
      // Mock successful database connection
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        services: {
          database: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
          whatsapp: {
            status: 'unknown',
            connected: false,
          },
        },
        metrics: {
          totalMessages: expect.any(Number),
          activeUsers: expect.any(Number),
        },
        errors: expect.any(Array),
      });
    });

    it('should return unhealthy status when database fails', async () => {
      // Mock database connection failure
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('unhealthy');
      expect(response.body.services.database.error).toContain('Database connection failed');
    });

    it('should include metrics in response', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(prisma.messageLog.count).mockResolvedValue(150);
      vi.mocked(prisma.user.count).mockResolvedValue(25);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.metrics).toEqual({
        totalMessages: 150,
        activeUsers: 25,
      });
    });

    it('should handle metrics calculation errors', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(prisma.messageLog.count).mockRejectedValue(new Error('Count failed'));
      vi.mocked(prisma.user.count).mockRejectedValue(new Error('Count failed'));

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.metrics).toEqual({
        totalMessages: 0,
        activeUsers: 0,
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when database is accessible', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
        checks: {
          database: true,
        },
      });
    });

    it('should return not ready when database is inaccessible', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toEqual({
        status: 'not ready',
        timestamp: expect.any(String),
        checks: {
          database: false,
        },
        error: 'Database error',
      });
    });
  });

  describe('GET /health/live', () => {
    it('should always return alive status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });

    it('should return consistent uptime values', async () => {
      const response1 = await request(app).get('/health/live');
      
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response2 = await request(app).get('/health/live');

      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
    });
  });

  describe('Database Health Check', () => {
    it('should measure database response time', async () => {
      vi.mocked(prisma.$queryRaw).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([{ result: 1 }]), 50);
        });
      });

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.services.database.responseTime).toBeGreaterThan(40);
    });

    it('should handle database timeout', async () => {
      vi.mocked(prisma.$queryRaw).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body.services.database.status).toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error in the health check
      vi.mocked(prisma.$queryRaw).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('unhealthy');
    });

    it('should return proper error structure', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services.database).toHaveProperty('error');
    });
  });

  describe('Response Headers', () => {
    it('should set correct content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should include cache control headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Health endpoints should not be cached
      expect(response.headers['cache-control']).toMatch(/no-cache|no-store/);
    });
  });

  describe('Performance', () => {
    it('should respond quickly for basic health check', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    it('should respond within reasonable time for detailed check', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(prisma.messageLog.count).mockResolvedValue(100);
      vi.mocked(prisma.user.count).mockResolvedValue(10);

      const startTime = Date.now();
      
      await request(app)
        .get('/health/detailed')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});