import { checkAndRecordUsage, getQuotaUsageSnapshot, QuotaExceededError, QUOTA_KINDS } from '../limits';

function createPrismaMock(options: {
  limits?: unknown;
  quotaRows?: Array<{ kind: string; value: number; period?: string | null }>;
  aggregateResponses?: Array<number>;
}) {
  const aggregateValues = options.aggregateResponses ?? [0];
  let callIndex = 0;

  return {
    account: {
      upsert: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ limits: options.limits ?? null }),
    },
    accountQuota: {
      findMany: jest.fn().mockResolvedValue(options.quotaRows ?? []),
    },
    usageEvent: {
      aggregate: jest.fn().mockImplementation(() => {
        const value = aggregateValues[Math.min(callIndex, aggregateValues.length - 1)];
        callIndex += 1;
        return Promise.resolve({ _sum: { amount: value } });
      }),
      create: jest.fn().mockResolvedValue(null),
    },
  } as unknown as Parameters<typeof checkAndRecordUsage>[0];
}

describe('quota service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs quota overage in log mode without throwing', async () => {
    const prisma = createPrismaMock({
      limits: {
        quotaMode: 'log',
        quotaOverrides: {
          page_create: { limit: 1 },
        },
      },
      aggregateResponses: [1],
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      checkAndRecordUsage(prisma, 'acct-1', 'page_create', 1, { metadata: { test: true } })
    ).resolves.toMatchObject({ used: 2, available: expect.any(Number) });

    expect((prisma as any).usageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: 'acct-1', kind: 'page_create' }),
    });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('throws QuotaExceededError in enforce mode', async () => {
    const prisma = createPrismaMock({
      limits: {
        quotaMode: 'enforce',
        quotaOverrides: {
          page_create: { limit: 1 },
        },
      },
      aggregateResponses: [1],
    });

    await expect(
      checkAndRecordUsage(prisma, 'acct-1', 'page_create', 1)
    ).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it('generates usage snapshot with mode and all quota kinds', async () => {
    const prisma = createPrismaMock({
      limits: {
        quotaMode: 'enforce',
      },
      quotaRows: [
        { kind: 'credits', value: 100, period: 'month' },
      ],
      aggregateResponses: [1, 2, 3, 4, 5, 6],
    });

    const snapshot = await getQuotaUsageSnapshot(prisma as any, 'acct-1');
    console.log('snapshot', snapshot);
    expect(snapshot.mode).toBe('enforce');
    expect(Object.keys(snapshot.quotas)).toEqual(QUOTA_KINDS); 
    expect(snapshot.quotas.credits.limit).toBe(100);
    expect(snapshot.quotas.chat_sessions.used).toBe(5);
  });
});
