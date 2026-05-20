/**
 * Test suite for /api/websites route handlers
 * Updated for Next.js 15 App Router compatibility:
 * - Proper NextRequest mocking
 * - Response.json() handling
 * - Console error suppression for expected errors
 * - Enhanced Prisma client mocking
 */
import { GET, POST } from '../route';
import { getClient } from '@/lib/db/client';
import { getAuthContext } from '@/lib/auth/context';
import { checkAndRecordUsage } from '@/lib/usage/limits';
import { createTestRequest, suppressConsoleError, restoreConsoleError } from './test-helpers';

// Mock Prisma client
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/usage/limits', () => ({
  checkAndRecordUsage: jest.fn(),
}));

describe('/api/websites', () => {
  // Mock global Response for Next.js 15
  beforeAll(() => {
    global.Response = Response;
  });

  let mockPrisma: {
    website: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };
  const mockGetAuthContext = getAuthContext as jest.MockedFunction<typeof getAuthContext>;
  const mockCheckAndRecordUsage = checkAndRecordUsage as jest.MockedFunction<typeof checkAndRecordUsage>;

  beforeEach(() => {
    mockPrisma = {
      website: {
        findMany: jest.fn(),
        create: jest.fn()
      }
    };
    (getClient as jest.Mock).mockReturnValue(mockPrisma);
    mockGetAuthContext.mockResolvedValue({ accountId: 'acct-1' } as any);
    mockCheckAndRecordUsage.mockResolvedValue({
      kind: 'website_create',
      limit: 5,
      period: 'day',
      used: 1,
      available: 4,
      mode: 'log',
    } as any);
    suppressConsoleError();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreConsoleError();
  });

  describe('GET /api/websites', () => {
    it('should return all active websites for the account', async () => {
      const mockWebsites = [
        {
          id: '1',
          name: 'Test Website',
          description: 'Test description',
          category: 'test',
          metadata: { test: true },
          settings: { primaryColor: '#000' },
          icon: '🌐',
          isActive: true,
          accountId: 'acct-1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.website.findMany.mockResolvedValue(mockWebsites);

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites', 'GET');
      const response = await GET(request as any);
      const data = await response.json();

      expect(mockPrisma.website.findMany).toHaveBeenCalledWith({
        where: { isActive: true, accountId: 'acct-1' },
        orderBy: { createdAt: 'desc' }
      });

      expect(data.data).toBeDefined();
      expect(data.data[0]).toMatchObject({
        id: '1',
        name: 'Test Website',
        metadata: { test: true },
        settings: { primaryColor: '#000' }
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.website.findMany.mockRejectedValue(new Error('Database error'));

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites', 'GET');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST /api/websites', () => {
    it('should create a new website after quota check', async () => {
      const newWebsite = {
        name: 'New Website',
        description: 'New description',
        category: 'business',
        metadata: { theme: 'dark' },
        settings: { primaryColor: '#007bff' },
        icon: '🚀',
        isActive: true
      };

      const createdWebsite = {
        id: 'new-id',
        ...newWebsite,
        accountId: 'acct-1',
        metadata: newWebsite.metadata,
        settings: newWebsite.settings,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.website.create.mockResolvedValue(createdWebsite);

      const request = createTestRequest(newWebsite);

      const response = await POST(request as any);
      const data = await response.json();

      expect(mockCheckAndRecordUsage).toHaveBeenCalledWith(expect.anything(), 'acct-1', 'website_create', 1, expect.objectContaining({
        metadata: expect.any(Object),
      }));
      expect(mockPrisma.website.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: newWebsite.name,
          accountId: 'acct-1',
        }),
      });
      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
      expect(data.data).toMatchObject({
        id: 'new-id',
        name: newWebsite.name,
        metadata: newWebsite.metadata,
        settings: newWebsite.settings
      });
    });

    it('should handle validation errors', async () => {
      const invalidWebsite = {
        // Missing required 'name' field
        category: 'business'
      };

      const request = createTestRequest(invalidWebsite);

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle prisma errors gracefully', async () => {
      const newWebsite = {
        name: 'New Website',
        category: 'business'
      };

      mockPrisma.website.create.mockRejectedValue({ code: 'P2002', meta: { target: ['name'] } });

      const request = createTestRequest(newWebsite);

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe('DUPLICATE_ENTRY');
    });

    it('should handle empty request body', async () => {
      const request = createTestRequest(undefined);

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

