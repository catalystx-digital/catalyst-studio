import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AccountRole, autoAcceptPendingInvitations } from '@/lib/auth/account';
import { hashPassword, normalizeEmail } from '@/lib/auth/password';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { createSessionRecord } from '@/lib/auth/create-session';
import { authError } from '@/lib/auth/responses';
import { toAppUser } from '@/lib/auth/types';

export const runtime = 'nodejs';

const signUpSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const parsed = signUpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return authError('Enter a valid email and password');
  }

  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name?.trim() || null;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return authError('An account already exists for this email', 409);
  }

  const userId = randomUUID();
  const password = await hashPassword(parsed.data.password);
  const userAgent = request.headers.get('user-agent');
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          id: userId,
          email,
          name,
          passwordHash: password.passwordHash,
          passwordSalt: password.passwordSalt,
          passwordParams: password.passwordParams,
        },
      });

      await tx.account.create({
        data: {
          id: user.id,
          name: name || email,
        },
      });

      await tx.accountMembership.create({
        data: {
          accountId: user.id,
          userId: user.id,
          role: AccountRole.admin,
          websiteAccess: 'all',
          websiteIds: [],
        },
      });

      await autoAcceptPendingInvitations(tx, user.id, email);
      const session = await createSessionRecord(tx, {
        userId: user.id,
        activeAccountId: user.id,
        userAgent,
        ipAddress,
      });

      return { user, session };
    });

    const response = NextResponse.json({
      user: toAppUser(result.user),
      session: {
        id: result.session.session.id,
        activeAccountId: result.session.session.activeAccountId,
        expiresAt: result.session.session.expiresAt.toISOString(),
      },
    });
    response.cookies.set(AUTH_SESSION_COOKIE, result.session.cookieValue, result.session.cookieOptions);
    return response;
  } catch (error) {
    console.error('[auth:sign-up] Failed to create account', error);
    return authError('Unable to create account', 500);
  }
}
