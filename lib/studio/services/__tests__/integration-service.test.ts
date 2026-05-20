import { IntegrationProvider, IntegrationStatus, IntegrationUsageAction } from '@/lib/generated/prisma';
import { IntegrationService } from '../integration-service';
import { __resetProviderConfigCache } from '@/lib/cms-export/config';

jest.mock('@/lib/security/crypto', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}));

const { encrypt: mockEncrypt, decrypt: mockDecrypt } = jest.requireMock('@/lib/security/crypto') as {
  encrypt: jest.Mock;
  decrypt: jest.Mock;
};

const prismaMock = {
  accountIntegration: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  integrationUsage: {
    create: jest.fn(),
  },
};

const auditSpy = jest.fn();

const originalEnv = { ...process.env };

interface RecordOptions {
  id?: string;
  accountId?: string;
  provider?: IntegrationProvider;
  displayName?: string;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
  secretCiphertext?: Buffer;
  secretVersion?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  lastTestedAt?: Date | null;
}

function createRecord(overrides: RecordOptions = {}) {
  return {
    id: overrides.id ?? 'int-1',
    accountId: overrides.accountId ?? 'acct-1',
    provider: overrides.provider ?? IntegrationProvider.OPTIMIZELY,
    displayName: overrides.displayName ?? 'Optimizely Prod',
    status: overrides.status ?? IntegrationStatus.enabled,
    config: overrides.config ?? { clientId: 'abc' },
    secretCiphertext: overrides.secretCiphertext ?? Buffer.from('cipher:{}'),
    secretVersion: overrides.secretVersion ?? 'v1',
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01T00:00:00.000Z'),
    createdBy: overrides.createdBy ?? 'user-1',
    updatedBy: overrides.updatedBy ?? 'user-1',
    lastTestedAt: overrides.lastTestedAt ?? null,
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  __resetProviderConfigCache();

  mockEncrypt.mockImplementation((value: string | Buffer) => {
    const text = Buffer.isBuffer(value) ? value.toString('utf8') : value;
    return {
      ciphertext: Buffer.from(`cipher:${text}`),
      keyId: 'v1',
      algorithm: 'aes-256-gcm',
      isEncrypted: true,
    };
  });

  mockDecrypt.mockImplementation((payload: { ciphertext: Buffer }) => {
    const text = payload.ciphertext.toString('utf8');
    const raw = text.startsWith('cipher:') ? text.slice(7) : text;
    return Buffer.from(raw, 'utf8');
  });
});

afterAll(() => {
  process.env = originalEnv;
});

