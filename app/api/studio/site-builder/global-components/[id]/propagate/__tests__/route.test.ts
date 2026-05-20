import { POST } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: { 
      findUnique: jest.fn()
    },
    websitePage: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    websiteCustomContentData: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

// Get prisma from the mock for TypeScript
import { prisma } from '@/lib/prisma';

describe('Global Components Propagation API', () => {
  describe('POST /api/studio/site-builder/global-components/[id]/propagate', () => {
    const mockRequest = (body: Record<string, unknown>) => {
      return {
        json: jest.fn().mockResolvedValue(body)
      } as unknown as NextRequest;
    };

    const mockParams = { id: 'test-component-id' };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should propagate changes to all pages using the component', async () => {
      const mockSharedComponent = {
        id: 'test-component-id',
        websiteId: 'test-website-id',
        config: { title: 'Old Title' }
      };

      const mockPages = [
        {
          id: 'page-1',
          title: 'Page 1',
          websiteId: 'test-website-id',
          content: {
            components: [
              {
                type: 'hero',
                props: {
                  sharedComponentId: 'test-component-id',
                  title: 'Old Title'
                }
              }
            ]
          }
        }
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          websiteSharedComponent: {
            update: jest.fn().mockResolvedValue({}),
          },
          websitePage: {
            findUnique: jest.fn().mockResolvedValue(mockPages[0]),
            update: jest.fn().mockResolvedValue({})
          },
          websiteCustomContentData: {
            findUnique: jest.fn(),
            update: jest.fn()
          }
        };
        return await fn(tx);
      });

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' }
        }),
        { params: Promise.resolve(mockParams) }
      );

      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.updated).toBe(1);
      expect(data.totalUsages).toBe(1);
      expect(prisma.websiteSharedComponent.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-component-id' }
      });
    });
    
    it('should handle component not found with 404', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' }
        }),
        { params: Promise.resolve(mockParams) }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Shared component not found');
    });
    
    it('should skip pages with overrides when skipOverrides is true', async () => {
      const mockSharedComponent = {
        id: 'test-component-id',
        websiteId: 'test-website-id',
        config: {}
      };

      const mockPages = [
        {
          id: 'page-1',
          title: 'Page 1',
          content: {
            components: [{
              props: {
                sharedComponentId: 'test-component-id',
                hasOverrides: true
              }
            }]
          }
        },
        {
          id: 'page-2',
          title: 'Page 2',
          content: {
            components: [{
              props: {
                sharedComponentId: 'test-component-id'
              }
            }]
          }
        }
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          websiteSharedComponent: {
            update: jest.fn().mockResolvedValue({}),
          },
          websitePage: {
            findUnique: jest.fn().mockImplementation((args) => {
              if (args.where.id === 'page-2') {
                return Promise.resolve(mockPages[1]);
              }
              return Promise.resolve(null);
            }),
            update: jest.fn().mockResolvedValue({})
          },
          websiteCustomContentData: {
            findUnique: jest.fn(),
            update: jest.fn()
          }
        };
        return await fn(tx);
      });

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' },
          options: { skipOverrides: true }
        }),
        { params: Promise.resolve(mockParams) }
      );

      const data = await response.json();
      
      expect(data.updated).toBe(1);
      expect(data.skipped).toBe(1);
    });
    
    it('should handle dry-run mode without making changes', async () => {
      const mockSharedComponent = {
        id: 'test-component-id',
        websiteId: 'test-website-id',
        config: {}
      };

      const mockPages = [
        {
          id: 'page-1',
          title: 'Page 1',
          content: {
            components: [{
              props: { sharedComponentId: 'test-component-id' }
            }]
          }
        }
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' },
          options: { dryRun: true }
        }),
        { params: Promise.resolve(mockParams) }
      );

      const data = await response.json();
      
      expect(data.dryRun).toBe(true);
      expect(data.wouldUpdate).toBe(1);
      expect(data.affectedPages).toEqual(['page-1']);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    
    it('should handle malformed JSON gracefully', async () => {
      const mockSharedComponent = {
        id: 'test-component-id',
        websiteId: 'test-website-id',
        config: {}
      };

      const mockPages = [
        {
          id: 'page-1',
          title: 'Page 1',
          content: {
            components: [{
              props: { sharedComponentId: 'test-component-id' }
            }]
          }
        },
        {
          id: 'page-2',
          title: 'Page 2',
          content: null // This page has invalid content structure
        }
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([mockPages[0]]); // Only first page found by query
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          websiteSharedComponent: {
            update: jest.fn().mockResolvedValue({}),
          },
          websitePage: {
            findUnique: jest.fn().mockImplementation((args) => {
              if (args.where.id === 'page-1') {
                // Return page with null content to simulate corruption during transaction
                return Promise.resolve({ ...mockPages[0], content: null });
              }
              return Promise.resolve(null);
            }),
            update: jest.fn()
          },
          websiteCustomContentData: {
            findUnique: jest.fn(),
            update: jest.fn()
          }
        };
        return await fn(tx);
      });

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' }
        }),
        { params: Promise.resolve(mockParams) }
      );

      const data = await response.json();
      
      expect(data.success).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0].errorType).toBe('VALIDATION_ERROR');
      expect(data.errors[0].error).toBe('Invalid content structure');
    });
    
    it('should return partial success when some pages fail', async () => {
      const mockSharedComponent = {
        id: 'test-component-id',
        websiteId: 'test-website-id',
        config: {}
      };

      const mockPages = [
        {
          id: 'page-1',
          title: 'Page 1',
          content: {
            components: [{
              props: { sharedComponentId: 'test-component-id' }
            }]
          }
        },
        {
          id: 'page-2',
          title: 'Page 2',
          content: {
            components: [{
              props: { sharedComponentId: 'test-component-id' }
            }]
          }
        }
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          websiteSharedComponent: {
            update: jest.fn().mockResolvedValue({}),
          },
          websitePage: {
            findUnique: jest.fn().mockImplementation((args) => {
              if (args.where.id === 'page-1') {
                return Promise.resolve(mockPages[0]);
              }
              return Promise.resolve(null); // Page 2 not found
            }),
            update: jest.fn().mockResolvedValue({})
          },
          websiteCustomContentData: {
            findUnique: jest.fn(),
            update: jest.fn()
          }
        };
        return await fn(tx);
      });

      const response = await POST(
        mockRequest({
          properties: { title: 'New Title' }
        }),
        { params: Promise.resolve(mockParams) }
      );

      const data = await response.json();
      
      expect(data.success).toBe(false); // False because there were errors
      expect(data.partialSuccess).toBe(true); // But partial success is true
      expect(data.updated).toBe(1);
      expect(data.errors.length).toBe(1);
      expect(data.errors[0].error).toBe('Page not found');
      expect(data.errors[0].errorType).toBe('NOT_FOUND');
    });
  });
});