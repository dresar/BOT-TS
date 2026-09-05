import { Prisma, KnowledgeItem, KnowledgeCategory } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../../utils/logger.js';

export interface CreateKnowledgeData {
  title: string;
  content: string;
  category: KnowledgeCategory;
  keywords: string[];
  isActive?: boolean;
}

export interface UpdateKnowledgeData {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  keywords?: string[];
  isActive?: boolean;
}

export interface KnowledgeFilters {
  category?: KnowledgeCategory;
  isActive?: boolean;
  search?: string;
  keywords?: string[];
}

export interface KnowledgeSearchResult {
  item: KnowledgeItem;
  relevanceScore: number;
}

export class KnowledgeRepository {
  static async create(data: CreateKnowledgeData): Promise<KnowledgeItem> {
    try {
      const knowledge = await prisma.knowledgeItem.create({
        data: {
          title: data.title,
          content: data.content,
          category: data.category,
          keywords: data.keywords,
          isActive: data.isActive ?? true,
        },
      });
      
      logger.db.info({ knowledgeId: knowledge.id }, 'Knowledge item created');
      return knowledge;
    } catch (error) {
      logger.db.error({ error, data }, 'Failed to create knowledge item');
      throw error;
    }
  }

  static async findById(id: string): Promise<KnowledgeItem | null> {
    try {
      return await prisma.knowledgeItem.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to find knowledge item by ID');
      throw error;
    }
  }

  static async findMany(
    filters: KnowledgeFilters = {},
    page = 1,
    limit = 20
  ): Promise<{ items: KnowledgeItem[]; total: number; pages: number }> {
    try {
      const where: Prisma.KnowledgeItemWhereInput = {};

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
          { keywords: { hasSome: [filters.search] } },
        ];
      }

      if (filters.keywords && filters.keywords.length > 0) {
        where.keywords = {
          hasSome: filters.keywords,
        };
      }

      const [items, total] = await Promise.all([
        prisma.knowledgeItem.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.knowledgeItem.count({ where }),
      ]);

      return {
        items,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.db.error({ error, filters }, 'Failed to find knowledge items');
      throw error;
    }
  }

  static async search(
    query: string,
    category?: KnowledgeCategory,
    limit = 10
  ): Promise<KnowledgeSearchResult[]> {
    try {
      const where: Prisma.KnowledgeItemWhereInput = {
        isActive: true,
      };

      if (category) {
        where.category = category;
      }

      // Split query into keywords for better matching
      const queryKeywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);

      const items = await prisma.knowledgeItem.findMany({
        where: {
          ...where,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { keywords: { hasSome: queryKeywords } },
          ],
        },
        take: limit * 2, // Get more items for scoring
        orderBy: { updatedAt: 'desc' },
      });

      // Calculate relevance scores
      const results: KnowledgeSearchResult[] = items.map(item => {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        const lowerTitle = item.title.toLowerCase();
        const lowerContent = item.content.toLowerCase();

        // Title exact match (highest score)
        if (lowerTitle.includes(lowerQuery)) {
          score += 100;
        }

        // Content match
        if (lowerContent.includes(lowerQuery)) {
          score += 50;
        }

        // Keyword matches
        const matchingKeywords = item.keywords.filter(keyword =>
          keyword.toLowerCase().includes(lowerQuery) ||
          queryKeywords.some(qk => keyword.toLowerCase().includes(qk))
        );
        score += matchingKeywords.length * 30;

        // Partial word matches in title
        queryKeywords.forEach(keyword => {
          if (lowerTitle.includes(keyword)) {
            score += 20;
          }
          if (lowerContent.includes(keyword)) {
            score += 10;
          }
        });

        return { item, relevanceScore: score };
      });

      // Sort by relevance score and return top results
      return results
        .filter(result => result.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      logger.db.error({ error, query, category }, 'Failed to search knowledge items');
      throw error;
    }
  }

  static async update(id: string, data: UpdateKnowledgeData): Promise<KnowledgeItem> {
    try {
      const knowledge = await prisma.knowledgeItem.update({
        where: { id },
        data,
      });
      
      logger.db.info({ knowledgeId: id }, 'Knowledge item updated');
      return knowledge;
    } catch (error) {
      logger.db.error({ error, id, data }, 'Failed to update knowledge item');
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await prisma.knowledgeItem.delete({
        where: { id },
      });
      
      logger.db.info({ knowledgeId: id }, 'Knowledge item deleted');
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to delete knowledge item');
      throw error;
    }
  }

  static async toggleActive(id: string): Promise<KnowledgeItem> {
    try {
      const current = await this.findById(id);
      if (!current) {
        throw new Error('Knowledge item not found');
      }

      return await this.update(id, { isActive: !current.isActive });
    } catch (error) {
      logger.db.error({ error, id }, 'Failed to toggle knowledge item status');
      throw error;
    }
  }

  static async getCategoryCounts(): Promise<Array<{ category: KnowledgeCategory; count: number }>> {
    try {
      const counts = await prisma.knowledgeItem.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
      });

      return counts.map(count => ({
        category: count.category,
        count: count._count.category,
      }));
    } catch (error) {
      logger.db.error({ error }, 'Failed to get category counts');
      throw error;
    }
  }

  static async getByCategory(category: KnowledgeCategory): Promise<KnowledgeItem[]> {
    try {
      return await prisma.knowledgeItem.findMany({
        where: {
          category,
          isActive: true,
        },
        orderBy: { title: 'asc' },
      });
    } catch (error) {
      logger.db.error({ error, category }, 'Failed to get knowledge items by category');
      throw error;
    }
  }

  static async getPopularKeywords(limit = 20): Promise<Array<{ keyword: string; count: number }>> {
    try {
      // This is a simplified approach - in a real app you might want to use a more sophisticated method
      const items = await prisma.knowledgeItem.findMany({
        where: { isActive: true },
        select: { keywords: true },
      });

      const keywordCounts = new Map<string, number>();
      
      items.forEach(item => {
        item.keywords.forEach(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          keywordCounts.set(lowerKeyword, (keywordCounts.get(lowerKeyword) || 0) + 1);
        });
      });

      return Array.from(keywordCounts.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      logger.db.error({ error }, 'Failed to get popular keywords');
      throw error;
    }
  }
}