import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SESSION_MAX_AGE_SECONDS } from './constants';
export { AUTH_BYPASS_USER_HEADER, AUTH_SESSION_COOKIE, AUTHENTICATED_HEADER } from './constants';

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET or AUTH_SESSION_SECRET is not configured');
  }
  return secret;
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function signSessionToken(token: string): string {
  return createHmac('sha256', getSecret()).update(token).digest('base64url');
}

export function serializeSessionCookie(token: string): string {
  return `${token}.${signSessionToken(token)}`;
}

export function verifySessionCookie(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const [token, signature, ...extra] = value.split('.');
  if (!token || !signature || extra.length > 0) {
    return null;
  }

  const expected = signSessionToken(token);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer) ? token : null;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function getExpiredSessionCookieOptions() {
  return {
    ...getSessionCookieOptions(),
    maxAge: 0,
  };
}
