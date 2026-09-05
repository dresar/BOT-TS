import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // API Security
  API_KEY: z.string().min(8, 'API_KEY must be at least 8 characters'),

  // Server Configuration
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Timezone
  TZ: z.string().default('Asia/Jakarta'),

  // Village Contact
  DESA_PHONE: z.string().min(10, 'DESA_PHONE must be at least 10 characters'),

  // Optional: CORS
  CORS_ORIGIN: z.string().optional(),

  // Optional: Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Optional: Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Set timezone
process.env.TZ = env.TZ;

export { env };
export type { Env };

// Helper functions
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';
export const isProduction = (): boolean => env.NODE_ENV === 'production';
export const isTest = (): boolean => env.NODE_ENV === 'test';

// Database helpers
export const getDatabaseProvider = (): 'postgresql' | 'mysql' | 'sqlite' => {
  const url = env.DATABASE_URL.toLowerCase();
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }
  if (url.startsWith('mysql://')) {
    return 'mysql';
  }
  if (url.startsWith('file:') || url.includes('.db')) {
    return 'sqlite';
  }
  return 'postgresql'; // default
};

export const getStoragePath = (): string => {
  return './storage/whatsapp';
};

// Validation helpers
export const validatePhoneNumber = (phone: string): boolean => {
  // Basic Indonesian phone number validation
  const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
};

export const normalizePhoneNumber = (phone: string): string => {
  // Remove spaces and dashes
  let normalized = phone.replace(/[\s-]/g, '');
  
  // Convert to international format
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (normalized.startsWith('+62')) {
    normalized = normalized.slice(1);
  } else if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }
  
  return normalized;
};

// WhatsApp JID helper
export const formatWhatsAppJID = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);
  return `${normalized}@s.whatsapp.net`;
};

// Rate limiting configuration
export const getRateLimitConfig = () => ({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
export const getCorsConfig = () => ({
  origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : false,
  credentials: true,
  optionsSuccessStatus: 200,
});

// Logging configuration
export const getLoggerConfig = () => ({
  level: env.LOG_LEVEL,
  transport: env.LOG_PRETTY && isDevelopment() ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  timestamp: () => `,"time":"${new Date().toISOString()}"`
});