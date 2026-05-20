import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, getExpiredSessionCookieOptions } from '@/lib/auth/session-cookie';
import { revokeSessionByCookieValue } from '@/lib/auth/session-store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  await revokeSessionByCookieValue(request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_SESSION_COOKIE, '', getExpiredSessionCookieOptions());
  return response;
}
