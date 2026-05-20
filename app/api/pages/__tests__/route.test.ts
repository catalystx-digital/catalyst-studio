import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/prisma';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { checkAndRecordUsage, QuotaExceededError } from '@/lib/usage/limits';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/site-structure/page-orchestrator', () => ({
  pageOrchestrator: {
    createPage: jest.fn(),
    listPages: jest.fn(),
  },
}));

jest.mock('@/lib/usage/limits', () => ({
  checkAndRecordUsage: jest.fn(),
  QuotaExceededError: jest.requireActual('@/lib/usage/limits').QuotaExceededError,
}));

const mockGetAuthContext = getAuthContext as jest.MockedFunction<typeof getAuthContext>;
const mockWebsiteFindUnique = prisma.website.findUnique as jest.MockedFunction<typeof prisma.website.findUnique>;
const mockCreatePage = pageOrchestrator.createPage as jest.MockedFunction<typeof pageOrchestrator.createPage>;
const mockListPages = pageOrchestrator.listPages as jest.MockedFunction<typeof pageOrchestrator.listPages>;
const mockCheckUsage = checkAndRecordUsage as jest.MockedFunction<typeof checkAndRecordUsage>;

describe('/api/pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ accountId: 'acct-1' } as any);
    mockWebsiteFindUnique.mockResolvedValue({ id: 'web-1' } as any);
    mockCreatePage.mockResolvedValue({ id: 'page-1' } as any);
    mockListPages.mockResolvedValue({ pages: [] } as any);
    mockCheckUsage.mockResolvedValue({
      kind: 'page_create',
      limit: 50,
      used: 1,
      available: 49,
      period: 'day',
      mode: 'log',
    } as any);
  });

  describe('POST', () => {
    it('creates a page after quota check', async () => {
      const request = new NextRequest('http://localhost:3000/api/pages', {
        method: 'POST',
        headers: { 'x-website-id': 'web-1' },
        body: JSON.stringify({ title: 'Page', contentTypeId: 'ct-1' }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(mockCheckUsage).toHaveBeenCalledWith(expect.anything(), 'acct-1', 'page_create', 1, expect.any(Object));
      expect(mockCreatePage).toHaveBeenCalledWith(expect.objectContaining({ title: 'Page' }), 'web-1');
      expect(response.status).toBe(201);
      expect(payload.id).toBe('page-1');
    });

    it('returns quota error when enforcement blocks request', async () => {
      const quotaError = new QuotaExceededError('page_create', {
        kind: 'page_create',
        limit: 50,
        used: 50,
        available: 0,
        period: 'day',
        mode: 'enforce',
      }, 1);
      mockCheckUsage.mockRejectedValueOnce(quotaError);

      const request = new NextRequest('http://localhost:3000/api/pages', {
        method: 'POST',
        headers: { 'x-website-id': 'web-1' },
        body: JSON.stringify({ title: 'Page', contentTypeId: 'ct-1' }),
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(402);
      expect(payload.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('rejects when website does not belong to account', async () => {
      mockWebsiteFindUnique.mockResolvedValueOnce(null as any);
      const request = new NextRequest('http://localhost:3000/api/pages', {
        method: 'POST',
        headers: { 'x-website-id': 'web-99' },
        body: JSON.stringify({ title: 'Page', contentTypeId: 'ct-1' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  describe('GET', () => {
    it('lists pages for owned website', async () => {
      mockListPages.mockResolvedValueOnce({ pages: [{ id: 'p1' }] } as any);
      const request = new NextRequest('http://localhost:3000/api/pages?includeContent=false', {
        method: 'GET',
        headers: { 'x-website-id': 'web-1' },
      });
      const response = await GET(request);
      const payload = await response.json();
      expect(mockListPages).toHaveBeenCalledWith('web-1', expect.objectContaining({ includeContent: false }));
      expect(payload.pages).toHaveLength(1);
    });

    it('requires website header', async () => {
      const request = new NextRequest('http://localhost:3000/api/pages', { method: 'GET' });
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });
});
