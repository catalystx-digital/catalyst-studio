import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSessionToken, verifySessionCookie } from './session-cookie';
import { toAppUser, type AuthSessionResponse } from './types';

export function readCookieValue(req: Request | NextRequest | undefined, name: string): string | null {
  if (!req) {
    return null;
  }

  if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
    return (req as NextRequest).cookies.get(name)?.value ?? null;
  }

  const cookieHeader = req.headers?.get?.('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (cookie.slice(0, separator) === name) {
      return decodeURIComponent(cookie.slice(separator + 1));
    }
  }

  return null;
}

export async function getSessionByCookieValue(cookieValue: string | null | undefined) {
  const token = verifySessionCookie(cookieValue);
  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(token);
  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function revokeSessionByCookieValue(cookieValue: string | null | undefined): Promise<void> {
  const token = verifySessionCookie(cookieValue);
  if (!token) {
    return;
  }

  await prisma.authSession.updateMany({
    where: {
      sessionTokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export function toSessionResponse(
  session: Awaited<ReturnType<typeof getSessionByCookieValue>>,
): AuthSessionResponse {
  if (!session) {
    return { user: null, session: null };
  }

  return {
    user: toAppUser(session.user),
    session: {
      id: session.id,
      activeAccountId: session.activeAccountId,
      expiresAt: session.expiresAt.toISOString(),
    },
  };
}