describe('IntegrationService', () => {
  const service = new IntegrationService(prismaMock as any, auditSpy);

  describe('create', () => {
    it('stores redacted config and encrypted secrets', async () => {
      prismaMock.accountIntegration.create.mockImplementation(async ({ data }) => ({
        ...data,
        id: 'int-1',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        lastTestedAt: null,
      }));

      const result = await service.create('acct-1', {
        provider: IntegrationProvider.OPTIMIZELY,
        displayName: 'Optimizely Prod',
        config: {
          clientId: 'abc',
          clientSecret: 'shh',
        },
        actorId: 'user-1',
      });

      expect(prismaMock.accountIntegration.create).toHaveBeenCalled();
      const createArgs = prismaMock.accountIntegration.create.mock.calls[0][0];
      expect(createArgs.data.config).toEqual({ clientId: 'abc' });
      expect(Buffer.isBuffer(createArgs.data.secretCiphertext)).toBe(true);

      expect(result.config).toEqual({ clientId: 'abc', clientSecret: '********' });
      expect(result.secretFields).toEqual({ clientSecret: true });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', integrationId: 'int-1', provider: IntegrationProvider.OPTIMIZELY })
      );
    });

    it('stores contentstack secrets separately from visible config', async () => {
      prismaMock.accountIntegration.create.mockImplementation(async ({ data }) => ({
        ...data,
        id: 'int-2',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        lastTestedAt: null,
      }));

      const result = await service.create('acct-1', {
        provider: IntegrationProvider.CONTENTSTACK,
        displayName: 'Contentstack Dev',
        config: {
          stackApiKey: 'stack-key',
          managementToken: 'management-token',
          environment: 'development',
          locale: 'en-us',
          branch: 'main',
        },
        actorId: 'user-1',
      });

      const createArgs = prismaMock.accountIntegration.create.mock.calls[0][0];
      expect(createArgs.data.config).toEqual({
        environment: 'development',
        locale: 'en-us',
        branch: 'main',
      });
      expect(Buffer.isBuffer(createArgs.data.secretCiphertext)).toBe(true);
      expect(result.config).toMatchObject({
        stackApiKey: '********',
        managementToken: '********',
        environment: 'development',
        locale: 'en-us',
        branch: 'main',
      });
      expect(result.secretFields).toEqual({
        stackApiKey: true,
        managementToken: true,
      });
    });

    it('validates contentstack required fields', async () => {
      await expect(
        service.create('acct-1', {
          provider: IntegrationProvider.CONTENTSTACK,
          displayName: 'Contentstack Invalid',
          config: {
            stackApiKey: 'stack-key',
            environment: 'development',
            locale: 'en-us',
            branch: 'main',
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prismaMock.accountIntegration.create).not.toHaveBeenCalled();
    });

    it('rejects creation when provider is disabled', async () => {
      process.env.CMS_DISABLED_PROVIDERS = 'optimizely';
      __resetProviderConfigCache();

      await expect(
        service.create('acct-1', {
          provider: IntegrationProvider.OPTIMIZELY,
          displayName: 'Optimizely Disabled',
          config: { clientId: 'abc', clientSecret: 'xyz' },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prismaMock.accountIntegration.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns masked integrations for the account', async () => {
      prismaMock.accountIntegration.findMany.mockResolvedValue([
        createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"shh"}') }),
      ]);

      const integrations = await service.list('acct-1');

      expect(prismaMock.accountIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: 'acct-1' } })
      );
      expect(integrations[0].config).toEqual({ clientId: 'abc', clientSecret: '********' });
      expect(integrations[0].secretFields.clientSecret).toBe(true);
      expect(integrations[0].providerDisabled).toBe(false);
    });
  });

  describe('update', () => {
    it('merges config updates and rotates secrets when provided', async () => {
      const existing = createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"old"}') });
      prismaMock.accountIntegration.findFirst.mockResolvedValue(existing);
      prismaMock.accountIntegration.update.mockImplementation(async ({ data }) => ({
        ...existing,
        ...data,
        updatedAt: new Date('2025-02-01T00:00:00.000Z'),
      }));

      const result = await service.update('acct-1', 'int-1', {
        displayName: 'Optimizely EU',
        config: {
          clientSecret: 'new-secret',
          projectId: 'proj-eu',
        },
        actorId: 'user-2',
      });

      expect(prismaMock.accountIntegration.update).toHaveBeenCalled();
      const updateArgs = prismaMock.accountIntegration.update.mock.calls[0][0];
      expect(updateArgs.data.config).toEqual({ clientId: 'abc', projectId: 'proj-eu' });
      expect(result.displayName).toBe('Optimizely EU');
      expect(result.config.clientSecret).toBe('********');
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'update', actorId: 'user-2' }));
    });
  });

  describe('delete', () => {
    it('disables the integration when hardDelete is false', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(createRecord());

      await service.delete('acct-1', 'int-1', { actorId: 'user-9' });

      expect(prismaMock.accountIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: IntegrationStatus.disabled }) })
      );
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', actorId: 'user-9' }));
    });

    it('removes the record when hardDelete is true', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(createRecord());

      await service.delete('acct-1', 'int-1', { hardDelete: true });

      expect(prismaMock.accountIntegration.delete).toHaveBeenCalledWith({ where: { id: 'int-1' } });
    });
  });

  describe('resolveForDeployment', () => {
    it('returns integration config with decrypted secrets', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"shh"}') }),
      );

      const result = await service.resolveForDeployment('acct-1', 'int-1');

      expect(prismaMock.accountIntegration.findFirst).toHaveBeenCalledWith({
        where: { id: 'int-1', accountId: 'acct-1' },
      });
      expect(result.integration.id).toBe('int-1');
      expect(result.providerConfig).toEqual({ clientId: 'abc', clientSecret: 'shh' });
    });

    it('normalises contentful runtime configuration', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({
          provider: IntegrationProvider.CONTENTFUL,
          config: { spaceId: 'space-123', environment: 'preview' },
          secretCiphertext: Buffer.from('cipher:{"accessToken":"cma-token"}'),
        }),
      );

      const result = await service.resolveForDeployment('acct-1', 'int-1');

      expect(result.providerConfig).toEqual(
        expect.objectContaining({
          spaceId: 'space-123',
          workspace: 'space-123',
          environment: 'preview',
          accessToken: 'cma-token',
          apiKey: 'cma-token',
        }),
      );
    });
    it('throws when integration is disabled', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({ status: IntegrationStatus.disabled }),
      );

      await expect(service.resolveForDeployment('acct-1', 'int-1')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('throws when provider is disabled by configuration', async () => {
      process.env.CMS_DISABLED_PROVIDERS = 'optimizely';
      __resetProviderConfigCache();
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"shh"}') }),
      );

      await expect(service.resolveForDeployment('acct-1', 'int-1')).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe('test', () => {
    it('records usage and updates status', async () => {
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"shh"}') })
      );

      await service.test('acct-1', 'int-1', { actorId: 'user-5' });

      expect(prismaMock.accountIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: IntegrationStatus.enabled }) })
      );
      expect(prismaMock.integrationUsage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountIntegrationId: 'int-1',
            action: IntegrationUsageAction.test,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'test', actorId: 'user-5', success: true }));
    });

    it('throws when trying to test a disabled provider', async () => {
      process.env.CMS_DISABLED_PROVIDERS = 'optimizely';
      __resetProviderConfigCache();
      prismaMock.accountIntegration.findFirst.mockResolvedValue(
        createRecord({ secretCiphertext: Buffer.from('cipher:{"clientSecret":"shh"}') })
      );

      await expect(service.test('acct-1', 'int-1')).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
