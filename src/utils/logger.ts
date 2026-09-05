import pino from 'pino';
import { getLoggerConfig } from '../config/env.js';

// Create logger instance
const logger = pino(getLoggerConfig());

// Request ID generator
export const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Create child logger with request ID
export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId });
};

// WhatsApp event logger
export const createWhatsAppLogger = () => {
  return logger.child({ component: 'whatsapp' });
};

// API logger
export const createApiLogger = () => {
  return logger.child({ component: 'api' });
};

// Database logger
export const createDatabaseLogger = () => {
  return logger.child({ component: 'database' });
};

// Intent router logger
export const createIntentLogger = () => {
  return logger.child({ component: 'intent-router' });
};

// Sanitize sensitive data for logging
export const sanitizeForLog = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLog(sanitized[key]);
    }
  }

  return sanitized;
};

// Log WhatsApp message (with sanitization)
export const logWhatsAppMessage = (
  direction: 'incoming' | 'outgoing',
  from: string,
  to: string,
  message: string,
  metadata?: any
) => {
  const waLogger = createWhatsAppLogger();
  
  waLogger.info({
    direction,
    from: from.replace(/@.*/, '@***'), // Partially hide JID
    to: to.replace(/@.*/, '@***'),
    messageLength: message.length,
    messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
    metadata: sanitizeForLog(metadata),
  }, `WhatsApp message ${direction}`);
};

// Log API request
export const logApiRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId: string,
  userAgent?: string
) => {
  const apiLogger = createApiLogger();
  
  apiLogger.info({
    method,
    path,
    statusCode,
    duration,
    requestId,
    userAgent,
  }, 'API request completed');
};

// Log intent classification
export const logIntentClassification = (
  text: string,
  intent: string,
  confidence: number,
  from: string
) => {
  const intentLogger = createIntentLogger();
  
  intentLogger.info({
    textLength: text.length,
    textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    intent,
    confidence,
    from: from.replace(/@.*/, '@***'),
  }, 'Intent classified');
};

// Error logging with context
export const logError = (
  error: Error,
  context: string,
  metadata?: any
) => {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    metadata: sanitizeForLog(metadata),
  }, `Error in ${context}`);
};

// Performance logging
export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: any
) => {
  logger.info({
    operation,
    duration,
    metadata: sanitizeForLog(metadata),
  }, 'Performance metric');
};

export default logger;