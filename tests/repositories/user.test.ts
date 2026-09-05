import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from '../../src/db/repo/user.js';
import { UserRole } from '@prisma/client';
import { prisma } from '../../src/db/prisma.js';
import type { MockPrisma } from '../setup.js';

const mockPrisma = prisma as MockPrisma;

describe('UserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with default role', async () => {
      const userData = {
        whatsappJid: '6281234567890@s.whatsapp.net',
        name: 'John Doe',
        phoneNumber: '+6281234567890',
      };

      const expectedUser = {
        id: 'user-1',
        ...userData,
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(expectedUser);

      const result = await UserRepository.create(userData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          ...userData,
          role: UserRole.USER,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should create a user with specified role', async () => {
      const userData = {
        whatsappJid: 'admin@s.whatsapp.net',
        name: 'Admin User',
        phoneNumber: '+6281234567891',
        role: UserRole.ADMIN,
      };

      const expectedUser = {
        id: 'user-2',
        ...userData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(expectedUser);

      const result = await UserRepository.create(userData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData,
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when creation fails', async () => {
      const userData = {
        whatsappJid: 'invalid@s.whatsapp.net',
        name: 'Invalid User',
        phoneNumber: '+6281234567892',
      };

      const error = new Error('Database error');
      mockPrisma.user.create.mockRejectedValue(error);

      await expect(UserRepository.create(userData)).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userId = 'user-1';
      const expectedUser = {
        id: userId,
        whatsappJid: '6281234567890@s.whatsapp.net',
        name: 'John Doe',
        phoneNumber: '+6281234567890',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await UserRepository.findById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      const userId = 'non-existent';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await UserRepository.findById(userId);

      expect(result).toBeNull();
    });
  });

  describe('findByWhatsappJid', () => {
    it('should find user by WhatsApp JID', async () => {
      const whatsappJid = '6281234567890@s.whatsapp.net';
      const expectedUser = {
        id: 'user-1',
        whatsappJid,
        name: 'John Doe',
        phoneNumber: '+6281234567890',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await UserRepository.findByWhatsappJid(whatsappJid);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { whatsappJid },
      });
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findMany', () => {
    it('should find users with filters and pagination', async () => {
      const filters = {
        role: UserRole.USER,
        isActive: true,
        search: 'John',
      };
      const page = 1;
      const limit = 10;

      const expectedUsers = [
        {
          id: 'user-1',
          whatsappJid: '6281234567890@s.whatsapp.net',
          name: 'John Doe',
          phoneNumber: '+6281234567890',
          role: UserRole.USER,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(expectedUsers);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await UserRepository.findMany(filters, page, limit);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.USER,
          isActive: true,
          OR: [
            { name: { contains: 'John', mode: 'insensitive' } },
            { phoneNumber: { contains: 'John' } },
            { whatsappJid: { contains: 'John' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual({
        users: expectedUsers,
        total: 1,
        pages: 1,
      });
    });
  });

  describe('getOrCreate', () => {
    it('should return existing user if found', async () => {
      const whatsappJid = '6281234567890@s.whatsapp.net';
      const name = 'John Doe';
      const phoneNumber = '+6281234567890';

      const existingUser = {
        id: 'user-1',
        whatsappJid,
        name,
        phoneNumber,
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await UserRepository.getOrCreate(whatsappJid, name, phoneNumber);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { whatsappJid },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingUser);
    });

    it('should create new user if not found', async () => {
      const whatsappJid = '6281234567890@s.whatsapp.net';
      const name = 'John Doe';
      const phoneNumber = '+6281234567890';

      const newUser = {
        id: 'user-1',
        whatsappJid,
        name,
        phoneNumber,
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await UserRepository.getOrCreate(whatsappJid, name, phoneNumber);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { whatsappJid },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          whatsappJid,
          name,
          phoneNumber,
          role: UserRole.USER,
        },
      });
      expect(result).toEqual(newUser);
    });

    it('should update user info if changed', async () => {
      const whatsappJid = '6281234567890@s.whatsapp.net';
      const name = 'John Doe Updated';
      const phoneNumber = '+6281234567891';

      const existingUser = {
        id: 'user-1',
        whatsappJid,
        name: 'John Doe',
        phoneNumber: '+6281234567890',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        name,
        phoneNumber,
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await UserRepository.getOrCreate(whatsappJid, name, phoneNumber);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name, phoneNumber },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active users', async () => {
      mockPrisma.user.count.mockResolvedValue(5);

      const result = await UserRepository.getActiveCount();

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toBe(5);
    });
  });

  describe('getAdmins', () => {
    it('should return active admin users', async () => {
      const adminUsers = [
        {
          id: 'admin-1',
          whatsappJid: 'admin1@s.whatsapp.net',
          name: 'Admin One',
          phoneNumber: '+6281234567890',
          role: UserRole.ADMIN,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(adminUsers);

      const result = await UserRepository.getAdmins();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(adminUsers);
    });
  });
});