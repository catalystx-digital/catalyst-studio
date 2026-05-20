import { WebsiteService } from '../website-service';
import { getClient } from '@/lib/db/client';
import { ApiError } from '@/lib/api/errors';
import { deleteWebsiteWithDependencies } from '@/lib/services/website-delete-service';

// Mock Prisma client
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/lib/services/website-delete-service', () => ({
  deleteWebsiteWithDependencies: jest.fn()
}));

describe('WebsiteService', () => {
  let mockPrisma: {
    website: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let websiteService: WebsiteService;

  beforeEach(() => {
    mockPrisma = {
      website: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };
    (getClient as jest.Mock).mockReturnValue(mockPrisma);
    
    // Create new instance for each test
    websiteService = new WebsiteService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebsites', () => {
    it('should return all active websites', async () => {
      const mockWebsites = [
        {
          id: '1',
          name: 'Website 1',
          metadata: { key: 'value' },
          settings: { primaryColor: '#000' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: 'business',
          description: null,
          icon: null
        }
      ];

      mockPrisma.website.findMany.mockResolvedValue(mockWebsites);

      const result = await websiteService.getWebsites();

      expect(mockPrisma.website.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toEqual([
        {
          id: mockWebsites[0].id,
          name: mockWebsites[0].name,
          metadata: mockWebsites[0].metadata,
          settings: mockWebsites[0].settings,
          isActive: mockWebsites[0].isActive,
          createdAt: mockWebsites[0].createdAt,
          updatedAt: mockWebsites[0].updatedAt,
          category: mockWebsites[0].category,
          description: undefined,
          icon: undefined
        }
      ]);
    });
  });

  describe('getWebsite', () => {
    it('should return a single website', async () => {
      const mockWebsite = {
        id: 'test-id',
        name: 'Test Website',
        metadata: { test: true },
        settings: { primaryColor: '#fff' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: 'business',
        description: null,
        icon: null
      };

      mockPrisma.website.findUnique.mockResolvedValue(mockWebsite);

      const result = await websiteService.getWebsite('test-id');

      expect(mockPrisma.website.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      });

      expect(result).toEqual({
        id: mockWebsite.id,
        name: mockWebsite.name,
        metadata: mockWebsite.metadata,
        settings: mockWebsite.settings,
        isActive: mockWebsite.isActive,
        createdAt: mockWebsite.createdAt,
        updatedAt: mockWebsite.updatedAt,
        category: mockWebsite.category,
        description: undefined,
        icon: undefined
      });
    });

    it('should throw 404 error if website not found', async () => {
      mockPrisma.website.findUnique.mockResolvedValue(null);

      await expect(websiteService.getWebsite('non-existent')).rejects.toThrow(ApiError);
      await expect(websiteService.getWebsite('non-existent')).rejects.toThrow('Website not found');
    });
  });

  describe('createWebsite', () => {
    it('should create a new website', async () => {
      const newWebsiteData = {
        name: 'New Website',
        category: 'business',
        metadata: { theme: 'light' },
        settings: { primaryColor: '#007bff' }
      };

      const createdWebsite = {
        id: 'new-id',
        name: newWebsiteData.name,
        category: newWebsiteData.category,
        metadata: newWebsiteData.metadata,
        settings: newWebsiteData.settings,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        icon: null
      };

      mockPrisma.website.create.mockResolvedValue(createdWebsite);

      const result = await websiteService.createWebsite(newWebsiteData);

      expect(mockPrisma.website.create).toHaveBeenCalledWith({
        data: newWebsiteData
      });

      expect(result).toEqual({
        id: createdWebsite.id,
        name: createdWebsite.name,
        metadata: createdWebsite.metadata,
        settings: createdWebsite.settings,
        isActive: createdWebsite.isActive,
        createdAt: createdWebsite.createdAt,
        updatedAt: createdWebsite.updatedAt,
        category: createdWebsite.category,
        description: undefined,
        icon: undefined
      });
    });
  });

  describe('updateWebsite', () => {
    it('should update an existing website', async () => {
      const updateData = {
        name: 'Updated Name',
        settings: { primaryColor: '#ff0000' }
      };

      mockPrisma.website.findUnique.mockResolvedValue({ id: 'test-id' });
      mockPrisma.website.update.mockResolvedValue({
        id: 'test-id',
        name: updateData.name,
        metadata: null,
        settings: updateData.settings,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: 'business',
        description: null,
        icon: null
      });

      const result = await websiteService.updateWebsite('test-id', updateData);

      expect(mockPrisma.website.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: updateData
      });

      expect(result.settings).toEqual(updateData.settings);
    });

    it('should throw 404 if website to update not found', async () => {
      mockPrisma.website.findUnique.mockResolvedValue(null);

      await expect(websiteService.updateWebsite('non-existent', {})).rejects.toThrow(ApiError);
    });
  });

  describe('deleteWebsite', () => {
    it('should permanently delete a website and dependencies', async () => {
      (deleteWebsiteWithDependencies as jest.Mock).mockResolvedValue(undefined);

      await websiteService.deleteWebsite('test-id');

      expect(deleteWebsiteWithDependencies).toHaveBeenCalledWith(mockPrisma, 'test-id');
    });

    it('should throw 404 if website to delete not found', async () => {
      (deleteWebsiteWithDependencies as jest.Mock).mockRejectedValue({ code: 'P2025' });

      await expect(websiteService.deleteWebsite('non-existent')).rejects.toThrow(ApiError);
    });
  });

  describe('getWebsiteSettings', () => {
    it('should return website settings', async () => {
      const mockWebsite = {
        id: 'test-id',
        name: 'Test Website',
        settings: { primaryColor: '#000', features: { blog: true } },
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: 'business',
        description: null,
        icon: null
      };

      mockPrisma.website.findUnique.mockResolvedValue(mockWebsite);

      const result = await websiteService.getWebsiteSettings('test-id');

      expect(result).toEqual({
        primaryColor: '#000',
        features: { blog: true }
      });
    });

    it('should return null if website has no settings', async () => {
      const mockWebsite = {
        id: 'test-id',
        name: 'Test Website',
        settings: null,
        metadata: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: 'business',
        description: null,
        icon: null
      };
      
      mockPrisma.website.findUnique.mockResolvedValue(mockWebsite);

      const result = await websiteService.getWebsiteSettings('test-id');

      expect(result).toBeNull();
    });
  });
});
