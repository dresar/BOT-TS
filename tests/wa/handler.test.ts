import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageHandler } from '../../src/wa/handler.js';
import { IntentClassifier } from '../../src/wa/intents.js';
import { ResponseTemplateManager } from '../../src/wa/templates.js';
import { UserRepository, MessageRepository, KnowledgeRepository } from '../../src/db/repo/index.js';
import { logger } from '../../src/utils/logger.js';

// Mock dependencies
vi.mock('../../src/wa/intents.js');
vi.mock('../../src/wa/templates.js');
vi.mock('../../src/db/repo/index.js');
vi.mock('../../src/utils/logger.js');

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let mockIntentClassifier: vi.Mocked<IntentClassifier>;
  let mockTemplateManager: vi.Mocked<ResponseTemplateManager>;
  let mockUserRepo: vi.Mocked<UserRepository>;
  let mockMessageRepo: vi.Mocked<MessageRepository>;
  let mockKnowledgeRepo: vi.Mocked<KnowledgeRepository>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockIntentClassifier = {
      classifyMessage: vi.fn(),
      getConfidence: vi.fn(),
      getSupportedIntents: vi.fn(),
    } as any;

    mockTemplateManager = {
      getResponse: vi.fn(),
      resolveVariables: vi.fn(),
      addTemplate: vi.fn(),
      addVariableResolver: vi.fn(),
      getAvailableTemplates: vi.fn(),
    } as any;

    mockUserRepo = {
      getOrCreate: vi.fn(),
      findByWhatsAppJid: vi.fn(),
      update: vi.fn(),
    } as any;

    mockMessageRepo = {
      create: vi.fn(),
      findByFilters: vi.fn(),
    } as any;

    mockKnowledgeRepo = {
      search: vi.fn(),
      findByFilters: vi.fn(),
    } as any;

    // Mock constructors
    vi.mocked(IntentClassifier).mockImplementation(() => mockIntentClassifier);
    vi.mocked(ResponseTemplateManager).mockImplementation(() => mockTemplateManager);
    vi.mocked(UserRepository).mockImplementation(() => mockUserRepo);
    vi.mocked(MessageRepository).mockImplementation(() => mockMessageRepo);
    vi.mocked(KnowledgeRepository).mockImplementation(() => mockKnowledgeRepo);

    messageHandler = new MessageHandler();
  });

  describe('handleMessage', () => {
    const mockMessage = {
      key: {
        remoteJid: '6281234567890@s.whatsapp.net',
        id: 'message123',
      },
      message: {
        conversation: 'Bagaimana cara membuat KTP?',
      },
      messageTimestamp: Date.now(),
    };

    const mockUser = {
      id: 1,
      whatsappJid: '6281234567890@s.whatsapp.net',
      phoneNumber: '+6281234567890',
      name: 'John Doe',
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockUserRepo.getOrCreate.mockResolvedValue(mockUser);
      mockMessageRepo.create.mockResolvedValue({
        id: 1,
        userId: 1,
        whatsappMessageId: 'message123',
        content: 'Bagaimana cara membuat KTP?',
        direction: 'INCOMING',
        intent: 'ktp',
        confidence: 0.95,
        createdAt: new Date(),
      });
    });

    it('should handle KTP intent message', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('ktp');
      mockIntentClassifier.getConfidence.mockReturnValue(0.95);
      mockTemplateManager.getResponse.mockReturnValue('Untuk membuat KTP, silakan datang ke kantor desa dengan membawa...');
      mockTemplateManager.resolveVariables.mockReturnValue('Untuk membuat KTP, silakan datang ke kantor desa dengan membawa...');

      const response = await messageHandler.handleMessage(mockMessage);

      expect(mockIntentClassifier.classifyMessage).toHaveBeenCalledWith('Bagaimana cara membuat KTP?');
      expect(mockTemplateManager.getResponse).toHaveBeenCalledWith('ktp');
      expect(response).toContain('Untuk membuat KTP');
    });

    it('should handle unknown intent with knowledge base search', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('unknown');
      mockIntentClassifier.getConfidence.mockReturnValue(0.3);
      mockKnowledgeRepo.search.mockResolvedValue([
        {
          id: 1,
          title: 'Prosedur Pembuatan Surat Keterangan',
          content: 'Untuk membuat surat keterangan, silakan...',
          keywords: ['surat', 'keterangan'],
          category: 'ADMINISTRASI',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockTemplateManager.getResponse.mockReturnValue('Berdasarkan pencarian, saya menemukan informasi berikut:');
      mockTemplateManager.resolveVariables.mockReturnValue('Berdasarkan pencarian, saya menemukan informasi berikut: Untuk membuat surat keterangan, silakan...');

      const response = await messageHandler.handleMessage({
        ...mockMessage,
        message: { conversation: 'Bagaimana cara membuat surat keterangan?' },
      });

      expect(mockKnowledgeRepo.search).toHaveBeenCalledWith('Bagaimana cara membuat surat keterangan?', 3);
      expect(response).toContain('Berdasarkan pencarian');
    });

    it('should handle out of scope message', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('unknown');
      mockIntentClassifier.getConfidence.mockReturnValue(0.1);
      mockKnowledgeRepo.search.mockResolvedValue([]);
      mockTemplateManager.getResponse.mockReturnValue('Maaf, saya tidak dapat membantu dengan pertanyaan tersebut.');
      mockTemplateManager.resolveVariables.mockReturnValue('Maaf, saya tidak dapat membantu dengan pertanyaan tersebut.');

      const response = await messageHandler.handleMessage({
        ...mockMessage,
        message: { conversation: 'Apa kabar cuaca hari ini?' },
      });

      expect(mockTemplateManager.getResponse).toHaveBeenCalledWith('out_of_scope');
      expect(response).toContain('Maaf');
    });

    it('should handle help command', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('help');
      mockIntentClassifier.getConfidence.mockReturnValue(0.98);
      mockTemplateManager.getResponse.mockReturnValue('Saya dapat membantu Anda dengan informasi tentang...');
      mockTemplateManager.resolveVariables.mockReturnValue('Saya dapat membantu Anda dengan informasi tentang...');

      const response = await messageHandler.handleMessage({
        ...mockMessage,
        message: { conversation: '/help' },
      });

      expect(mockIntentClassifier.classifyMessage).toHaveBeenCalledWith('/help');
      expect(mockTemplateManager.getResponse).toHaveBeenCalledWith('help');
      expect(response).toContain('membantu');
    });

    it('should handle start command', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('start');
      mockIntentClassifier.getConfidence.mockReturnValue(0.99);
      mockTemplateManager.getResponse.mockReturnValue('Selamat datang di layanan WhatsApp Desa!');
      mockTemplateManager.resolveVariables.mockReturnValue('Selamat datang di layanan WhatsApp Desa!');

      const response = await messageHandler.handleMessage({
        ...mockMessage,
        message: { conversation: '/start' },
      });

      expect(mockTemplateManager.getResponse).toHaveBeenCalledWith('start');
      expect(response).toContain('Selamat datang');
    });

    it('should create user if not exists', async () => {
      const newUser = { ...mockUser, id: 2 };
      mockUserRepo.getOrCreate.mockResolvedValue(newUser);

      await messageHandler.handleMessage(mockMessage);

      expect(mockUserRepo.getOrCreate).toHaveBeenCalledWith({
        whatsappJid: '6281234567890@s.whatsapp.net',
        phoneNumber: '+6281234567890',
      });
    });

    it('should log incoming message', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('ktp');
      mockIntentClassifier.getConfidence.mockReturnValue(0.95);

      await messageHandler.handleMessage(mockMessage);

      expect(mockMessageRepo.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        whatsappMessageId: 'message123',
        content: 'Bagaimana cara membuat KTP?',
        direction: 'INCOMING',
        intent: 'ktp',
        confidence: 0.95,
      });
    });

    it('should handle message without conversation text', async () => {
      const messageWithoutText = {
        ...mockMessage,
        message: {},
      };

      mockIntentClassifier.classifyMessage.mockReturnValue('unknown');
      mockTemplateManager.getResponse.mockReturnValue('Maaf, saya hanya dapat memproses pesan teks.');
      mockTemplateManager.resolveVariables.mockReturnValue('Maaf, saya hanya dapat memproses pesan teks.');

      const response = await messageHandler.handleMessage(messageWithoutText);

      expect(response).toContain('pesan teks');
    });

    it('should handle empty message', async () => {
      const emptyMessage = {
        ...mockMessage,
        message: { conversation: '' },
      };

      mockIntentClassifier.classifyMessage.mockReturnValue('unknown');
      mockTemplateManager.getResponse.mockReturnValue('Silakan kirim pesan yang ingin Anda tanyakan.');
      mockTemplateManager.resolveVariables.mockReturnValue('Silakan kirim pesan yang ingin Anda tanyakan.');

      const response = await messageHandler.handleMessage(emptyMessage);

      expect(response).toContain('Silakan kirim');
    });

    it('should handle database error gracefully', async () => {
      mockUserRepo.getOrCreate.mockRejectedValue(new Error('Database connection failed'));

      const response = await messageHandler.handleMessage(mockMessage);

      expect(logger.error).toHaveBeenCalled();
      expect(response).toContain('Maaf, terjadi kesalahan');
    });

    it('should handle knowledge search error gracefully', async () => {
      mockIntentClassifier.classifyMessage.mockReturnValue('unknown');
      mockIntentClassifier.getConfidence.mockReturnValue(0.3);
      mockKnowledgeRepo.search.mockRejectedValue(new Error('Search service unavailable'));
      mockTemplateManager.getResponse.mockReturnValue('Maaf, layanan pencarian sedang tidak tersedia.');
      mockTemplateManager.resolveVariables.mockReturnValue('Maaf, layanan pencarian sedang tidak tersedia.');

      const response = await messageHandler.handleMessage({
        ...mockMessage,
        message: { conversation: 'Bagaimana cara membuat surat?' },
      });

      expect(logger.error).toHaveBeenCalled();
      expect(response).toContain('tidak tersedia');
    });
  });

  describe('extractPhoneNumber', () => {
    it('should extract phone number from WhatsApp JID', () => {
      const phoneNumber = messageHandler.extractPhoneNumber('6281234567890@s.whatsapp.net');
      expect(phoneNumber).toBe('+6281234567890');
    });

    it('should handle JID without country code', () => {
      const phoneNumber = messageHandler.extractPhoneNumber('81234567890@s.whatsapp.net');
      expect(phoneNumber).toBe('+6281234567890');
    });

    it('should handle group JID', () => {
      const phoneNumber = messageHandler.extractPhoneNumber('120363123456789@g.us');
      expect(phoneNumber).toBe('+120363123456789');
    });

    it('should handle invalid JID format', () => {
      const phoneNumber = messageHandler.extractPhoneNumber('invalid-jid');
      expect(phoneNumber).toBe('+invalid-jid');
    });
  });

  describe('getMessageText', () => {
    it('should extract text from conversation message', () => {
      const message = {
        message: {
          conversation: 'Hello world',
        },
      };
      const text = messageHandler.getMessageText(message);
      expect(text).toBe('Hello world');
    });

    it('should extract text from extended text message', () => {
      const message = {
        message: {
          extendedTextMessage: {
            text: 'Extended text message',
          },
        },
      };
      const text = messageHandler.getMessageText(message);
      expect(text).toBe('Extended text message');
    });

    it('should return empty string for non-text message', () => {
      const message = {
        message: {
          imageMessage: {
            caption: 'Image caption',
          },
        },
      };
      const text = messageHandler.getMessageText(message);
      expect(text).toBe('');
    });

    it('should return empty string for message without content', () => {
      const message = {
        message: {},
      };
      const text = messageHandler.getMessageText(message);
      expect(text).toBe('');
    });
  });

  describe('shouldProcessMessage', () => {
    it('should process message from user', () => {
      const message = {
        key: {
          fromMe: false,
          remoteJid: '6281234567890@s.whatsapp.net',
        },
        message: {
          conversation: 'Hello',
        },
      };
      const shouldProcess = messageHandler.shouldProcessMessage(message);
      expect(shouldProcess).toBe(true);
    });

    it('should not process message from self', () => {
      const message = {
        key: {
          fromMe: true,
          remoteJid: '6281234567890@s.whatsapp.net',
        },
        message: {
          conversation: 'Hello',
        },
      };
      const shouldProcess = messageHandler.shouldProcessMessage(message);
      expect(shouldProcess).toBe(false);
    });

    it('should not process message without text content', () => {
      const message = {
        key: {
          fromMe: false,
          remoteJid: '6281234567890@s.whatsapp.net',
        },
        message: {
          imageMessage: {},
        },
      };
      const shouldProcess = messageHandler.shouldProcessMessage(message);
      expect(shouldProcess).toBe(false);
    });

    it('should not process empty message', () => {
      const message = {
        key: {
          fromMe: false,
          remoteJid: '6281234567890@s.whatsapp.net',
        },
        message: {
          conversation: '',
        },
      };
      const shouldProcess = messageHandler.shouldProcessMessage(message);
      expect(shouldProcess).toBe(false);
    });

    it('should not process message from status broadcast', () => {
      const message = {
        key: {
          fromMe: false,
          remoteJid: 'status@broadcast',
        },
        message: {
          conversation: 'Status update',
        },
      };
      const shouldProcess = messageHandler.shouldProcessMessage(message);
      expect(shouldProcess).toBe(false);
    });
  });
});