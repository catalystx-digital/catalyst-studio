import { NextRequest } from 'next/server';
import { ErrorHandlers } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { getRouteSupabaseClient } from '@/lib/supabase/server';
import {
  ensureAccountForUser,
  getAccountIdForUser,
} from '@/lib/auth/account';
import {
  SUPABASE_USER_COOKIE,
  SUPABASE_USER_HEADER,
  decodeSerializedUser,
  readUserFromCookieHeader,
  toSupabaseUser,
} from '@/lib/supabase/user-header';
import {
  getCachedAuthContext,
  storeAuthContext,
} from '@/lib/auth/auth-context-cache';

const HEADER_BYPASS_ENABLED = process.env.ALLOW_SUPABASE_HEADER_BYPASS === 'true';

export type AuthContext = {
  accountId: string;
  userId?: string;
};

function extractSerializedUser(req?: Request | NextRequest): ReturnType<typeof decodeSerializedUser> {
  if (!req) {
    return null;
  }

  const headerValue = req.headers?.get?.(SUPABASE_USER_HEADER) ?? null;
  const headerUser = decodeSerializedUser(headerValue);
  if (headerUser) {
    return headerUser;
  }

  if (req instanceof NextRequest) {
    const cookieValue = req.cookies.get(SUPABASE_USER_COOKIE)?.value ?? null;
    return decodeSerializedUser(cookieValue);
  }

  const cookieHeader = req.headers?.get?.('cookie') ?? null;
  return readUserFromCookieHeader(cookieHeader);
}

export async function getAuthContext(
  req?: Request | NextRequest,
  options?: { requireFresh?: boolean },
): Promise<AuthContext> {
  const forceFresh = options?.requireFresh ?? false;

  if (!forceFresh) {
    const serializedUser = extractSerializedUser(req);
    if (serializedUser) {
      const user = toSupabaseUser(serializedUser);

      // 1. Check cache first
      const cached = getCachedAuthContext(user.id);
      if (cached) {
        return cached;
      }

      // 2. Try read-only lookup (single query)
      const existingAccountId = await getAccountIdForUser(prisma, user.id);
      if (existingAccountId) {
        storeAuthContext(user.id, existingAccountId);
        return { accountId: existingAccountId, userId: user.id };
      }

      // 3. Fallback: ensure account exists (first-time user)
      const accountId = await ensureAccountForUser(prisma, user);
      storeAuthContext(user.id, accountId);
      return { accountId, userId: user.id };
    }
  }

  const supabase = await getRouteSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw ErrorHandlers.unauthorized('Sign in required');
  }

  if (!user) {
    throw ErrorHandlers.unauthorized('Sign in required');
  }

  // Check cache first (for fresh auth too, unless forceFresh)
  if (!forceFresh) {
    const cached = getCachedAuthContext(user.id);
    if (cached) {
      return cached;
    }
  }

  // Try read-only lookup first
  const existingAccountId = await getAccountIdForUser(prisma, user.id);
  if (existingAccountId) {
    storeAuthContext(user.id, existingAccountId);
    return { accountId: existingAccountId, userId: user.id };
  }

  // Fallback: ensure account (first-time user)
  const accountId = await ensureAccountForUser(prisma, user);
  storeAuthContext(user.id, accountId);
  return { accountId, userId: user.id };
}

export function requireFreshAuthContext(req?: Request | NextRequest): Promise<AuthContext> {
  if (HEADER_BYPASS_ENABLED) {
    return getAuthContext(req);
  }

  return getAuthContext(req, { requireFresh: true });
}
