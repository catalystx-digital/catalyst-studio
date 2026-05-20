import { NextRequest } from 'next/server';

import { ErrorHandlers } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { IntegrationProvider, IntegrationStatus } from '@/lib/generated/prisma';

import { GET, POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';
import { POST as POST_TEST } from '../[id]/test/route';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

const mockService = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  test: jest.fn(),
};

jest.mock('@/lib/studio/services/integration-service', () => ({
  IntegrationService: jest.fn(() => mockService),
}));

type MockedAuth = jest.MockedFunction<typeof getAuthContext>;
const mockGetAuthContext = getAuthContext as MockedAuth;

const defaultAuth = { accountId: 'acct-1', userId: 'user-1' } as any;

function createRequest(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe('account integrations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue(defaultAuth);
  });

  describe('GET /api/studio/account/integrations', () => {
    it('returns integrations for the authenticated account', async () => {
      mockService.list.mockResolvedValue([
        {
          id: 'int-1',
          provider: IntegrationProvider.OPTIMIZELY,
          status: IntegrationStatus.enabled,
          config: {},
          secretFields: {},
          accountId: 'acct-1',
          providerDisabled: false,
        },
        {
          id: 'int-2',
          provider: IntegrationProvider.MOCK,
          status: IntegrationStatus.disabled,
          config: {},
          secretFields: {},
          accountId: 'acct-1',
          providerDisabled: false,
        },
      ]);

      const request = createRequest('http://localhost/api/studio/account/integrations');
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].provider).toBe('optimizely');
      expect(payload.data[0].providerDisabled).toBe(false);
      expect(mockService.list).toHaveBeenCalledWith('acct-1');
    });

    it('includes disabled integrations when requested', async () => {
      mockService.list.mockResolvedValue([
        {
          id: 'int-1',
          provider: IntegrationProvider.MOCK,
          status: IntegrationStatus.disabled,
          config: {},
          secretFields: {},
          accountId: 'acct-1',
          providerDisabled: true,
        },
      ]);

      const request = createRequest('http://localhost/api/studio/account/integrations?includeDisabled=true');
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].provider).toBe('mock');
      expect(payload.data[0].providerDisabled).toBe(true);
    });

    it('returns 401 when auth fails', async () => {
      mockGetAuthContext.mockRejectedValue(ErrorHandlers.unauthorized('Sign in required'));

      const request = createRequest('http://localhost/api/studio/account/integrations');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/studio/account/integrations', () => {
    it('creates a new integration', async () => {
      mockService.create.mockResolvedValue({
        id: 'int-1',
        provider: IntegrationProvider.OPTIMIZELY,
        status: IntegrationStatus.enabled,
        config: {},
        secretFields: {},
        accountId: 'acct-1',
        lastTestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        providerDisabled: false,
      });

      const request = createRequest('http://localhost/api/studio/account/integrations', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'optimizely',
          displayName: 'Opti',
          config: { clientId: 'abc', clientSecret: 'shh' },
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.data.id).toBe('int-1');
      expect(payload.data.provider).toBe('optimizely');
      expect(payload.data.providerDisabled).toBe(false);
      expect(mockService.create).toHaveBeenCalledWith('acct-1', expect.objectContaining({ actorId: 'user-1' }));
    });

    it('returns 400 for invalid payload', async () => {
      const request = createRequest('http://localhost/api/studio/account/integrations', {
        method: 'POST',
        body: JSON.stringify({ provider: 'optimizely' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBeDefined();
    });
  });

  describe('PATCH /api/studio/account/integrations/[id]', () => {
    it('updates the integration', async () => {
      mockService.update.mockResolvedValue({
        id: 'int-1',
        provider: IntegrationProvider.OPTIMIZELY,
        status: IntegrationStatus.enabled,
        displayName: 'Updated',
        config: {},
        secretFields: {},
        accountId: 'acct-1',
        lastTestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        providerDisabled: false,
      });

      const request = createRequest('http://localhost/api/studio/account/integrations/int-1', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'Updated' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'int-1' }) });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.displayName).toBe('Updated');
      expect(payload.data.provider).toBe('optimizely');
      expect(payload.data.providerDisabled).toBe(false);
      expect(mockService.update).toHaveBeenCalledWith('acct-1', 'int-1', expect.objectContaining({ actorId: 'user-1' }));
    });

    it('returns 400 when id is missing', async () => {
      const request = createRequest('http://localhost/api/studio/account/integrations/', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'Updated' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: '' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/studio/account/integrations/[id]', () => {
    it('disables the integration by default', async () => {
      const request = createRequest('http://localhost/api/studio/account/integrations/int-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'int-1' }) });

      expect(response.status).toBe(204);
      expect(mockService.delete).toHaveBeenCalledWith('acct-1', 'int-1', expect.objectContaining({ actorId: 'user-1' }));
    });
  });

  describe('POST /api/studio/account/integrations/[id]/test', () => {
    it('runs integration connectivity test', async () => {
      mockService.test.mockResolvedValue({ success: true });

      const request = createRequest('http://localhost/api/studio/account/integrations/int-1/test', {
        method: 'POST',
      });

      const response = await POST_TEST(request, { params: Promise.resolve({ id: 'int-1' }) });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data).toEqual({ success: true });
      expect(mockService.test).toHaveBeenCalledWith('acct-1', 'int-1', { actorId: 'user-1' });
    });
  });
});
