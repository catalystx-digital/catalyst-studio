import { NextRequest } from 'next/server';
import { ErrorHandlers } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import {
  AUTH_BYPASS_USER_HEADER,
  AUTH_SESSION_COOKIE,
  hashSessionToken,
  verifySessionCookie,
} from '@/lib/auth/session-cookie';
import { readCookieValue } from '@/lib/auth/session-store';
import { getCachedAuthContext, storeAuthContext } from '@/lib/auth/auth-context-cache';

const HEADER_BYPASS_ENABLED =
  process.env.ALLOW_AUTH_HEADER_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

export type AuthContext = {
  accountId: string;
  userId?: string;
};

function readBypassUser(req?: Request | NextRequest): AuthContext | null {
  if (!HEADER_BYPASS_ENABLED || !req) {
    return null;
  }

  const value = req.headers?.get?.(AUTH_BYPASS_USER_HEADER);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { id?: string; accountId?: string };
    if (parsed.id && parsed.accountId) {
      return { userId: parsed.id, accountId: parsed.accountId };
    }
  } catch {
    return null;
  }

  return null;
}

export async function getAuthContext(
  req?: Request | NextRequest,
  options?: { requireFresh?: boolean },
): Promise<AuthContext> {
  const bypass = readBypassUser(req);
  if (bypass) {
    return bypass;
  }

  const cookieValue = readCookieValue(req, AUTH_SESSION_COOKIE);
  const token = verifySessionCookie(cookieValue);
  if (!token) {
    throw ErrorHandlers.unauthorized('Sign in required');
  }

  const sessionTokenHash = hashSessionToken(token);
  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw ErrorHandlers.unauthorized('Sign in required');
  }

  if (!options?.requireFresh) {
    const cached = getCachedAuthContext(session.userId);
    if (cached && cached.accountId === session.activeAccountId) {
      return cached;
    }
  }

  const membership = await prisma.accountMembership.findUnique({
    where: {
      accountId_userId: {
        accountId: session.activeAccountId,
        userId: session.userId,
      },
    },
    select: { accountId: true },
  });

  if (!membership) {
    throw ErrorHandlers.unauthorized('Sign in required');
  }

  const context = { accountId: membership.accountId, userId: session.userId };
  storeAuthContext(session.userId, membership.accountId);
  return context;
}

export function requireFreshAuthContext(req?: Request | NextRequest): Promise<AuthContext> {
  return getAuthContext(req, { requireFresh: true });
}
