import { ApiKeyService } from '@/lib/services/api-key-service';
import {
  AccountApiKeyScope,
  AccountApiKeyStatus,
  AccountApiKeyEventType,
} from '@/lib/generated/prisma';

const baseRecord = () => ({
  id: 'key-1',
  accountId: 'acct-1',
  websiteId: 'web-1',
  label: 'Head export',
  hashedSecret: 'hash-1',
  salt: 'salt-1',
  scopes: [AccountApiKeyScope.WEBSITE_READ],
  issuedBy: 'user-1',
  issuedAt: new Date('2025-01-01T00:00:00.000Z'),
  expiresAt: null,
  lastUsedAt: null,
  status: AccountApiKeyStatus.active,
  primaryKeyHash: 'hash-1',
  secondaryKeyHash: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
});

describe('ApiKeyService', () => {
const prismaMock: Record<string, any> = {
    accountApiKey: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    accountApiKeyEvent: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    website: {
      findFirst: jest.fn(),
    },
  } as unknown as Parameters<typeof ApiKeyService>[0];

  let service: ApiKeyService;
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiKeyService(prismaMock as any);
    prismaMock.website.findFirst.mockResolvedValue({ id: 'web-1' });
    prismaMock.accountApiKey.create.mockImplementation(async ({ data }) => ({
      ...baseRecord(),
      ...data,
      id: 'key-1',
      hashedSecret: data.hashedSecret,
      primaryKeyHash: data.primaryKeyHash,
      salt: data.salt,
    }));
    prismaMock.accountApiKey.findFirst.mockResolvedValue(baseRecord());
    prismaMock.accountApiKey.update.mockImplementation(async ({ data }) => ({
      ...baseRecord(),
      ...data,
      updatedAt: new Date(),
    }));
    prismaMock.accountApiKey.findMany.mockResolvedValue([baseRecord()]);
    prismaMock.accountApiKeyEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        apiKeyId: 'key-1',
        accountId: 'acct-1',
        websiteId: 'web-1',
        action: AccountApiKeyEventType.issued,
        actorId: 'user-1',
        metadata: { note: 'initial' },
        occurredAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(1);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('creates a website-scoped key and logs audit event', async () => {
    const result = await service.create('acct-1', {
      label: 'Partner storefront',
      websiteId: 'web-1',
      actorId: 'user-9',
    });

    expect(result.plaintextKey).toMatch(/^ucs_acct/);
    expect(result.key.scopes).toEqual([AccountApiKeyScope.WEBSITE_READ]);
    expect(prismaMock.accountApiKeyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AccountApiKeyEventType.issued,
          actorId: 'user-9',
        }),
      }),
    );
  });

  it('rotates an active key and emits audit event', async () => {
    const record = baseRecord();
    prismaMock.accountApiKey.findFirst.mockResolvedValue(record);

    await service.rotate('acct-1', 'key-1', { actorId: 'user-2' });

    expect(prismaMock.accountApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: expect.objectContaining({ secondaryKeyHash: record.primaryKeyHash }),
      }),
    );
    expect(prismaMock.accountApiKeyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AccountApiKeyEventType.rotated }),
      }),
    );
  });

  it('revokes a key and marks status revoked', async () => {
    prismaMock.accountApiKey.update.mockResolvedValue({
      ...baseRecord(),
      status: AccountApiKeyStatus.revoked,
    });

    const result = await service.revoke('acct-1', 'key-1', { actorId: 'user-3', reason: 'compromised' });

    expect(result.status).toBe(AccountApiKeyStatus.revoked);
    expect(prismaMock.accountApiKeyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AccountApiKeyEventType.revoked,
          metadata: { reason: 'compromised' },
        }),
      }),
    );
  });

  it('lists keys filtered by website', async () => {
    const result = await service.list('acct-1', 'web-1');
    expect(result).toHaveLength(1);
    expect(prismaMock.accountApiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: 'acct-1' }) }),
    );
  });

  it('returns audit events limited to retention window', async () => {
    const events = await service.getEvents('acct-1', 'key-1', { limit: 10 });
    expect(events[0].action).toBe('issued');
    expect(prismaMock.accountApiKeyEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
