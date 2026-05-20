import {
  AUTH_BYPASS_USER_HEADER,
  AUTH_SESSION_COOKIE,
  AUTHENTICATED_HEADER,
} from './constants';

const encoder = new TextEncoder();

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacSha256(token: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(token));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

export async function verifySessionCookieEdge(value: string | null | undefined): Promise<boolean> {
  if (!value) {
    return false;
  }

  const [token, signature, ...extra] = value.split('.');
  if (!token || !signature || extra.length > 0) {
    return false;
  }

  const secret = process.env.AUTH_SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    return false;
  }

  const expected = new Uint8Array(await hmacSha256(token, secret));
  const actual = base64UrlToBytes(signature);
  return constantTimeEqual(actual, expected);
}

export { AUTH_BYPASS_USER_HEADER, AUTH_SESSION_COOKIE, AUTHENTICATED_HEADER };
