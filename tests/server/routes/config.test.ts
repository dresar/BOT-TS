import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { configRouter } from '../../../src/server/routes/config.js';
import { ConfigRepository } from '../../../src/db/repo/index.js';

// Mock dependencies
vi.mock('../../../src/db/repo/index.js');
vi.mock('../../../src/middleware/auth.js', () => ({
  apiKeyAuth: vi.fn((req, res, next) => next()),
}));

const app = express();
app.use(express.json());
app.use('/config', configRouter);

describe('Config Routes', () => {
  let mockConfigRepo: vi.Mocked<ConfigRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfigRepo = {
      findByFilters: vi.fn(),
      findByKey: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getOfficeHours: vi.fn(),
      getContactInfo: vi.fn(),
      getBotSettings: vi.fn(),
    } as any;

    vi.mocked(ConfigRepository).mockImplementation(() => mockConfigRepo);
  });

  describe('GET /config', () => {
    const mockConfigs = [
      {
        id: 1,
        key: 'office_hours_start',
        value: '08:00',
        description: 'Office opening time',
        category: 'OFFICE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        key: 'office_hours_end',
        value: '16:00',
        description: 'Office closing time',
        category: 'OFFICE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return all configurations', async () => {
      mockConfigRepo.findByFilters.mockResolvedValue({
        data: mockConfigs,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should filter configurations by search query', async () => {
      const filteredConfigs = [mockConfigs[0]];
      mockConfigRepo.findByFilters.mockResolvedValue({
        data: filteredConfigs,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/config?search=office_hours_start')
        .expect(200);

      expect(mockConfigRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'office_hours_start',
        })
      );
      expect(response.body.data.data).toHaveLength(1);
    });

    it('should filter configurations by category', async () => {
      mockConfigRepo.findByFilters.mockResolvedValue({
        data: mockConfigs,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/config?category=OFFICE')
        .expect(200);

      expect(mockConfigRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'OFFICE',
        })
      );
    });

    it('should handle pagination', async () => {
      mockConfigRepo.findByFilters.mockResolvedValue({
        data: [mockConfigs[0]],
        total: 2,
        page: 2,
        limit: 1,
        totalPages: 2,
      });

      const response = await request(app)
        .get('/config?page=2&limit=1')
        .expect(200);

      expect(mockConfigRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 1,
        })
      );
      expect(response.body.data.page).toBe(2);
    });

    it('should handle repository errors', async () => {
      mockConfigRepo.findByFilters.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/config')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database error');
    });
  });

  describe('GET /config/:key', () => {
    const mockConfig = {
      id: 1,
      key: 'office_hours_start',
      value: '08:00',
      description: 'Office opening time',
      category: 'OFFICE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return configuration by key', async () => {
      mockConfigRepo.findByKey.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/config/office_hours_start')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe('office_hours_start');
      expect(response.body.data.value).toBe('08:00');
    });

    it('should return 404 for non-existent key', async () => {
      mockConfigRepo.findByKey.mockResolvedValue(null);

      const response = await request(app)
        .get('/config/non_existent_key')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /config', () => {
    const newConfig = {
      key: 'new_setting',
      value: 'new_value',
      description: 'A new setting',
      category: 'GENERAL',
    };

    it('should create new configuration', async () => {
      const createdConfig = {
        id: 1,
        ...newConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockConfigRepo.create.mockResolvedValue(createdConfig);

      const response = await request(app)
        .post('/config')
        .send(newConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe('new_setting');
      expect(mockConfigRepo.create).toHaveBeenCalledWith(newConfig);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/config')
        .send({ value: 'missing_key' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should validate category enum', async () => {
      const response = await request(app)
        .post('/config')
        .send({
          key: 'test_key',
          value: 'test_value',
          category: 'INVALID_CATEGORY',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle repository errors', async () => {
      mockConfigRepo.create.mockRejectedValue(new Error('Duplicate key'));

      const response = await request(app)
        .post('/config')
        .send(newConfig)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /config/:key', () => {
    const updateData = {
      value: 'updated_value',
      description: 'Updated description',
    };

    it('should update existing configuration', async () => {
      const updatedConfig = {
        id: 1,
        key: 'test_key',
        value: 'updated_value',
        description: 'Updated description',
        category: 'GENERAL',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockConfigRepo.update.mockResolvedValue(updatedConfig);

      const response = await request(app)
        .put('/config/test_key')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('updated_value');
      expect(mockConfigRepo.update).toHaveBeenCalledWith('test_key', updateData);
    });

    it('should return 404 for non-existent key', async () => {
      mockConfigRepo.update.mockResolvedValue(null);

      const response = await request(app)
        .put('/config/non_existent')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .put('/config/test_key')
        .send({ category: 'INVALID_CATEGORY' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /config/:key', () => {
    it('should delete configuration', async () => {
      mockConfigRepo.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/config/test_key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
      expect(mockConfigRepo.delete).toHaveBeenCalledWith('test_key');
    });

    it('should return 404 for non-existent key', async () => {
      mockConfigRepo.delete.mockResolvedValue(false);

      const response = await request(app)
        .delete('/config/non_existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Public Endpoints', () => {
    describe('GET /config/public/office-hours', () => {
      it('should return office hours', async () => {
        const officeHours = {
          start: '08:00',
          end: '16:00',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        };
        mockConfigRepo.getOfficeHours.mockResolvedValue(officeHours);

        const response = await request(app)
          .get('/config/public/office-hours')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(officeHours);
      });

      it('should handle missing office hours', async () => {
        mockConfigRepo.getOfficeHours.mockResolvedValue(null);

        const response = await request(app)
          .get('/config/public/office-hours')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /config/public/contact', () => {
      it('should return contact information', async () => {
        const contactInfo = {
          phone: '+6281234567890',
          email: 'admin@desa.go.id',
          address: 'Jl. Desa No. 1',
        };
        mockConfigRepo.getContactInfo.mockResolvedValue(contactInfo);

        const response = await request(app)
          .get('/config/public/contact')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(contactInfo);
      });
    });

    describe('GET /config/public/bot-settings', () => {
      it('should return bot settings', async () => {
        const botSettings = {
          welcomeMessage: 'Selamat datang!',
          helpMessage: 'Ketik /help untuk bantuan',
          outOfScopeMessage: 'Maaf, saya tidak mengerti',
        };
        mockConfigRepo.getBotSettings.mockResolvedValue(botSettings);

        const response = await request(app)
          .get('/config/public/bot-settings')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(botSettings);
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate pagination parameters', async () => {
      mockConfigRepo.findByFilters.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const response = await request(app)
        .get('/config?page=0&limit=101')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate search parameter length', async () => {
      const response = await request(app)
        .get('/config?search=a') // Too short
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate configuration key format', async () => {
      const response = await request(app)
        .post('/config')
        .send({
          key: 'invalid key with spaces',
          value: 'test',
          category: 'GENERAL',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/config')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle database connection errors', async () => {
      mockConfigRepo.findByFilters.mockRejectedValue(new Error('Connection timeout'));

      const response = await request(app)
        .get('/config')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Connection timeout');
    });
  });
});