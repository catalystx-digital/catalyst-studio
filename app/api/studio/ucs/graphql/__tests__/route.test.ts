/** @jest-environment node */

import type { NextRequest } from 'next/server';

import { POST } from '../route';

import type { GraphqlAuthContext } from '@/lib/ucs/auth/graphql-api-key-auth';
import { authenticateGraphqlRequest } from '@/lib/ucs/auth/graphql-api-key-auth';
import { recordGraphqlMetric } from '@/lib/studio/graphql/metrics';
import { createGraphqlContext } from '@/lib/studio/graphql/context';

jest.mock('@/lib/studio/graphql/context', () => ({
  createGraphqlContext: jest.fn(() => ({})),
}));

jest.mock('@/lib/studio/graphql/metrics', () => ({
  recordGraphqlMetric: jest.fn(),
}));

jest.mock('@/lib/studio/graphql/schema', () => {
  const { makeExecutableSchema } = require('@graphql-tools/schema');
  let resolverImpl = () => 'pong';
  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        ping: String!
      }
    `,
    resolvers: {
      Query: {
        ping: () => resolverImpl(),
      },
    },
  });
  return {
    ucsGraphqlSchema: schema,
    __setPingResolver: (fn: () => unknown) => {
      resolverImpl = fn;
    },
  };
});

const schemaModule = require('@/lib/studio/graphql/schema') as {
  __setPingResolver: (fn: () => unknown) => void;
};

const baseAuthContext: GraphqlAuthContext = {
  accountId: 'acct_test',
  keyId: 'key_test',
  websiteId: null,
  scopes: [],
  rateLimits: {
    key: { allowed: true, limit: 120, remaining: 119 },
    ip: { allowed: true, limit: 20, remaining: 19 },
  },
};

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/studio/ucs/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('UCS GraphQL route hardening', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (authenticateGraphqlRequest as jest.Mock).mockResolvedValue(baseAuthContext);
    schemaModule.__setPingResolver(() => 'pong');
    process.env.UCS_GRAPHQL_TIMEOUT_MS = '50';
  });

  afterEach(() => {
    delete process.env.ALLOW_GRAPHQL_INTROSPECTION;
    process.env.NODE_ENV = 'test';
  });

  it('executes GraphQL queries with rate headers', async () => {
    const response = await POST(createRequest({ query: '{ ping }' }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.ping).toBe('pong');
    expect(response.headers.get('X-RateLimit-Limit')).toBe(String(baseAuthContext.rateLimits.key.limit));
    expect(recordGraphqlMetric).toHaveBeenCalled();
  });

  it('blocks introspection in production without override', async () => {
    process.env.NODE_ENV = 'production';
    const response = await POST(createRequest({ query: '{ __schema { queryType { name } } }' }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors[0].message).toMatch(/introspection query is not allowed/i);
  });

  it('enforces complexity limit', async () => {
    const aliases = Array.from({ length: 600 }, (_, index) => `f${index}: ping`).join('\n');
    const response = await POST(createRequest({ query: `query { ${aliases} }` }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.errors[0].message).toMatch(/too complex/i);
  });

  it('terminates long running queries after the configured timeout', async () => {
    schemaModule.__setPingResolver(() => new Promise(() => {}));
    const response = await POST(createRequest({ query: '{ ping }' }));
    const payload = await response.json();
    expect(response.status).toBe(504);
    expect(payload.errors[0].message).toBe('QUERY_TIMEOUT');
  });
});
