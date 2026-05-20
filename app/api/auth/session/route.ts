import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { getSessionByCookieValue, toSessionResponse } from '@/lib/auth/session-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSessionByCookieValue(request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null);
  return NextResponse.json(toSessionResponse(session));
}
