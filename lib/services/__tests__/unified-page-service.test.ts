/**
 * Unit tests for UnifiedPageService
 * 
 * Verifies atomic creation of ContentItem and SiteStructure to prevent orphaned content.
 * Tests both page and component creation paths, error handling, and recovery mechanisms.
 */

import { UnifiedPageService } from '../unified-page-service';
import { PageOrchestrator } from '../site-structure/page-orchestrator';
import { prisma } from '@/lib/prisma';
import { ErrorCode } from '@/lib/types/unified-response.types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    },
    contentType: {
      findUnique: jest.fn()
    },
    contentItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    siteStructure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock('../site-structure/page-orchestrator');

describe('UnifiedPageService', () => {
  let service: UnifiedPageService;
  let mockPageOrchestrator: jest.Mocked<PageOrchestrator>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnifiedPageService();
    mockPageOrchestrator = (PageOrchestrator as jest.MockedClass<typeof PageOrchestrator>).mock.instances[0] as jest.Mocked<PageOrchestrator>;
  });

  describe('createContent', () => {
    const mockPageRequest = {
      websiteId: 'website-1',
      contentTypeId: 'content-type-1',
      title: 'Test Page',
      content: { body: 'Test content' },
      parentId: null,
      slug: 'test-page',
      status: 'draft' as const
    };

    const mockComponentRequest = {
      ...mockPageRequest,
      contentTypeId: 'component-type-1'
    };

    it('should create page with both ContentItem and SiteStructure for page types', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null); // No slug conflict

      const mockResult = {
        contentItem: {
          id: 'content-1',
          title: 'Test Page',
          slug: 'test-page',
          websiteId: 'website-1',
          contentTypeId: 'content-type-1',
          content: { body: 'Test content' },
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        siteStructure: {
          id: 'structure-1',
          fullPath: '/test-page',
          pathDepth: 1,
          position: 0,
          parentId: null
        },
        fullPath: '/test-page'
      };

      mockPageOrchestrator.createPage.mockResolvedValue(mockResult);

      // Execute
      const response = await service.createContent(mockPageRequest, 'ai');

      // Verify
      expect(response.success).toBe(true);
      expect(response.data?.websitePage).toBeDefined();
      expect(response.data?.siteStructure).toBeDefined();
      expect(response.data?.url).toBe('/test-page');
      expect(response.metadata?.source).toBe('ai');
      
      // Verify PageOrchestrator was called for atomic creation
      expect(mockPageOrchestrator.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Page',
          contentTypeId: 'content-type-1',
          slug: 'test-page'
        }),
        'website-1'
      );
    });

    it('should create component with only ContentItem for component types', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'component-type-1',
        category: 'component' // Component type
      });

      const mockContentItem = {
        id: 'component-1',
        title: 'Test Page',
        slug: 'test-page',
        websiteId: 'website-1',
        contentTypeId: 'component-type-1',
        content: { body: 'Test content' },
        metadata: {},
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.websitePage.create as jest.Mock).mockResolvedValue(mockContentItem);

      // Execute
      const response = await service.createContent(mockComponentRequest, 'ai');

      // Verify
      expect(response.success).toBe(true);
      expect(response.data?.websitePage).toBeDefined();
      expect(response.data?.siteStructure).toBeNull(); // Components don't have SiteStructure
      expect(response.data?.url).toBeNull(); // Components don't have URLs
      
      // Verify PageOrchestrator was NOT called for components
      expect(mockPageOrchestrator.createPage).not.toHaveBeenCalled();
      
      // Verify direct ContentItem creation for components
      expect(prisma.websitePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId: 'website-1',
          contentTypeId: 'component-type-1',
          title: 'Test Page'
        })
      });
    });

    it('should generate unique slug when not provided', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      
      // First check returns conflict, second check passes
      (prisma.siteStructure.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing' }) // First slug exists
        .mockResolvedValueOnce(null); // Generated slug is unique

      const requestWithoutSlug = { ...mockPageRequest, slug: undefined };

      mockPageOrchestrator.createPage.mockResolvedValue({
        websitePage: { id: 'content-1', slug: 'test-page-1' },
        websiteStructure: { id: 'structure-1' },
        fullPath: '/test-page-1'
      });

      // Execute
      const response = await service.createContent(requestWithoutSlug, 'ai');

      // Verify
      expect(response.success).toBe(true);
      expect(mockPageOrchestrator.createPage).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'test-page-1' // Auto-generated with counter
        }),
        'website-1'
      );
    });

    it('should provide recovery suggestions for slug conflicts', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' }); // Slug conflict

      // Execute
      const response = await service.createContent(mockPageRequest, 'ai');

      // Verify
      expect(response.success).toBe(false);
      expect(response.errors).toHaveLength(1);
      expect(response.errors[0].code).toBe(ErrorCode.INVALID_SLUG);
      expect(response.errors[0].recovery).toBeDefined();
      expect(response.errors[0].recovery?.action).toBe('regenerate_slug');
      expect(response.errors[0].recovery?.alternativeValues).toContain('test-page');
      expect(response.errors[0].recovery?.alternativeValues?.length).toBeGreaterThan(0);
    });

    it('should handle missing website error', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue(null);

      // Execute
      const response = await service.createContent(mockPageRequest, 'ui');

      // Verify
      expect(response.success).toBe(false);
      expect(response.errors).toHaveLength(1);
      expect(response.errors[0].code).toBe(ErrorCode.WEBSITE_NOT_FOUND);
      expect(response.errors[0].severity).toBe('critical');
    });

    it('should handle missing content type error', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null);

      // Execute
      const response = await service.createContent(mockPageRequest, 'sync');

      // Verify
      expect(response.success).toBe(false);
      expect(response.errors[0].code).toBe(ErrorCode.CONTENT_TYPE_NOT_FOUND);
      expect(response.errors[0].severity).toBe('critical');
    });

    it('should track source in audit metadata', async () => {
      // Setup mocks for successful creation
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      mockPageOrchestrator.createPage.mockResolvedValue({
        websitePage: { id: 'content-1' },
        websiteStructure: { id: 'structure-1' },
        fullPath: '/test-page'
      });

      const consoleSpy = jest.spyOn(console, 'log');

      // Test each source
      for (const source of ['ui', 'ai', 'sync'] as const) {
        await service.createContent(mockPageRequest, source);
        
        // Verify audit log includes source
        expect(consoleSpy).toHaveBeenCalledWith(
          'Audit:',
          expect.objectContaining({
            action: 'page_created',
            source
          })
        );
      }

      consoleSpy.mockRestore();
    });
  });

  describe('updatePage', () => {
    it('should update both ContentItem and SiteStructure when slug changes', async () => {
      const mockContentItem = {
        id: 'content-1',
        slug: 'old-slug',
        websiteId: 'website-1',
        title: 'Test Page',
        content: {},
        status: 'draft'
      };

      const mockSiteStructure = {
        id: 'structure-1',
        contentItemId: 'content-1',
        slug: 'old-slug',
        parentId: null
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockContentItem);
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null); // No slug conflict
      (prisma.siteStructure.findUnique as jest.Mock).mockResolvedValue({ fullPath: '/parent' });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          contentItem: {
            update: jest.fn().mockResolvedValue({ ...mockContentItem, slug: 'new-slug' })
          },
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(mockSiteStructure),
            update: jest.fn().mockResolvedValue({ ...mockSiteStructure, slug: 'new-slug', fullPath: '/new-slug' })
          }
        };
        return callback(tx);
      });

      // Execute
      const response = await service.updatePage(
        'content-1',
        { slug: 'new-slug' },
        'ui'
      );

      // Verify
      expect(response.success).toBe(true);
      expect(response.data?.websitePage.slug).toBe('new-slug');
      expect(response.data?.siteStructure.slug).toBe('new-slug');
    });
  });

  describe('deletePage', () => {
    it('should delete both ContentItem and SiteStructure', async () => {
      const mockSiteStructure = {
        id: 'structure-1',
        contentItemId: 'content-1',
        fullPath: '/test-page'
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(mockSiteStructure),
            delete: jest.fn(),
            deleteMany: jest.fn()
          },
          contentItem: {
            delete: jest.fn()
          }
        };
        return callback(tx);
      });

      // Execute
      const response = await service.deletePage('content-1', {}, 'ui');

      // Verify
      expect(response.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should cascade delete children when option is set', async () => {
      const mockSiteStructure = {
        id: 'structure-1',
        contentItemId: 'content-1',
        fullPath: '/parent'
      };

      let deleteManyCall: { where: { fullPath: { startsWith: string } } } | undefined;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          siteStructure: {
            findFirst: jest.fn().mockResolvedValue(mockSiteStructure),
            delete: jest.fn(),
            deleteMany: jest.fn((args) => {
              deleteManyCall = args;
            })
          },
          contentItem: {
            delete: jest.fn()
          }
        };
        return callback(tx);
      });

      // Execute with cascade
      await service.deletePage('content-1', { cascade: true }, 'ui');

      // Verify cascade delete was called
      expect(deleteManyCall).toBeDefined();
      expect(deleteManyCall.where.fullPath.startsWith).toBe('/parent/');
    });
  });

  describe('Error Handling', () => {
    it('should handle unique constraint violations gracefully', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      const uniqueError = new Error('Unique constraint failed on the fields: (`slug`)');
      mockPageOrchestrator.createPage.mockRejectedValue(uniqueError);

      // Execute
      const response = await service.createContent(
        {
          websiteId: 'website-1',
          contentTypeId: 'content-type-1',
          title: 'Test Page',
          content: {},
          slug: 'duplicate-slug'
        },
        'ai'
      );

      // Verify
      expect(response.success).toBe(false);
      expect(response.errors[0].code).toBe(ErrorCode.SLUG_CONFLICT);
      expect(response.errors[0].recovery?.action).toBe('regenerate_slug');
    });

    it('should handle unexpected errors with internal error code', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      const unexpectedError = new Error('Database connection failed');
      mockPageOrchestrator.createPage.mockRejectedValue(unexpectedError);

      // Execute
      const response = await service.createContent(
        {
          websiteId: 'website-1',
          contentTypeId: 'content-type-1',
          title: 'Test Page',
          content: {}
        },
        'sync'
      );

      // Verify
      expect(response.success).toBe(false);
      expect(response.errors[0].code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response.errors[0].message).toContain('Database connection failed');
      expect(response.errors[0].severity).toBe('critical');
    });
  });

  describe('Orphaned Content Prevention', () => {
    it('should never create ContentItem without SiteStructure for pages', async () => {
      // Setup mocks
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'content-type-1',
        category: 'page' // Page type requires SiteStructure
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      // Simulate partial failure (ContentItem created but SiteStructure fails)
      const transactionError = new Error('Transaction failed');
      mockPageOrchestrator.createPage.mockRejectedValue(transactionError);

      // Execute
      const response = await service.createContent(
        {
          websiteId: 'website-1',
          contentTypeId: 'content-type-1',
          title: 'Test Page',
          content: {}
        },
        'ai'
      );

      // Verify
      expect(response.success).toBe(false);
      
      // Ensure no direct ContentItem creation was attempted (only through PageOrchestrator)
      expect(prisma.websitePage.create).not.toHaveBeenCalled();
      
      // PageOrchestrator handles atomic transaction
      expect(mockPageOrchestrator.createPage).toHaveBeenCalled();
    });

    it('should correctly differentiate between pages and components', async () => {
      // Test 1: Page type
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'page-type',
        category: 'page'
      });
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);
      
      mockPageOrchestrator.createPage.mockResolvedValue({
        websitePage: { id: 'page-1' },
        websiteStructure: { id: 'structure-1' },
        fullPath: '/page'
      });

      const pageResponse = await service.createContent(
        {
          websiteId: 'website-1',
          contentTypeId: 'page-type',
          title: 'Test Page',
          content: {}
        },
        'ai'
      );

      expect(pageResponse.data?.siteStructure).toBeDefined();
      expect(mockPageOrchestrator.createPage).toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Test 2: Component type
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-1' });
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'component-type',
        category: 'component'
      });
      (prisma.websitePage.create as jest.Mock).mockResolvedValue({
        id: 'component-1',
        title: 'Test Component'
      });

      const componentResponse = await service.createContent(
        {
          websiteId: 'website-1',
          contentTypeId: 'component-type',
          title: 'Test Component',
          content: {}
        },
        'ai'
      );

      expect(componentResponse.data?.siteStructure).toBeNull();
      expect(mockPageOrchestrator.createPage).not.toHaveBeenCalled();
      expect(prisma.websitePage.create).toHaveBeenCalled();
    });
  });
});