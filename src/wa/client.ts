import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  WAMessageKey,
  WAMessage,
} from '@baileys/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { createWhatsAppLogger, logError, logWhatsAppMessage } from '../utils/logger.js';
import { getStoragePath } from '../config/env.js';
import { checkWhatsAppRateLimit } from '../utils/rate-limiter.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

const logger = createWhatsAppLogger();

export interface WhatsAppClientEvents {
  'connection.update': (update: Partial<ConnectionState>) => void;
  'messages.upsert': (messages: { messages: WAMessage[]; type: string }) => void;
  'message.sent': (jid: string, message: string) => void;
  'qr.generated': (qr: string) => void;
  'ready': () => void;
  'disconnected': (reason?: string) => void;
  'error': (error: Error) => void;
}

export class WhatsAppClient extends EventEmitter {
  private socket: WASocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // Start with 5 seconds
  private maxReconnectDelay = 300000; // Max 5 minutes
  private authPath: string;

  constructor() {
    super();
    this.authPath = getStoragePath();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('connection.update', this.handleConnectionUpdate.bind(this));
    this.on('messages.upsert', this.handleMessagesUpsert.bind(this));
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp client...');
      
      // Ensure storage directory exists
      await this.ensureStorageDirectory();
      
      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
      
      // Create socket
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false, // We'll handle QR display ourselves
        logger: logger.child({ component: 'baileys' }),
        browser: ['WhatsApp Village Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      // Set up event listeners
      this.socket.ev.on('connection.update', (update) => {
        this.emit('connection.update', update);
      });

      this.socket.ev.on('messages.upsert', (messageUpdate) => {
        this.emit('messages.upsert', messageUpdate);
      });

      this.socket.ev.on('creds.update', saveCreds);

      logger.info('WhatsApp client initialized successfully');
    } catch (error) {
      const err = error as Error;
      logError(err, 'WhatsApp client initialization');
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Handle connection updates
   */
  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR Code generated, please scan with WhatsApp');
      console.log('\n📱 Scan QR Code with WhatsApp:');
      qrcode.generate(qr, { small: true });
      this.emit('qr.generated', qr);
    }

    if (connection === 'close') {
      this.isConnected = false;
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.warn({ reason, reconnectAttempts: this.reconnectAttempts }, 'Connection closed, attempting to reconnect');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.scheduleReconnect();
        } else {
          logger.error('Max reconnection attempts reached');
          this.emit('disconnected', 'Max reconnection attempts reached');
        }
      } else {
        logger.info('Logged out from WhatsApp');
        this.emit('disconnected', 'Logged out');
      }
    } else if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000; // Reset delay
      logger.info('WhatsApp connection established successfully');
      this.emit('ready');
    } else if (connection === 'connecting') {
      logger.info('Connecting to WhatsApp...');
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleMessagesUpsert(messageUpdate: { messages: WAMessage[]; type: string }): Promise<void> {
    const { messages, type } = messageUpdate;
    
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        // Skip if message is from bot itself
        if (message.key.fromMe) continue;
        
        // Skip if no text content
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text;
        if (!text) continue;

        const from = message.key.remoteJid;
        if (!from) continue;

        // Check rate limit
        if (!checkWhatsAppRateLimit(from)) {
          logger.warn({ from }, 'Message rate limited');
          continue;
        }

        // Log incoming message
        logWhatsAppMessage('incoming', from, this.socket?.user?.id || 'bot', text);

        // Emit message for processing
        this.emit('message.received', {
          from,
          text,
          messageKey: message.key,
          timestamp: message.messageTimestamp,
        });
      } catch (error) {
        logError(error as Error, 'Message processing', { messageKey: message.key });
      }
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      await this.socket.sendMessage(jid, { text });
      logWhatsAppMessage('outgoing', this.socket.user?.id || 'bot', jid, text);
      this.emit('message.sent', jid, text);
      logger.info({ jid, textLength: text.length }, 'Message sent successfully');
    } catch (error) {
      logError(error as Error, 'Send message', { jid, textLength: text.length });
      throw error;
    }
  }

  /**
   * Send a message with typing indicator
   */
  async sendMessageWithTyping(jid: string, text: string, typingDuration = 1000): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      // Send typing indicator
      await this.socket.sendPresenceUpdate('composing', jid);
      
      // Wait for typing duration
      await new Promise(resolve => setTimeout(resolve, typingDuration));
      
      // Send message
      await this.sendMessage(jid, text);
      
      // Stop typing
      await this.socket.sendPresenceUpdate('paused', jid);
    } catch (error) {
      logError(error as Error, 'Send message with typing', { jid });
      throw error;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnect(): Promise<void> {
    this.reconnectAttempts++;
    
    logger.info({
      attempt: this.reconnectAttempts,
      delay: this.reconnectDelay,
      maxAttempts: this.maxReconnectAttempts,
    }, 'Scheduling reconnection');

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logError(error as Error, 'Reconnection attempt');
      }
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.authPath);
    } catch {
      await fs.mkdir(this.authPath, { recursive: true });
      logger.info({ path: this.authPath }, 'Created storage directory');
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    user?: { id: string; name: string };
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      user: this.socket?.user ? {
        id: this.socket.user.id,
        name: this.socket.user.name || 'Unknown',
      } : undefined,
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      logger.info('Disconnecting WhatsApp client...');
      this.socket.end(undefined);
      this.socket = null;
      this.isConnected = false;
      logger.info('WhatsApp client disconnected');
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.isConnected && this.socket !== null;
  }
}

// Export singleton instance
export const whatsappClient = new WhatsAppClient();
export default whatsappClient;