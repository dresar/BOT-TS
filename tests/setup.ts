import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock Prisma client
vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    messageLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    knowledgeItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    schedule: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    config: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
    wa: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    api: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    db: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    intent: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

// Mock environment variables
vi.mock('../src/config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/dbname',
    WHATSAPP_API_KEY: 'test-api-key',
    PORT: 3000,
    HOST: '0.0.0.0',
    NODE_ENV: 'test',
    TIMEZONE: 'Asia/Jakarta',
    VILLAGE_CONTACT_PHONE: '+6281234567890',
    WHATSAPP_ENABLED: false,
    CORS_ORIGIN: '*',
    CORS_CREDENTIALS: false,
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_WA_WINDOW_MS: 60000,
    RATE_LIMIT_WA_MAX_REQUESTS: 10,
    LOG_LEVEL: 'silent',
    LOG_FILE_ENABLED: false,
    LOG_FILE_PATH: './logs/test.log',
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  getDatabaseProvider: vi.fn(() => 'postgresql'),
  formatWhatsAppJID: vi.fn((phone: string) => `${phone}@s.whatsapp.net`),
  validatePhoneNumber: vi.fn(() => true),
  normalizePhoneNumber: vi.fn((phone: string) => phone.replace(/\D/g, '')),
  getRateLimitConfig: vi.fn(() => ({
    windowMs: 900000,
    max: 100,
    message: 'Too many requests',
  })),
  getCorsConfig: vi.fn(() => ({
    origin: '*',
    credentials: false,
  })),
  getLoggerConfig: vi.fn(() => ({
    level: 'silent',
    transport: undefined,
  })),
}));

// Mock WhatsApp client
vi.mock('../src/wa/client.js', () => ({
  WhatsAppClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    sendMessage: vi.fn(),
    isConnected: vi.fn(() => true),
    getQRCode: vi.fn(() => 'mock-qr-code'),
    disconnect: vi.fn(),
  })),
}));

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/dbname';
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterAll(async () => {
  // Cleanup after all tests
  vi.restoreAllMocks();
});