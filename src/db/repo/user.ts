import { Prisma, User, UserRole } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../../utils/logger.js';

export interface CreateUserData {
  whatsappJid: string;
  name: string;
  phoneNumber: string;
  role?: UserRole;
}

export interface UpdateUserData {
  name?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export class UserRepository {
  static async create(data: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          whatsappJid: data.whatsappJid,
          name: data.name,
          phoneNumber: data.phoneNumber,
          role: data.role || UserRole.USER,
        },
      });
      
      logger.db.info({ userId: user.id }, 'User created');
      return user;
    } catch (error) {
      logger.db.error({ error, data }, 'Failed to create user');
      throw error;
    }
  }

  static async findById(id: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to find user by ID');
      throw error;
    }
  }

  static async findByWhatsappJid(whatsappJid: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { whatsappJid },
      });
    } catch (error) {
      logger.db.error({ error, whatsappJid }, 'Failed to find user by WhatsApp JID');
      throw error;
    }
  }

  static async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { phoneNumber },
      });
    } catch (error) {
      logger.db.error({ error, phoneNumber }, 'Failed to find user by phone number');
      throw error;
    }
  }

  static async findMany(
    filters: UserFilters = {},
    page = 1,
    limit = 20
  ): Promise<{ users: User[]; total: number; pages: number }> {
    try {
      const where: Prisma.UserWhereInput = {};

      if (filters.role) {
        where.role = filters.role;
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { phoneNumber: { contains: filters.search } },
          { whatsappJid: { contains: filters.search } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.db.error({ error, filters }, 'Failed to find users');
      throw error;
    }
  }

  static async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data,
      });
      
      logger.db.info({ userId: id }, 'User updated');
      return user;
    } catch (error) {
      logger.db.error({ error, id, data }, 'Failed to update user');
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      
      logger.db.info({ userId: id }, 'User deleted');
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to delete user');
      throw error;
    }
  }

  static async getOrCreate(whatsappJid: string, name: string, phoneNumber: string): Promise<User> {
    try {
      let user = await this.findByWhatsappJid(whatsappJid);
      
      if (!user) {
        user = await this.create({
          whatsappJid,
          name,
          phoneNumber,
        });
      } else if (user.name !== name || user.phoneNumber !== phoneNumber) {
        // Update user info if changed
        user = await this.update(user.id, {
          name,
          phoneNumber,
        });
      }
      
      return user;
    } catch (error) {
      logger.db.error({ error, whatsappJid }, 'Failed to get or create user');
      throw error;
    }
  }

  static async getActiveCount(): Promise<number> {
    try {
      return await prisma.user.count({
        where: { isActive: true },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get active user count');
      throw error;
    }
  }

  static async getAdmins(): Promise<User[]> {
    try {
      return await prisma.user.findMany({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error }, 'Failed to get admin users');
      throw error;
    }
  }
}