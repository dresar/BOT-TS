import { WAMessage, proto } from '@baileys/baileys';
import { intentClassifier } from './intents.js';
import { responseTemplateManager } from './templates.js';
import { logger } from '../utils/logger.js';
import { whatsappRateLimit } from '../utils/rate-limiter.js';
import { prisma } from '../db/prisma.js';
import { KnowledgeCategory } from '@prisma/client';

export interface MessageContext {
  messageId: string;
  from: string;
  timestamp: Date;
  messageText: string;
  isGroup: boolean;
  groupId?: string;
  participantId?: string;
}

export interface HandlerResponse {
  success: boolean;
  response?: string;
  intent?: string;
  confidence?: number;
  rateLimited?: boolean;
  error?: string;
}

export class MessageHandler {
  private readonly logger = logger.child({ component: 'MessageHandler' });

  /**
   * Process incoming WhatsApp message
   */
  async handleMessage(
    message: WAMessage,
    context: MessageContext
  ): Promise<HandlerResponse> {
    try {
      // Log incoming message
      this.logger.info({
        messageId: context.messageId,
        from: context.from,
        isGroup: context.isGroup,
        messageLength: context.messageText.length,
      }, 'Processing incoming message');

      // Check rate limiting
      const rateLimitCheck = whatsappRateLimit.checkAllowance(context.from);
      if (!rateLimitCheck.allowed) {
        this.logger.warn({
          from: context.from,
          resetTime: rateLimitCheck.resetTime,
        }, 'Rate limit exceeded');
        
        return {
          success: false,
          rateLimited: true,
          error: 'Rate limit exceeded',
        };
      }

      // Handle special commands
      const specialResponse = await this.handleSpecialCommands(context.messageText);
      if (specialResponse) {
        await this.logMessage(context, specialResponse.intent!, specialResponse.response!, specialResponse.confidence);
        return specialResponse;
      }

      // Classify intent
      const classification = await intentClassifier.classifyMessage(context.messageText);
      
      this.logger.info({
        messageId: context.messageId,
        intent: classification.intent,
        confidence: classification.confidence,
        keywords: classification.matchedKeywords,
      }, 'Message classified');

      // Get response from template
      const response = await this.generateResponse(
        classification.intent,
        classification.confidence,
        context
      );

      // Log message to database
      await this.logMessage(
        context,
        classification.intent,
        response,
        classification.confidence
      );

      return {
        success: true,
        response,
        intent: classification.intent,
        confidence: classification.confidence,
      };

    } catch (error) {
      this.logger.error({
        messageId: context.messageId,
        from: context.from,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error handling message');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: await responseTemplateManager.getOutOfScopeMessage(),
      };
    }
  }

  /**
   * Handle special commands like /help, /start
   */
  private async handleSpecialCommands(messageText: string): Promise<HandlerResponse | null> {
    const normalizedText = messageText.toLowerCase().trim();

    if (normalizedText === '/help' || normalizedText === 'help') {
      return {
        success: true,
        response: await responseTemplateManager.getHelpMessage(),
        intent: 'HELP',
        confidence: 1.0,
      };
    }

    if (normalizedText === '/start' || normalizedText === 'start' || normalizedText === 'halo' || normalizedText === 'hai') {
      return {
        success: true,
        response: await responseTemplateManager.getWelcomeMessage(),
        intent: 'START',
        confidence: 1.0,
      };
    }

    return null;
  }

  /**
   * Generate response based on intent and confidence
   */
  private async generateResponse(
    intent: string,
    confidence: number,
    context: MessageContext
  ): Promise<string> {
    // If confidence is too low, ask for clarification
    if (confidence < 0.3) {
      return responseTemplateManager.getClarificationMessage();
    }

    // Try to get knowledge from database first
    const knowledgeResponse = await this.getKnowledgeResponse(intent, context.messageText);
    if (knowledgeResponse) {
      return knowledgeResponse;
    }

    // Fall back to template response
    return responseTemplateManager.getResponse(intent, {
      userMessage: context.messageText,
      timestamp: context.timestamp.toISOString(),
    });
  }

  /**
   * Get response from knowledge database
   */
  private async getKnowledgeResponse(
    intent: string,
    messageText: string
  ): Promise<string | null> {
    try {
      // Map intent to knowledge category
      const categoryMap: { [key: string]: KnowledgeCategory } = {
        'ADMIN_KTP': KnowledgeCategory.ADMIN_KTP,
        'ADMIN_KK': KnowledgeCategory.ADMIN_KK,
        'ADMIN_PINDAH': KnowledgeCategory.ADMIN_PINDAH,
        'ADMIN_AKTA': KnowledgeCategory.ADMIN_AKTA,
        'SOS_BANSOS': KnowledgeCategory.SOS_BANSOS,
        'POSYANDU': KnowledgeCategory.POSYANDU,
        'KEUANGAN_PBB': KnowledgeCategory.KEUANGAN_PBB,
        'KEUANGAN_SAMPAH': KnowledgeCategory.KEUANGAN_SAMPAH,
        'UMUM_JAM': KnowledgeCategory.UMUM_JAM,
        'UMUM_KONTAK': KnowledgeCategory.UMUM_KONTAK,
      };

      const category = categoryMap[intent];
      if (!category) {
        return null;
      }

      // Search for relevant knowledge items
      const knowledgeItems = await prisma.knowledgeItem.findMany({
        where: {
          category,
          isActive: true,
        },
        orderBy: {
          priority: 'desc',
        },
        take: 3, // Limit to top 3 most relevant items
      });

      if (knowledgeItems.length === 0) {
        return null;
      }

      // For now, return the highest priority item
      // In the future, we could implement more sophisticated matching
      const bestMatch = knowledgeItems[0];
      return bestMatch?.content || null;

    } catch (error) {
      this.logger.error({
        intent,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error getting knowledge response');
      return null;
    }
  }

  /**
   * Log message to database
   */
  private async logMessage(
    context: MessageContext,
    intent: string,
    response: string,
    confidence?: number
  ): Promise<void> {
    try {
      await prisma.messageLog.create({
        data: {
          messageId: context.messageId,
          fromNumber: context.from,
          messageText: context.messageText,
          intent,
          confidence: confidence || 0,
          response,
          timestamp: context.timestamp,
          isGroup: context.isGroup,
          groupId: context.groupId,
          participantId: context.participantId,
        },
      });

      this.logger.debug({
        messageId: context.messageId,
        intent,
        confidence,
      }, 'Message logged to database');

    } catch (error) {
      this.logger.error({
        messageId: context.messageId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error logging message to database');
    }
  }

  /**
   * Extract message context from WAMessage
   */
  static extractMessageContext(message: WAMessage): MessageContext | null {
    try {
      const messageInfo = message.key;
      const messageContent = message.message;

      if (!messageInfo?.remoteJid || !messageContent) {
        return null;
      }

      // Extract text from various message types
      let messageText = '';
      if (messageContent.conversation) {
        messageText = messageContent.conversation;
      } else if (messageContent.extendedTextMessage?.text) {
        messageText = messageContent.extendedTextMessage.text;
      } else if (messageContent.imageMessage?.caption) {
        messageText = messageContent.imageMessage.caption;
      } else if (messageContent.videoMessage?.caption) {
        messageText = messageContent.videoMessage.caption;
      } else {
        // Unsupported message type
        return null;
      }

      const isGroup = messageInfo.remoteJid.endsWith('@g.us');
      const timestamp = message.messageTimestamp 
        ? new Date(Number(message.messageTimestamp) * 1000)
        : new Date();

      return {
        messageId: messageInfo.id || `msg_${Date.now()}`,
        from: messageInfo.remoteJid,
        timestamp,
        messageText: messageText.trim(),
        isGroup,
        groupId: isGroup ? messageInfo.remoteJid : undefined,
        participantId: isGroup ? messageInfo.participant : undefined,
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Error extracting message context');
      return null;
    }
  }

  /**
   * Check if message should be processed
   */
  static shouldProcessMessage(message: WAMessage): boolean {
    // Skip if no message content
    if (!message.message) {
      return false;
    }

    // Skip if message is from status broadcast
    if (message.key.remoteJid === 'status@broadcast') {
      return false;
    }

    // Skip if message is too old (more than 5 minutes)
    const messageTime = message.messageTimestamp 
      ? new Date(Number(message.messageTimestamp) * 1000)
      : new Date();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (messageTime < fiveMinutesAgo) {
      return false;
    }

    // Skip if message is from bot itself (if we can detect it)
    // This would need to be implemented based on your bot's number

    return true;
  }
}

// Export singleton instance
export const messageHandler = new MessageHandler();
export default messageHandler;