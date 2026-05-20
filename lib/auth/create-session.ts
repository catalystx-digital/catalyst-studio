import { SESSION_MAX_AGE_SECONDS } from './constants';
import { createSessionToken, getSessionCookieOptions, hashSessionToken, serializeSessionCookie } from './session-cookie';

export function createSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export async function createSessionRecord(
  prisma: any,
  input: {
    userId: string;
    activeAccountId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  },
) {
  const token = createSessionToken();
  const expiresAt = createSessionExpiry();
  const session = await prisma.authSession.create({
    data: {
      userId: input.userId,
      activeAccountId: input.activeAccountId,
      sessionTokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });

  return {
    token,
    cookieValue: serializeSessionCookie(token),
    cookieOptions: getSessionCookieOptions(),
    session,
  };
}
