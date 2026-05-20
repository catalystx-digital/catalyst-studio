import { timingSafeEqual } from 'node:crypto';

import { AccountApiKeyStatus, type AccountApiKeyScope } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import { digestApiKey } from '@/lib/ucs/auth/api-key-digest';
import { TokenBucketRateLimiter, type RateLimitStatus } from '@/lib/ucs/rate-limiter';

const KEY_LIMIT = Number(process.env.UCS_GRAPHQL_KEY_RATE_LIMIT ?? 120);
const IP_LIMIT = Number(process.env.UCS_GRAPHQL_IP_RATE_LIMIT ?? 20);
const WINDOW_MS = Number(process.env.UCS_GRAPHQL_RATE_WINDOW_MS ?? 60_000);

const keyLimiter = new TokenBucketRateLimiter(KEY_LIMIT, WINDOW_MS);
const ipLimiter = new TokenBucketRateLimiter(IP_LIMIT, WINDOW_MS);

export class GraphqlAuthError extends Error {
  constructor(
    public status: number,
    public code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'KEY_EXPIRED' | 'RATE_LIMITED',
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface GraphqlAuthContext {
  accountId: string;
  keyId: string;
  websiteId: string | null;
  scopes: AccountApiKeyScope[];
  rateLimits: {
    key: RateLimitStatus;
    ip: RateLimitStatus;
  };
}

export async function authenticateGraphqlRequest(
  request: Request,
  options?: { variables?: Record<string, unknown> | null },
): Promise<GraphqlAuthContext> {
  const headerValue = request.headers.get('x-ucs-api-key');
  if (!headerValue) {
    logAuthDecision({ outcome: 'denied', reason: 'missing-header' });
    throw new GraphqlAuthError(401, 'UNAUTHENTICATED', 'x-ucs-api-key header required');
  }

  const digest = digestApiKey(headerValue.trim());

  const record = await prisma.accountApiKey.findFirst({
    where: {
      OR: [{ primaryKeyHash: digest }, { secondaryKeyHash: digest }],
      status: AccountApiKeyStatus.active,
    },
    select: {
      id: true,
      accountId: true,
      websiteId: true,
      primaryKeyHash: true,
      secondaryKeyHash: true,
      expiresAt: true,
      scopes: true,
      status: true,
    },
  });

  if (!record) {
    logAuthDecision({ outcome: 'denied', reason: 'unknown-key' });
    throw new GraphqlAuthError(401, 'UNAUTHENTICATED', 'Invalid API key');
  }

  const digestBuffer = Buffer.from(digest, 'hex');
  const matchesPrimary =
    record.primaryKeyHash &&
    timingSafeEqual(digestBuffer, Buffer.from(record.primaryKeyHash, 'hex'));
  const matchesSecondary =
    Boolean(record.secondaryKeyHash) &&
    timingSafeEqual(digestBuffer, Buffer.from(record.secondaryKeyHash!, 'hex'));

  if (!matchesPrimary && !matchesSecondary) {
    logAuthDecision({ outcome: 'denied', reason: 'hash-mismatch', keyId: record.id, accountId: record.accountId });
    throw new GraphqlAuthError(401, 'UNAUTHENTICATED', 'Invalid API key');
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    logAuthDecision({ outcome: 'denied', reason: 'expired', keyId: record.id, accountId: record.accountId });
    throw new GraphqlAuthError(401, 'KEY_EXPIRED', 'API key expired');
  }

  const variables = options?.variables ?? null;
  if (record.websiteId) {
    const variableWebsiteIds = collectWebsiteIds(variables);
    if (
      variableWebsiteIds.size > 0 &&
      (variableWebsiteIds.size > 1 || !variableWebsiteIds.has(record.websiteId))
    ) {
      logAuthDecision({
        outcome: 'denied',
        reason: 'website-mismatch',
        keyId: record.id,
        accountId: record.accountId,
        websiteId: record.websiteId,
      });
      throw new GraphqlAuthError(403, 'UNAUTHORIZED', 'Website scope mismatch');
    }
  }

  const ipAddress = getRequestIp(request);
  const ipStatus = ipLimiter.take(ipAddress);
  if (!ipStatus.allowed) {
    const headers = buildRateLimitHeaders('ip', ipStatus);
    logAuthDecision({
      outcome: 'denied',
      reason: 'ip-rate-limit',
      keyId: record.id,
      accountId: record.accountId,
      websiteId: record.websiteId,
      ip: ipAddress,
    });
    throw new GraphqlAuthError(429, 'RATE_LIMITED', 'Too many requests', headers);
  }

  const keyStatus = keyLimiter.take(record.id);
  if (!keyStatus.allowed) {
    const headers = buildRateLimitHeaders('key', keyStatus);
    logAuthDecision({
      outcome: 'denied',
      reason: 'key-rate-limit',
      keyId: record.id,
      accountId: record.accountId,
      websiteId: record.websiteId,
      ip: ipAddress,
    });
    throw new GraphqlAuthError(429, 'RATE_LIMITED', 'Too many requests', headers);
  }

  // Fire-and-forget lastUsedAt update
  void prisma.accountApiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(error => {
      console.error('[ucs.graphql.auth] failed to update lastUsedAt', {
        keyId: record.id,
        error,
      });
    });

  const rateLimits = { key: keyStatus, ip: ipStatus };

  logAuthDecision({
    outcome: 'allowed',
    reason: 'ok',
    keyId: record.id,
    accountId: record.accountId,
    websiteId: record.websiteId,
    ip: ipAddress,
    remaining: {
      key: keyStatus.remaining,
      ip: ipStatus.remaining,
    },
  });

  return {
    accountId: record.accountId,
    keyId: record.id,
    websiteId: record.websiteId,
    scopes: record.scopes,
    rateLimits,
  };
}

function buildRateLimitHeaders(resource: 'ip' | 'key', status: RateLimitStatus): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': status.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, status.remaining).toString(),
    'X-RateLimit-Resource': resource,
  };
  if (status.retryAfterMs) {
    headers['Retry-After'] = Math.ceil(status.retryAfterMs / 1000).toString();
  }
  return headers;
}

function collectWebsiteIds(input: unknown): Set<string> {
  const ids = new Set<string>();
  if (!input || typeof input !== 'object') {
    return ids;
  }
  const stack: unknown[] = [input];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      current.forEach(item => stack.push(item));
      continue;
    }
    if (typeof current === 'object' && current !== null) {
      Object.entries(current as Record<string, unknown>).forEach(([key, value]) => {
        if (key === 'websiteId' && typeof value === 'string') {
          ids.add(value);
        } else if (typeof value === 'object' && value !== null) {
          stack.push(value);
        }
      });
    }
  }
  return ids;
}

function getRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    if (first?.trim()) {
      return first.trim();
    }
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

interface AuthLogPayload {
  outcome: 'allowed' | 'denied';
  reason: string;
  keyId?: string;
  accountId?: string;
  websiteId?: string | null;
  ip?: string;
  remaining?: {
    key: number;
    ip: number;
  };
}

function logAuthDecision(payload: AuthLogPayload) {
  console.info('[ucs.graphql.auth]', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export const __internal = {
  collectWebsiteIds,
  keyLimiter,
  ipLimiter,
};
