import { digestApiKey } from '@/lib/ucs/auth/api-key-digest';

process.env.UCS_GRAPHQL_KEY_RATE_LIMIT = '2';
process.env.UCS_GRAPHQL_IP_RATE_LIMIT = '5';
process.env.UCS_GRAPHQL_RATE_WINDOW_MS = '60000';

const updateMock = jest.fn();
const findFirstMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    accountApiKey: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

describe('authenticateGraphqlRequest', () => {
  beforeEach(() => {
    jest.resetModules();
    findFirstMock.mockReset();
    updateMock.mockReset();
    updateMock.mockResolvedValue({ id: 'key-1' });
  });

  it('rejects when header missing', async () => {
    const { authenticateGraphqlRequest, GraphqlAuthError } = require('../graphql-api-key-auth');
    const request = new Request('http://localhost', { method: 'POST' });
    await expect(authenticateGraphqlRequest(request)).rejects.toBeInstanceOf(GraphqlAuthError);
  });

  it('allows valid key and schedules usage update', async () => {
    const { authenticateGraphqlRequest, __internal } = require('../graphql-api-key-auth');
    __internal.keyLimiter.reset();
    __internal.ipLimiter.reset();

    const secret = 'ucs_acct1_TEST';
    const digest = digestApiKey(secret);
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      accountId: 'acct-1',
      websiteId: null,
      primaryKeyHash: digest,
      secondaryKeyHash: null,
      scopes: ['ACCOUNT_READ'],
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-ucs-api-key': secret },
    });

    const result = await authenticateGraphqlRequest(request, { variables: null });

    expect(result.accountId).toBe('acct-1');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
    });
  });

  it('enforces website scope against variables', async () => {
    const { authenticateGraphqlRequest, GraphqlAuthError, __internal } = require('../graphql-api-key-auth');
    __internal.keyLimiter.reset();
    __internal.ipLimiter.reset();

    const secret = 'ucs_acct1_TEST';
    const digest = digestApiKey(secret);
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      accountId: 'acct-1',
      websiteId: 'site-a',
      primaryKeyHash: digest,
      secondaryKeyHash: null,
      scopes: ['WEBSITE_READ'],
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-ucs-api-key': secret },
    });

    await expect(
      authenticateGraphqlRequest(request, { variables: { websiteId: 'site-b' } }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    } as GraphqlAuthError);
  });

  it('applies rate limiting per key', async () => {
    const { authenticateGraphqlRequest, GraphqlAuthError, __internal } = require('../graphql-api-key-auth');
    __internal.keyLimiter.reset();
    __internal.ipLimiter.reset();

    const secret = 'ucs_acct1_TEST';
    const digest = digestApiKey(secret);
    findFirstMock.mockResolvedValue({
      id: 'key-1',
      accountId: 'acct-1',
      websiteId: null,
      primaryKeyHash: digest,
      secondaryKeyHash: null,
      scopes: ['ACCOUNT_READ'],
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-ucs-api-key': secret, 'x-forwarded-for': '10.0.0.1' },
    });

    await authenticateGraphqlRequest(request);
    await authenticateGraphqlRequest(request);

    __internal.ipLimiter.reset();

    await expect(authenticateGraphqlRequest(request)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    } as GraphqlAuthError);
  });
});
