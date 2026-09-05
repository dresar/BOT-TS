import { Prisma, Config } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../../utils/logger.js';

export interface CreateConfigData {
  key: string;
  value: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateConfigData {
  value?: string;
  description?: string;
  isPublic?: boolean;
}

export interface ConfigFilters {
  isPublic?: boolean;
  search?: string;
}

export class ConfigRepository {
  static async create(data: CreateConfigData): Promise<Config> {
    try {
      const config = await prisma.config.create({
        data: {
          key: data.key,
          value: data.value,
          description: data.description,
          isPublic: data.isPublic ?? false,
        },
      });
      
      logger.db.info({ configKey: config.key }, 'Config created');
      return config;
    } catch (error) {
      logger.db.error({ error, data }, 'Failed to create config');
      throw error;
    }
  }

  static async findByKey(key: string): Promise<Config | null> {
    try {
      return await prisma.config.findUnique({
        where: { key },
      });
    } catch (error) {
      logger.db.error({ error, key }, 'Failed to find config by key');
      throw error;
    }
  }

  static async findMany(
    filters: ConfigFilters = {},
    page = 1,
    limit = 50
  ): Promise<{ configs: Config[]; total: number; pages: number }> {
    try {
      const where: Prisma.ConfigWhereInput = {};

      if (filters.isPublic !== undefined) {
        where.isPublic = filters.isPublic;
      }

      if (filters.search) {
        where.OR = [
          { key: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { value: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [configs, total] = await Promise.all([
        prisma.config.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { key: 'asc' },
        }),
        prisma.config.count({ where }),
      ]);

      return {
        configs,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.db.error({ error, filters }, 'Failed to find configs');
      throw error;
    }
  }

  static async update(key: string, data: UpdateConfigData): Promise<Config> {
    try {
      const config = await prisma.config.update({
        where: { key },
        data,
      });
      
      logger.db.info({ configKey: key }, 'Config updated');
      return config;
    } catch (error) {
      logger.db.error({ error, key, data }, 'Failed to update config');
      throw error;
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await prisma.config.delete({
        where: { key },
      });
      
      logger.db.info({ configKey: key }, 'Config deleted');
    } catch (error) {
      logger.db.error({ error, key }, 'Failed to delete config');
      throw error;
    }
  }

  static async upsert(key: string, value: string, description?: string, isPublic = false): Promise<Config> {
    try {
      const config = await prisma.config.upsert({
        where: { key },
        update: {
          value,
          description,
          isPublic,
        },
        create: {
          key,
          value,
          description,
          isPublic,
        },
      });
      
      logger.db.info({ configKey: key }, 'Config upserted');
      return config;
    } catch (error) {
      logger.db.error({ error, key }, 'Failed to upsert config');
      throw error;
    }
  }

  static async getValue(key: string, defaultValue?: string): Promise<string | null> {
    try {
      const config = await this.findByKey(key);
      return config?.value ?? defaultValue ?? null;
    } catch (error) {
      logger.db.error({ error, key }, 'Failed to get config value');
      return defaultValue ?? null;
    }
  }

  static async getPublicConfigs(): Promise<Config[]> {
    try {
      return await prisma.config.findMany({
        where: { isPublic: true },
        orderBy: { key: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get public configs');
      throw error;
    }
  }

  static async getConfigsByPrefix(prefix: string): Promise<Config[]> {
    try {
      return await prisma.config.findMany({
        where: {
          key: {
            startsWith: prefix,
          },
        },
        orderBy: { key: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error, prefix }, 'Failed to get configs by prefix');
      throw error;
    }
  }

  // Specific config getters for common settings
  static async getOfficeHours(): Promise<{ start: string; end: string } | null> {
    try {
      const [startConfig, endConfig] = await Promise.all([
        this.findByKey('office_hours_start'),
        this.findByKey('office_hours_end'),
      ]);

      if (!startConfig || !endConfig) {
        return null;
      }

      return {
        start: startConfig.value,
        end: endConfig.value,
      };
    } catch (error) {
      logger.db.error({ error }, 'Failed to get office hours');
      return null;
    }
  }

  static async getContactInfo(): Promise<{
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  }> {
    try {
      const configs = await this.getConfigsByPrefix('contact_');
      const contactInfo: any = {};

      configs.forEach(config => {
        const key = config.key.replace('contact_', '');
        contactInfo[key] = config.value;
      });

      return contactInfo;
    } catch (error) {
      logger.db.error({ error }, 'Failed to get contact info');
      return {};
    }
  }

  static async getBotSettings(): Promise<{
    welcomeMessage?: string;
    helpMessage?: string;
    outOfScopeMessage?: string;
    maxMessageLength?: number;
    enableAutoReply?: boolean;
  }> {
    try {
      const configs = await this.getConfigsByPrefix('bot_');
      const botSettings: any = {};

      configs.forEach(config => {
        const key = config.key.replace('bot_', '');
        let value: any = config.value;

        // Parse specific types
        if (key === 'maxMessageLength') {
          value = parseInt(value, 10);
        } else if (key === 'enableAutoReply') {
          value = value.toLowerCase() === 'true';
        }

        botSettings[key] = value;
      });

      return botSettings;
    } catch (error) {
      logger.db.error({ error }, 'Failed to get bot settings');
      return {};
    }
  }

  static async setOfficeHours(start: string, end: string): Promise<void> {
    try {
      await Promise.all([
        this.upsert('office_hours_start', start, 'Jam buka kantor', true),
        this.upsert('office_hours_end', end, 'Jam tutup kantor', true),
      ]);
      
      logger.db.info({ start, end }, 'Office hours updated');
    } catch (error) {
      logger.db.error({ error, start, end }, 'Failed to set office hours');
      throw error;
    }
  }

  static async setContactInfo(contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
  }): Promise<void> {
    try {
      const updates = Object.entries(contactInfo).map(([key, value]) =>
        this.upsert(`contact_${key}`, value, `Informasi kontak: ${key}`, true)
      );

      await Promise.all(updates);
      
      logger.db.info({ contactInfo }, 'Contact info updated');
    } catch (error) {
      logger.db.error({ error, contactInfo }, 'Failed to set contact info');
      throw error;
    }
  }

  static async setBotSettings(botSettings: {
    welcomeMessage?: string;
    helpMessage?: string;
    outOfScopeMessage?: string;
    maxMessageLength?: number;
    enableAutoReply?: boolean;
  }): Promise<void> {
    try {
      const updates = Object.entries(botSettings).map(([key, value]) =>
        this.upsert(`bot_${key}`, String(value), `Pengaturan bot: ${key}`, false)
      );

      await Promise.all(updates);
      
      logger.db.info({ botSettings }, 'Bot settings updated');
    } catch (error) {
      logger.db.error({ error, botSettings }, 'Failed to set bot settings');
      throw error;
    }
  }
}