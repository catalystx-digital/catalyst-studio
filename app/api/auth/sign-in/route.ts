import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyPassword, type PasswordParams } from '@/lib/auth/password';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { createSessionRecord } from '@/lib/auth/create-session';
import { authError, INVALID_CREDENTIALS_MESSAGE } from '@/lib/auth/responses';
import { getAccountIdForUser } from '@/lib/auth/account';
import { toAppUser } from '@/lib/auth/types';

export const runtime = 'nodejs';

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = signInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return authError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return authError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const validPassword = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
    user.passwordSalt,
    user.passwordParams as PasswordParams,
  );
  if (!validPassword) {
    return authError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const activeAccountId = (await getAccountIdForUser(prisma as any, user.id)) ?? user.id;
  const session = await createSessionRecord(prisma as any, {
    userId: user.id,
    activeAccountId,
    userAgent: request.headers.get('user-agent'),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  const response = NextResponse.json({
    user: toAppUser(user),
    session: {
      id: session.session.id,
      activeAccountId: session.session.activeAccountId,
      expiresAt: session.session.expiresAt.toISOString(),
    },
  });
  response.cookies.set(AUTH_SESSION_COOKIE, session.cookieValue, session.cookieOptions);
  return response;
}
