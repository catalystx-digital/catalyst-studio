/**
 * Unit tests for slug-validator.ts
 * Tests slug uniqueness validation and database operations
 */

import { Prisma } from '@/lib/generated/prisma';
import {
  checkSlugUniqueness,
  ensureUniqueSlug,
  generateUniqueSlug,
  batchCheckSlugUniqueness,
  getExistingSlugs,
  validateAndSuggestSlug
} from '../slug-validator';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteStructure: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

import { prisma } from '@/lib/prisma';

describe('slug-validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSlugUniqueness', () => {
    it('should return true when slug is unique', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const result = await checkSlugUniqueness('unique-slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe(true);
      expect(prisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: 'web-123',
          parentId: null,
          slug: {
            equals: 'unique-slug',
            mode: 'insensitive'
          }
        },
        select: { id: true }
      });
    });

    it('should return false when slug exists', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue({ id: 'existing-id' });

      const result = await checkSlugUniqueness('existing-slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe(false);
    });

    it('should handle parent ID correctly', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      await checkSlugUniqueness('test-slug', {
        websiteId: 'web-123',
        parentId: 'parent-456'
      });

      expect(prisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: 'web-123',
          parentId: 'parent-456',
          slug: {
            equals: 'test-slug',
            mode: 'insensitive'
          }
        },
        select: { id: true }
      });
    });

    it('should exclude current record when updating', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      await checkSlugUniqueness('test-slug', {
        websiteId: 'web-123',
        parentId: null,
        excludeId: 'current-id'
      });

      expect(prisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: 'web-123',
          parentId: null,
          slug: {
            equals: 'test-slug',
            mode: 'insensitive'
          },
          id: {
            not: 'current-id'
          }
        },
        select: { id: true }
      });
    });

    it('should use case-insensitive comparison', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      await checkSlugUniqueness('Test-Slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(prisma.websiteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: {
              equals: 'Test-Slug',
              mode: 'insensitive'
            }
          })
        })
      );
    });
  });

  describe('ensureUniqueSlug', () => {
    it('should return base slug when unique', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(null)
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await ensureUniqueSlug('unique-slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe('unique-slug');
    });

    it('should append suffix when slug exists', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'existing-1' }) // First call: base slug exists
              .mockResolvedValueOnce(null) // Second call: with suffix is available
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await ensureUniqueSlug('existing-slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe('existing-slug-1');
    });

    it('should increment suffix until unique', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'existing-1' }) // base slug
              .mockResolvedValueOnce({ id: 'existing-2' }) // -1 suffix
              .mockResolvedValueOnce({ id: 'existing-3' }) // -2 suffix
              .mockResolvedValueOnce(null) // -3 suffix is available
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await ensureUniqueSlug('popular-slug', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe('popular-slug-3');
    });

    it('should throw error after max attempts', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue({ id: 'always-exists' })
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      await expect(
        ensureUniqueSlug('always-taken', {
          websiteId: 'web-123',
          parentId: null,
          maxAttempts: 3
        })
      ).rejects.toThrow('Unable to generate unique slug after 3 attempts');
    });

    it('should throw error for invalid base slug', async () => {
      await expect(
        ensureUniqueSlug('Invalid Slug!', {
          websiteId: 'web-123',
          parentId: null
        })
      ).rejects.toThrow("Invalid slug: 'Invalid Slug!' contains uppercase letters");
    });

    it('should exclude current record when updating', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(null)
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await ensureUniqueSlug('test-slug', {
        websiteId: 'web-123',
        parentId: null,
        excludeId: 'current-id'
      });

      expect(result).toBe('test-slug');
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate and ensure unique slug from title', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(null)
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await generateUniqueSlug('Hello World!', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe('hello-world');
    });

    it('should handle title that generates empty slug', async () => {
      await expect(
        generateUniqueSlug('!!!', {
          websiteId: 'web-123',
          parentId: null
        })
      ).rejects.toThrow('Unable to generate slug from title - title may be empty or contain only special characters');
    });

    it('should append suffix for conflicting generated slugs', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'existing' })
              .mockResolvedValueOnce(null)
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await generateUniqueSlug('Existing Title', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result).toBe('existing-title-1');
    });
  });

  describe('batchCheckSlugUniqueness', () => {
    it('should check multiple slugs at once', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([
        { slug: 'existing-1' },
        { slug: 'existing-2' }
      ]);

      const result = await batchCheckSlugUniqueness(
        ['existing-1', 'existing-2', 'new-slug'],
        {
          websiteId: 'web-123',
          parentId: null
        }
      );

      expect(result.get('existing-1')).toBe(false);
      expect(result.get('existing-2')).toBe(false);
      expect(result.get('new-slug')).toBe(true);
    });

    it('should handle case-insensitive comparison', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([
        { slug: 'Existing-Slug' }
      ]);

      const result = await batchCheckSlugUniqueness(
        ['existing-slug', 'EXISTING-SLUG', 'new-slug'],
        {
          websiteId: 'web-123',
          parentId: null
        }
      );

      expect(result.get('existing-slug')).toBe(false);
      expect(result.get('EXISTING-SLUG')).toBe(false);
      expect(result.get('new-slug')).toBe(true);
    });

    it('should handle empty result set', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([]);

      const result = await batchCheckSlugUniqueness(
        ['slug-1', 'slug-2'],
        {
          websiteId: 'web-123',
          parentId: 'parent-456'
        }
      );

      expect(result.get('slug-1')).toBe(true);
      expect(result.get('slug-2')).toBe(true);
    });
  });

  describe('getExistingSlugs', () => {
    it('should return all slugs at parent level', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([
        { slug: 'about' },
        { slug: 'contact' },
        { slug: 'products' }
      ]);

      const result = await getExistingSlugs('web-123', null);

      expect(result).toEqual(['about', 'contact', 'products']);
      expect(prisma.websiteStructure.findMany).toHaveBeenCalledWith({
        where: {
          websiteId: 'web-123',
          parentId: null
        },
        select: { slug: true }
      });
    });

    it('should handle parent ID correctly', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([
        { slug: 'child-1' },
        { slug: 'child-2' }
      ]);

      const result = await getExistingSlugs('web-123', 'parent-456');

      expect(result).toEqual(['child-1', 'child-2']);
      expect(prisma.websiteStructure.findMany).toHaveBeenCalledWith({
        where: {
          websiteId: 'web-123',
          parentId: 'parent-456'
        },
        select: { slug: true }
      });
    });

    it('should return empty array when no slugs exist', async () => {
      prisma.websiteStructure.findMany.mockResolvedValue([]);

      const result = await getExistingSlugs('web-123', null);

      expect(result).toEqual([]);
    });
  });

  describe('validateAndSuggestSlug', () => {
    it('should validate and return unique slug', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const result = await validateAndSuggestSlug('Valid Title', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result.originalSlug).toBe('valid-title');
      expect(result.suggestedSlug).toBe('valid-title');
      expect(result.isUnique).toBe(true);
      expect(result.validationErrors).toEqual([]);
    });

    it('should suggest alternative for non-unique slug', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue({ id: 'existing' });

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          siteStructure: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ id: 'existing' })
              .mockResolvedValueOnce(null)
          }
        };
        return callback(mockTx as Prisma.TransactionClient);
      });
      prisma.$transaction = mockTransaction;

      const result = await validateAndSuggestSlug('Existing Title', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result.originalSlug).toBe('existing-title');
      expect(result.suggestedSlug).toBe('existing-title-1');
      expect(result.isUnique).toBe(false);
      expect(result.validationErrors).toEqual([]);
    });

    it('should return validation errors for invalid title', async () => {
      const result = await validateAndSuggestSlug('', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result.originalSlug).toBe('');
      expect(result.suggestedSlug).toBe('');
      expect(result.isUnique).toBe(false);
      expect(result.validationErrors).toContain('Invalid slug: cannot be empty');
    });

    it('should handle reserved slug in title', async () => {
      const result = await validateAndSuggestSlug('API', {
        websiteId: 'web-123',
        parentId: null
      });

      expect(result.originalSlug).toBe('api');
      expect(result.suggestedSlug).toBe('');
      expect(result.isUnique).toBe(false);
      expect(result.validationErrors).toContain("Invalid slug: 'api' is a reserved system slug");
    });
  });

  describe('performance', () => {
    it('should validate quickly (< 10ms per operation)', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await checkSlugUniqueness(`test-slug-${i}`, {
          websiteId: 'web-123',
          parentId: null
        });
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 100;
      
      // Database mocked, so should be very fast
      expect(avgTime).toBeLessThan(10);
    });
  });
});