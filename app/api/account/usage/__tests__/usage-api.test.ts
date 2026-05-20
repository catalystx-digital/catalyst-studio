import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { getQuotaUsageSnapshot } from '@/lib/usage/limits';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/usage/limits', () => {
  const actual = jest.requireActual('@/lib/usage/limits');
  return {
    ...actual,
    getQuotaUsageSnapshot: jest.fn(),
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importJob: {
      count: jest.fn(),
    },
    website: {
      count: jest.fn(),
    },
    aIContext: {
      findMany: jest.fn(),
    },
    accountIntegration: {
      count: jest.fn(),
    },
    usageEvent: {
      deleteMany: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

type MockedPrisma = jest.Mocked<typeof prisma>;
const mockedPrisma = prisma as MockedPrisma;
const mockGetAuthContext = getAuthContext as jest.MockedFunction<typeof getAuthContext>;
const mockGetQuotaSnapshot = getQuotaUsageSnapshot as jest.MockedFunction<typeof getQuotaUsageSnapshot>;

describe('/api/account/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ accountId: 'acct-1' } as any);
    mockGetQuotaSnapshot.mockResolvedValue({
      mode: 'log',
      quotas: {
        import_page: { kind: 'import_page', limit: 5, used: 1, available: 4, period: 'day', mode: 'log' },
        chat_tokens: { kind: 'chat_tokens', limit: 20000, used: 500, available: 19500, period: 'day', mode: 'log' },
        website_create: { kind: 'website_create', limit: 5, used: 1, available: 4, period: 'day', mode: 'log' },
        page_create: { kind: 'page_create', limit: 50, used: 10, available: 40, period: 'day', mode: 'log' },
        chat_sessions: { kind: 'chat_sessions', limit: 25, used: 2, available: 23, period: 'day', mode: 'log' },
        credits: { kind: 'credits', limit: null, used: 0, available: null, period: 'all', mode: 'log' },
      },
    } as any);
    mockedPrisma.importJob.count.mockResolvedValue(0 as any);
    mockedPrisma.website.count.mockResolvedValue(0 as any);
    mockedPrisma.aIContext.findMany.mockResolvedValue([] as any);
    mockedPrisma.accountIntegration.count.mockResolvedValue(0 as any);
    mockedPrisma.account.findUnique.mockResolvedValue({ limits: null } as any);
    mockedPrisma.account.update.mockResolvedValue({} as any);
  });

  describe('GET', () => {
    it('returns quota snapshot with integrations', async () => {
      mockedPrisma.accountIntegration.count
        .mockResolvedValueOnce(3 as any)
        .mockResolvedValueOnce(2 as any);

      const request = new NextRequest('http://localhost:3000/api/account/usage');
      const response = await GET(request);
      const payload = await response.json();

      if (response.status !== 200) {
        throw new Error('GET failed: ' + JSON.stringify(payload));
      }

      expect(payload.data.enforcement.mode).toBe('log');
      expect(payload.data.integrations).toEqual({ total: 3, enabled: 2 });
      expect(payload.data.quotas.import_page.used).toBe(1);
      expect(payload.data.quotas.chat_tokens.used).toBe(500);
    });

    it('applies import fallback when snapshot undercounts', async () => {
      mockedPrisma.importJob.count.mockResolvedValueOnce(3 as any);

      const request = new NextRequest('http://localhost:3000/api/account/usage');
      const response = await GET(request);
      const payload = await response.json();

      if (response.status !== 200) {
        throw new Error('GET failed: ' + JSON.stringify(payload));
      }

      expect(payload.data.quotas.import_page.used).toBe(3);
    });

    it('applies chat token fallback when snapshot undercounts', async () => {
      mockedPrisma.aIContext.findMany.mockResolvedValueOnce([
        { metadata: { tokens: 1000 } },
        { metadata: { tokens: 2000 } },
      ] as any);

      const request = new NextRequest('http://localhost:3000/api/account/usage');
      const response = await GET(request);
      const payload = await response.json();

      if (response.status !== 200) {
        throw new Error('GET failed: ' + JSON.stringify(payload));
      }

      expect(payload.data.quotas.chat_tokens.used).toBe(3000);
    });

    it('skips import fallback when a reset occurred later in the day', async () => {
      const resetAt = new Date().toISOString();
      mockedPrisma.account.findUnique.mockResolvedValueOnce({
        limits: { usageResets: { import_page: { day: resetAt } } },
      } as any);
      mockedPrisma.importJob.count.mockImplementationOnce(async (args: any) => {
        expect(args?.where?.createdAt?.gte).toBeInstanceOf(Date);
        expect((args.where.createdAt.gte as Date).toISOString()).toBe(new Date(resetAt).toISOString());
        return 0 as any;
      });

      const request = new NextRequest('http://localhost:3000/api/account/usage');
      const response = await GET(request);
      const payload = await response.json();

      if (response.status !== 200) {
        throw new Error('GET failed: ' + JSON.stringify(payload));
      }

      expect(payload.data.quotas.import_page.used).toBe(1);
    });
  });

  describe('POST', () => {
    it('resets usage for all quotas', async () => {
      const request = new NextRequest('http://localhost:3000/api/account/usage', {
        method: 'POST',
        body: JSON.stringify({ action: 'reset', kind: 'all', period: 'day' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockedPrisma.usageEvent.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ accountId: 'acct-1' }),
      });
      expect(mockedPrisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acct-1' },
        data: {
          limits: expect.objectContaining({
            usageResets: expect.objectContaining({
              import_page: expect.objectContaining({ day: expect.any(String) }),
              chat_tokens: expect.objectContaining({ day: expect.any(String) }),
              website_create: expect.objectContaining({ day: expect.any(String) }),
              page_create: expect.objectContaining({ day: expect.any(String) }),
              chat_sessions: expect.objectContaining({ day: expect.any(String) }),
              credits: expect.objectContaining({ day: expect.any(String) }),
            }),
          }),
        },
      });
    });

    it('rejects invalid quota kind', async () => {
      const request = new NextRequest('http://localhost:3000/api/account/usage', {
        method: 'POST',
        body: JSON.stringify({ action: 'reset', kind: 'unknown', period: 'day' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
