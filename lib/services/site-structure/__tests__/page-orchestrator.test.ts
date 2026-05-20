import { PageOrchestrator } from '../page-orchestrator';
import { PrismaClient } from '@prisma/client';
import { generateUniqueSlug } from '../slug-validator';
import { getSlugValidationDetails } from '../slug-manager';
import {
  InvalidSlugError,
  DuplicateSlugError,
  CircularReferenceError
} from '../errors';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn()
  }
}));

// Mock slug validator functions
jest.mock('../slug-validator', () => ({
  generateUniqueSlug: jest.fn(),
  validateAndSuggestSlug: jest.fn()
}));

// Mock slug manager functions
jest.mock('../slug-manager', () => ({
  generateSlug: jest.fn(),
  getSlugValidationDetails: jest.fn()
}));

describe('PageOrchestrator', () => {
  let orchestrator: PageOrchestrator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTx: any;

  beforeEach(() => {
    // Setup mock transaction client
    mockTx = {
      contentType: {
        findUnique: jest.fn()
      },
      contentItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      siteStructure: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn()
      }
    };

    mockPrisma = {
      $transaction: jest.fn((callback) => callback(mockTx)),
      siteStructure: {
        findFirst: jest.fn(),
        findUnique: jest.fn()
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orchestrator = new PageOrchestrator(mockPrisma as any);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createPage', () => {
    const websiteId = 'website-123';
    const createDto = {
      title: 'Test Page',
      contentTypeId: 'content-type-123',
      content: { body: 'Test content' },
      metadata: { key: 'value' }
    };

    it('should create a page atomically with ContentItem and SiteStructure', async () => {
      // Arrange
      const mockContentType = { id: 'content-type-123', name: 'Page' };
      const mockContentItem = {
        id: 'content-123',
        websiteId,
        contentTypeId: createDto.contentTypeId,
        title: createDto.title,
        slug: 'test-page',
        content: createDto.content,
        metadata: createDto.metadata,
        status: 'draft',
        version: 1
      };
      const mockSiteStructure = {
        id: 'structure-123',
        websiteId,
        contentItemId: mockContentItem.id,
        parentId: null,
        slug: 'test-page',
        position: 0,
        pathDepth: 0,
        materializedPath: '',
        fullPath: '/test-page',
        isVisible: true
      };

      mockTx.contentType.findUnique.mockResolvedValue(mockContentType);
      mockTx.websitePage.findFirst.mockResolvedValue(null);
      mockTx.websiteStructure.findFirst.mockResolvedValue(null);
      mockTx.websitePage.create.mockResolvedValue(mockContentItem);
      mockTx.websiteStructure.create.mockResolvedValue(mockSiteStructure);
      mockTx.websiteStructure.findUnique.mockResolvedValue(null);
      mockTx.websiteStructure.findMany.mockResolvedValue([]);

      (generateUniqueSlug as jest.Mock).mockResolvedValue('test-page');
      (getSlugValidationDetails as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      // Act
      const result = await orchestrator.createPage(createDto, websiteId);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.contentType.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.contentTypeId }
      });
      expect(mockTx.websitePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId,
          title: createDto.title,
          slug: 'test-page'
        })
      });
      expect(mockTx.websiteStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId,
          contentItemId: mockContentItem.id,
          slug: 'test-page',
          fullPath: '/test-page'
        })
      });
      expect(result).toEqual({
        contentItem: mockContentItem,
        siteStructure: mockSiteStructure,
        fullPath: '/test-page',
        breadcrumbs: []
      });
    });

    it('should throw error if content type does not exist', async () => {
      // Arrange
      mockTx.contentType.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(orchestrator.createPage(createDto, websiteId))
        .rejects
        .toThrow(`Content type ${createDto.contentTypeId} not found`);
    });

    it('should throw DuplicateSlugError if slug already exists', async () => {
      // Arrange
      const mockContentType = { id: 'content-type-123', name: 'Page' };
      const existingItem = { id: 'existing-123', slug: 'test-page' };

      mockTx.contentType.findUnique.mockResolvedValue(mockContentType);
      mockTx.websitePage.findFirst.mockResolvedValue(existingItem);

      (generateUniqueSlug as jest.Mock).mockResolvedValue('test-page');
      (getSlugValidationDetails as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      // Act & Assert
      await expect(orchestrator.createPage(createDto, websiteId))
        .rejects
        .toThrow(DuplicateSlugError);
    });

    it('should throw InvalidSlugError if slug validation fails', async () => {
      // Arrange
      const mockContentType = { id: 'content-type-123', name: 'Page' };

      mockTx.contentType.findUnique.mockResolvedValue(mockContentType);

      (generateUniqueSlug as jest.Mock).mockResolvedValue('invalid slug');
      (getSlugValidationDetails as jest.Mock).mockReturnValue({ 
        valid: false, 
        errors: ['Slug contains spaces'] 
      });

      // Act & Assert
      await expect(orchestrator.createPage(createDto, websiteId))
        .rejects
        .toThrow(InvalidSlugError);
    });

    it('should calculate correct depth and path for nested pages', async () => {
      // Arrange
      const parentId = 'parent-123';
      const createDtoWithParent = { ...createDto, parentId };
      const mockContentType = { id: 'content-type-123', name: 'Page' };
      const mockParent = {
        id: parentId,
        pathDepth: 1,
        fullPath: '/parent'
      };

      mockTx.contentType.findUnique.mockResolvedValue(mockContentType);
      mockTx.websitePage.findFirst.mockResolvedValue(null);
      mockTx.websiteStructure.findUnique.mockResolvedValue(mockParent);
      mockTx.websiteStructure.findFirst.mockResolvedValue(null);
      mockTx.websitePage.create.mockResolvedValue({ id: 'content-123' });
      mockTx.websiteStructure.create.mockResolvedValue({ id: 'structure-123' });
      mockTx.websiteStructure.findMany.mockResolvedValue([]);

      (generateUniqueSlug as jest.Mock).mockResolvedValue('test-page');
      (getSlugValidationDetails as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      // Act
      await orchestrator.createPage(createDtoWithParent, websiteId);

      // Assert
      expect(mockTx.websiteStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId,
          pathDepth: 2,
          fullPath: '/parent/test-page'
        })
      });
    });
  });

  describe('updatePage', () => {
    const pageId = 'structure-123';
    const updateDto = {
      title: 'Updated Title',
      slug: 'updated-slug'
    };

    it('should update page and sync slug between ContentItem and SiteStructure', async () => {
      // Arrange
      const mockExisting = {
        id: pageId,
        slug: 'old-slug',
        fullPath: '/old-slug',
        parentId: null,
        contentItem: {
          id: 'content-123',
          websiteId: 'website-123',
          title: 'Old Title',
          slug: 'old-slug',
          content: {},
          metadata: {},
          status: 'draft'
        }
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockExisting);
      mockTx.websitePage.findFirst.mockResolvedValue(null);
      mockTx.websitePage.update.mockResolvedValue({ 
        ...mockExisting.websitePage, 
        title: updateDto.title,
        slug: updateDto.slug 
      });
      mockTx.websiteStructure.update.mockResolvedValue({
        ...mockExisting,
        slug: updateDto.slug,
        fullPath: '/updated-slug'
      });
      mockTx.websiteStructure.findMany.mockResolvedValue([]);

      (getSlugValidationDetails as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      // Act
      const result = await orchestrator.updatePage(pageId, updateDto);

      // Assert
      expect(mockTx.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'content-123' },
        data: expect.objectContaining({
          title: updateDto.title,
          slug: updateDto.slug
        })
      });
      expect(mockTx.websiteStructure.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: expect.objectContaining({
          slug: updateDto.slug,
          fullPath: '/updated-slug'
        })
      });
      expect(result.fullPath).toBe('/updated-slug');
    });

    it('should cascade path updates to descendants when slug changes', async () => {
      // Arrange
      const mockExisting = {
        id: pageId,
        slug: 'old-slug',
        fullPath: '/old-slug',
        parentId: null,
        contentItem: { id: 'content-123', websiteId: 'website-123' }
      };
      const mockDescendant = {
        id: 'child-123',
        fullPath: '/old-slug/child',
        materializedPath: pageId
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockExisting);
      mockTx.websitePage.findFirst.mockResolvedValue(null);
      mockTx.websitePage.update.mockResolvedValue({});
      mockTx.websiteStructure.update.mockResolvedValue({});
      mockTx.websiteStructure.findMany.mockResolvedValue([mockDescendant]);

      (getSlugValidationDetails as jest.Mock).mockReturnValue({ valid: true, errors: [] });

      // Act
      await orchestrator.updatePage(pageId, updateDto);

      // Assert
      expect(mockTx.websiteStructure.findMany).toHaveBeenCalledWith({
        where: { fullPath: { startsWith: '/old-slug/' } }
      });
      expect(mockTx.websiteStructure.update).toHaveBeenCalledWith({
        where: { id: mockDescendant.id },
        data: { fullPath: '/updated-slug/child' }
      });
    });

    it('should throw error if page does not exist', async () => {
      // Arrange
      mockTx.websiteStructure.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(orchestrator.updatePage(pageId, updateDto))
        .rejects
        .toThrow(`Page ${pageId} not found`);
    });
  });

  describe('deletePage', () => {
    const pageId = 'structure-123';

    it('should delete page and content atomically', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        contentItem: { id: 'content-123' },
        children: []
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockStructure);

      // Act
      await orchestrator.deletePage(pageId);

      // Assert
      expect(mockTx.websiteStructure.delete).toHaveBeenCalledWith({
        where: { id: pageId }
      });
      expect(mockTx.websitePage.delete).toHaveBeenCalledWith({
        where: { id: 'content-123' }
      });
    });

    it('should cascade delete children when option specified', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        contentItem: { id: 'content-123' },
        children: [
          { id: 'child-1', contentItemId: 'content-child-1' },
          { id: 'child-2', contentItemId: 'content-child-2' }
        ]
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockStructure);
      mockTx.websiteStructure.findMany.mockResolvedValue([]);

      // Act
      await orchestrator.deletePage(pageId, { cascade: true });

      // Assert
      expect(mockTx.websiteStructure.findMany).toHaveBeenCalled();
      expect(mockTx.websiteStructure.delete).toHaveBeenCalledWith({
        where: { id: pageId }
      });
    });

    it('should orphan children when option specified', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        parentId: 'grandparent-123',
        pathDepth: 2,
        contentItem: { id: 'content-123' },
        children: [{ id: 'child-1' }, { id: 'child-2' }]
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockStructure);

      // Act
      await orchestrator.deletePage(pageId, { orphanChildren: true });

      // Assert
      expect(mockTx.websiteStructure.updateMany).toHaveBeenCalledWith({
        where: { parentId: pageId },
        data: { 
          parentId: 'grandparent-123',
          pathDepth: 2
        }
      });
    });

    it('should throw error if page has children without cascade option', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        contentItem: { id: 'content-123' },
        children: [{ id: 'child-1' }]
      };

      mockTx.websiteStructure.findUnique.mockResolvedValue(mockStructure);

      // Act & Assert
      await expect(orchestrator.deletePage(pageId))
        .rejects
        .toThrow('Page has children. Use cascade or orphanChildren option.');
    });
  });

  describe('movePage', () => {
    const pageId = 'structure-123';

    it('should move page to new parent and update paths', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        slug: 'page',
        pathDepth: 0,
        materializedPath: '',
        fullPath: '/page',
        websiteId: 'website-123',
        contentItem: { id: 'content-123' }
      };
      const mockNewParent = {
        id: 'parent-123',
        pathDepth: 0,
        materializedPath: '',
        fullPath: '/parent'
      };

      mockTx.websiteStructure.findUnique
        .mockResolvedValueOnce(mockStructure)  // First call for finding the page
        .mockResolvedValueOnce(mockStructure)  // Second call for circular check (node)
        .mockResolvedValueOnce(mockNewParent)  // Third call for finding new parent
        .mockResolvedValueOnce(mockStructure); // Fourth call in updateDescendantDepths
      mockTx.websiteStructure.findFirst.mockResolvedValue(null);
      mockTx.websiteStructure.update.mockResolvedValue({
        ...mockStructure,
        parentId: 'parent-123',
        pathDepth: 1,
        fullPath: '/parent/page'
      });
      mockTx.websiteStructure.findMany.mockResolvedValue([]);

      // Act
      const result = await orchestrator.movePage(pageId, { newParentId: 'parent-123' });

      // Assert
      expect(mockTx.websiteStructure.update).toHaveBeenCalledWith({
        where: { id: pageId },
        data: expect.objectContaining({
          parentId: 'parent-123',
          pathDepth: 1,
          fullPath: '/parent/page'
        })
      });
      expect(result.fullPath).toBe('/parent/page');
    });

    it('should detect and prevent circular references', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        slug: 'page',
        fullPath: '/page',
        contentItem: { id: 'content-123' }
      };
      const mockDescendant = {
        id: 'descendant-123',
        fullPath: '/page/child/descendant'
      };

      mockTx.websiteStructure.findUnique
        .mockResolvedValueOnce(mockStructure)  // First call for finding the page
        .mockResolvedValueOnce(mockDescendant) // Second call for finding new parent
        .mockResolvedValueOnce(mockStructure);  // Third call for circular check

      // Act & Assert
      await expect(orchestrator.movePage(pageId, { newParentId: 'descendant-123' }))
        .rejects
        .toThrow(CircularReferenceError);
    });

    it('should update descendant depths when moving', async () => {
      // Arrange
      const mockStructure = {
        id: pageId,
        slug: 'page',
        pathDepth: 1,
        fullPath: '/old/page',
        contentItem: { id: 'content-123' }
      };
      const mockDescendant = {
        id: 'child-123',
        pathDepth: 2,
        fullPath: '/old/page/child'
      };

      mockTx.websiteStructure.findUnique
        .mockResolvedValueOnce(mockStructure)  // First call for finding the page
        .mockResolvedValueOnce(mockStructure); // Second call in updateDescendantDepths
      mockTx.websiteStructure.findFirst.mockResolvedValue(null);
      mockTx.websiteStructure.update.mockResolvedValue({});
      mockTx.websiteStructure.findMany.mockResolvedValue([mockDescendant]);

      // Act
      await orchestrator.movePage(pageId, { newParentId: null });

      // Assert
      expect(mockTx.websiteStructure.update).toHaveBeenCalledWith({
        where: { id: 'child-123' },
        data: { pathDepth: 1 } // depth decreased by 1
      });
    });
  });

  describe('resolveUrl', () => {
    const websiteId = 'website-123';

    it('should resolve URL path to page', async () => {
      // Arrange
      const mockStructure = {
        id: 'structure-123',
        fullPath: '/about/team',
        contentItem: {
          id: 'content-123',
          title: 'Team'
        }
      };

      mockPrisma.websiteStructure.findFirst.mockResolvedValue(mockStructure);
      
      // Mock for breadcrumbs - getBreadcrumbs uses the PrismaClient directly
      mockPrisma.websiteStructure.findUnique = jest.fn().mockResolvedValue({
        ...mockStructure,
        parentId: null
      });

      // Act
      const result = await orchestrator.resolveUrl('/about/team', websiteId);

      // Assert
      expect(mockPrisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId,
          fullPath: '/about/team'
        },
        include: { contentItem: true }
      });
      expect(result?.fullPath).toBe('/about/team');
    });

    it('should return null for non-existent paths', async () => {
      // Arrange
      mockPrisma.websiteStructure.findFirst.mockResolvedValue(null);

      // Act
      const result = await orchestrator.resolveUrl('/non-existent', websiteId);

      // Assert
      expect(result).toBeNull();
    });

    it('should normalize paths before resolving', async () => {
      // Arrange
      mockPrisma.websiteStructure.findFirst.mockResolvedValue(null);

      // Act
      await orchestrator.resolveUrl('about/team', websiteId); // without leading slash

      // Assert
      expect(mockPrisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId,
          fullPath: '/about/team' // normalized with leading slash
        },
        include: { contentItem: true }
      });
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback transaction on any error', async () => {
      // Arrange
      const createDto = {
        title: 'Test Page',
        contentTypeId: 'content-type-123'
      };
      const websiteId = 'website-123';

      // Simulate error in transaction
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(orchestrator.createPage(createDto, websiteId))
        .rejects
        .toThrow('Database error');

      // Verify transaction was attempted
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});