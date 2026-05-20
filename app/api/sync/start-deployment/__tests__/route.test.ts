import { NextRequest } from 'next/server';

import { POST } from '../route';
import { getAuthContext } from '@/lib/auth/context';
import { withTransaction } from '@/lib/utils/transaction-manager';
import { prisma } from '@/lib/prisma';
import { IntegrationService } from '@/lib/studio/services/integration-service';
import { ErrorHandlers } from '@/lib/api/errors';
import { IntegrationProvider, IntegrationUsageAction } from '@/lib/generated/prisma';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/utils/transaction-manager', () => ({
  withTransaction: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
    deployment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    integrationUsage: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/studio/services/integration-service', () => ({
  IntegrationService: jest.fn(),
}));

jest.mock('@/lib/providers/registry', () => ({
  ProviderRegistry: {
    getInstance: jest.fn(() => ({
      getProvider: jest.fn().mockReturnValue(null),
      register: jest.fn(),
      setActiveProvider: jest.fn(),
    })),
  },
}));

jest.mock('@/lib/providers/factory', () => ({
  ProviderFactory: {
    createProvider: jest.fn(() => ({})),
  },
}));

jest.mock('@/lib/services/export/bundle-exporter', () => ({
  BundleExporter: jest.fn().mockImplementation(() => ({
    export: jest.fn().mockResolvedValue({
      exportData: {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: { totalFolders: 0 },
      },
      syncResults: null,
    }),
  })),
}));

const mockGetAuthContext = getAuthContext as jest.MockedFunction<typeof getAuthContext>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const IntegrationServiceMock = IntegrationService as unknown as jest.MockedClass<typeof IntegrationService>;

const baseIntegration = {
  id: 'int-1',
  provider: IntegrationProvider.STRAPI,
  displayName: 'Strapi Prod',
};

describe('POST /api/sync/start-deployment', () => {
  const mockTx = {
    deployment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    integrationUsage: {
      create: jest.fn(),
    },
  } as unknown as Parameters<typeof withTransaction>[0];

  const integrationServiceInstance = {
    resolveForDeployment: jest.fn(),
  } as unknown as jest.Mocked<{ resolveForDeployment: typeof IntegrationService.prototype.resolveForDeployment }>;

  let setImmediateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({ accountId: 'acct-1', userId: 'user-1' } as any);
    mockPrisma.website.findUnique.mockResolvedValue({ id: 'web-1', accountId: 'acct-1' } as any);
    (mockTx as any).deployment.findFirst.mockResolvedValue(null);
    (mockTx as any).deployment.create.mockResolvedValue({
      id: 'dep-1',
      status: 'pending',
      deploymentData: { progress: 0 },
    });
    (mockTx as any).integrationUsage.create.mockResolvedValue({ id: 'usage-1' });
    mockPrisma.deployment.update.mockResolvedValue({} as any);

    integrationServiceInstance.resolveForDeployment.mockResolvedValue({
      integration: baseIntegration as any,
      providerConfig: { apiToken: 'secret' },
    });
    IntegrationServiceMock.mockImplementation(() => integrationServiceInstance as any);

    mockWithTransaction.mockImplementation(async (fn: any) => fn(mockTx));

    setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(() => ({}) as any);
  });

  afterEach(() => {
    setImmediateSpy.mockRestore();
  });

  it('queues a deployment when integration enforcement is enabled', async () => {
    const request = new NextRequest('http://localhost/api/sync/start-deployment', {
      method: 'POST',
      body: JSON.stringify({
        websiteId: 'web-1',
        integrationId: 'int-1',
        selectedTypes: ['page'],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.website.findUnique).toHaveBeenCalledWith({
      where: { id: 'web-1' },
      select: { id: true, accountId: true },
    });
    expect((mockTx as any).deployment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        accountIntegrationId: 'int-1',
        accountId: 'acct-1',
        provider: 'strapi',
      }),
    }));
    expect((mockTx as any).integrationUsage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: IntegrationUsageAction.deploy,
        accountIntegrationId: 'int-1',
        metadata: expect.objectContaining({ status: 'queued' }),
      }),
    }));
  });

  it('returns 400 when integrationId is missing under enforced mode', async () => {
    const request = new NextRequest('http://localhost/api/sync/start-deployment', {
      method: 'POST',
      body: JSON.stringify({ websiteId: 'web-1', selectedTypes: [] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  it('returns 403 when website belongs to another account', async () => {
    mockPrisma.website.findUnique.mockResolvedValue({ id: 'web-1', accountId: 'acct-other' } as any);

    const request = new NextRequest('http://localhost/api/sync/start-deployment', {
      method: 'POST',
      body: JSON.stringify({
        websiteId: 'web-1',
        integrationId: 'int-1',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  it('bubbles integration service errors', async () => {
    integrationServiceInstance.resolveForDeployment.mockRejectedValueOnce(
      ErrorHandlers.conflict('Integration disabled'),
    );

    const request = new NextRequest('http://localhost/api/sync/start-deployment', {
      method: 'POST',
      body: JSON.stringify({
        websiteId: 'web-1',
        integrationId: 'int-1',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });
});

