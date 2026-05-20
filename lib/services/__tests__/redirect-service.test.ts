import { RedirectService } from '../redirect-service';
import { prisma } from '@/lib/prisma';
import { ErrorCode } from '@/lib/services/types';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    redirect: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

describe('RedirectService', () => {
  let service: RedirectService;
  const mockWebsiteId = 'test-website-id';

  beforeEach(() => {
    service = new RedirectService();
    jest.clearAllMocks();
  });

  describe('createRedirect', () => {
    it('should create a valid redirect', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/old-page',
        targetPath: '/new-page',
        redirectType: 301 as const
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.create as jest.Mock).mockResolvedValue({
        id: 'redirect-1',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await service.createRedirect(input);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'redirect-1',
        sourcePath: '/old-page',
        targetPath: '/new-page',
        redirectType: 301
      });
    });

    it('should normalize paths when creating redirect', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/old-page/',
        targetPath: 'new-page',
        redirectType: 302 as const
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.create as jest.Mock).mockImplementation((args) => 
        Promise.resolve({
          id: 'redirect-1',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      const result = await service.createRedirect(input);

      expect(result.success).toBe(true);
      expect(prisma.redirect.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourcePath: '/old-page',
          targetPath: '/new-page'
        })
      });
    });

    it('should reject self-redirects', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/same-page',
        targetPath: '/same-page',
        redirectType: 301 as const
      };

      const result = await service.createRedirect(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('cannot be the same');
    });

    it('should reject paths with invalid characters', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/old<script>',
        targetPath: '/new-page',
        redirectType: 301 as const
      };

      const result = await service.createRedirect(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('invalid characters');
    });

    it('should reject duplicate redirects', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/old-page',
        targetPath: '/new-page',
        redirectType: 301 as const
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-redirect',
        sourcePath: '/old-page'
      });

      const result = await service.createRedirect(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.CONFLICT);
      expect(result.error?.message).toContain('already exists');
    });

    it('should detect potential redirect loops', async () => {
      const input = {
        websiteId: mockWebsiteId,
        sourcePath: '/page-a',
        targetPath: '/page-b',
        redirectType: 301 as const
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);
      
      // Simulate existing redirect from page-b back to page-a
      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/page-b',
          targetPath: '/page-a'
        })
        .mockResolvedValueOnce(null);

      const result = await service.createRedirect(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('create a loop');
    });
  });

  describe('updateRedirect', () => {
    it('should update an existing redirect', async () => {
      const existing = {
        id: 'redirect-1',
        websiteId: mockWebsiteId,
        sourcePath: '/old',
        targetPath: '/new',
        redirectType: 301,
        isActive: true
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.update as jest.Mock).mockResolvedValue({
        ...existing,
        targetPath: '/updated',
        redirectType: 302
      });

      const result = await service.updateRedirect({
        id: 'redirect-1',
        targetPath: '/updated',
        redirectType: 302
      });

      expect(result.success).toBe(true);
      expect(result.data?.targetPath).toBe('/updated');
      expect(result.data?.redirectType).toBe(302);
    });

    it('should return error for non-existent redirect', async () => {
      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.updateRedirect({
        id: 'non-existent',
        targetPath: '/new'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('should validate updated paths', async () => {
      const existing = {
        id: 'redirect-1',
        websiteId: mockWebsiteId,
        sourcePath: '/old',
        targetPath: '/new',
        redirectType: 301
      };

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(existing);

      const result = await service.updateRedirect({
        id: 'redirect-1',
        sourcePath: '/old',
        targetPath: '/old' // Same as source
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('deleteRedirect', () => {
    it('should delete a redirect', async () => {
      (prisma.redirect.delete as jest.Mock).mockResolvedValue({});

      const result = await service.deleteRedirect('redirect-1');

      expect(result.success).toBe(true);
      expect(prisma.redirect.delete).toHaveBeenCalledWith({
        where: { id: 'redirect-1' }
      });
    });
  });

  describe('resolveRedirectChain', () => {
    it('should resolve a simple redirect', async () => {
      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/old',
          targetPath: '/new'
        })
        .mockResolvedValueOnce(null);

      const result = await service.resolveRedirectChain(mockWebsiteId, '/old');

      expect(result.finalPath).toBe('/new');
      expect(result.hops).toBe(1);
      expect(result.chain).toEqual(['/old', '/new']);
      expect(result.hasLoop).toBe(false);
    });

    it('should resolve a redirect chain', async () => {
      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/step1',
          targetPath: '/step2'
        })
        .mockResolvedValueOnce({
          sourcePath: '/step2',
          targetPath: '/step3'
        })
        .mockResolvedValueOnce({
          sourcePath: '/step3',
          targetPath: '/final'
        })
        .mockResolvedValueOnce(null);

      const result = await service.resolveRedirectChain(mockWebsiteId, '/step1');

      expect(result.finalPath).toBe('/final');
      expect(result.hops).toBe(3);
      expect(result.chain).toEqual(['/step1', '/step2', '/step3', '/final']);
      expect(result.hasLoop).toBe(false);
    });

    it('should limit redirect chain to 3 hops', async () => {
      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValue({
          sourcePath: '/infinite',
          targetPath: '/infinite2'
        });

      const result = await service.resolveRedirectChain(mockWebsiteId, '/infinite');

      expect(result.hops).toBe(3);
      expect(result.chain.length).toBe(4); // Initial + 3 hops
    });

    it('should detect redirect loops', async () => {
      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/loop1',
          targetPath: '/loop2'
        })
        .mockResolvedValueOnce({
          sourcePath: '/loop2',
          targetPath: '/loop1' // Loop back
        });

      const result = await service.resolveRedirectChain(mockWebsiteId, '/loop1');

      expect(result.hasLoop).toBe(true);
      expect(result.chain).toEqual(['/loop1', '/loop2']);
    });

    it('should return original path if no redirect exists', async () => {
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveRedirectChain(mockWebsiteId, '/no-redirect');

      expect(result.finalPath).toBe('/no-redirect');
      expect(result.hops).toBe(0);
      expect(result.chain).toEqual(['/no-redirect']);
      expect(result.hasLoop).toBe(false);
    });
  });

  describe('listRedirects', () => {
    it('should list all redirects for a website', async () => {
      const mockRedirects = [
        { id: '1', sourcePath: '/old1', targetPath: '/new1' },
        { id: '2', sourcePath: '/old2', targetPath: '/new2' }
      ];

      (prisma.redirect.findMany as jest.Mock).mockResolvedValue(mockRedirects);

      const result = await service.listRedirects(mockWebsiteId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRedirects);
      expect(prisma.redirect.findMany).toHaveBeenCalledWith({
        where: { websiteId: mockWebsiteId },
        take: 100,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should filter by active status', async () => {
      (prisma.redirect.findMany as jest.Mock).mockResolvedValue([]);

      await service.listRedirects(mockWebsiteId, { isActive: true });

      expect(prisma.redirect.findMany).toHaveBeenCalledWith({
        where: { websiteId: mockWebsiteId, isActive: true },
        take: 100,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should support pagination', async () => {
      (prisma.redirect.findMany as jest.Mock).mockResolvedValue([]);

      await service.listRedirects(mockWebsiteId, { limit: 10, offset: 20 });

      expect(prisma.redirect.findMany).toHaveBeenCalledWith({
        where: { websiteId: mockWebsiteId },
        take: 10,
        skip: 20,
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('bulkImportRedirects', () => {
    it('should import multiple redirects', async () => {
      const redirects = [
        { sourcePath: '/old1', targetPath: '/new1', redirectType: 301 as const },
        { sourcePath: '/old2', targetPath: '/new2', redirectType: 302 as const }
      ];

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: 'new-id', ...args.data })
      );

      const result = await service.bulkImportRedirects(mockWebsiteId, redirects);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(2);
      expect(result.data?.failed).toBe(0);
      expect(result.data?.errors).toEqual([]);
    });

    it('should handle partial failures in bulk import', async () => {
      const redirects = [
        { sourcePath: '/valid', targetPath: '/new', redirectType: 301 as const },
        { sourcePath: '/invalid', targetPath: '/invalid', redirectType: 301 as const } // Self-redirect
      ];

      (prisma.redirect.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.redirect.create as jest.Mock).mockResolvedValueOnce({
        id: 'success-id',
        sourcePath: '/valid',
        targetPath: '/new'
      });

      const result = await service.bulkImportRedirects(mockWebsiteId, redirects);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      expect(result.data?.failed).toBe(1);
      expect(result.data?.errors.length).toBe(1);
      expect(result.data?.errors[0].sourcePath).toBe('/invalid');
    });
  });
});