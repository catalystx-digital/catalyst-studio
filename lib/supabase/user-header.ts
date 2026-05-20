import type { Factor, User, UserIdentity } from '@supabase/supabase-js';

export const SUPABASE_USER_HEADER = 'x-supabase-user';
export const SUPABASE_USER_COOKIE = 'sb-user-meta';

export type SerializedSupabaseUser = {
  id: string;
  aud?: string | null;
  email?: string | null;
  phone?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  confirmed_at?: string | null;
  is_anonymous?: boolean;
  identities?: UserIdentity[] | null;
  factors?: Factor[] | null;
  role?: string | null;
};

type MutableHeadersLike = Pick<Headers, 'get' | 'set' | 'delete'>;
type ReadonlyHeadersLike = Pick<Headers, 'get'>;

type CookieSetter = {
  set: (init: {
    name: string;
    value: string;
    maxAge?: number;
    path?: string;
    sameSite?: 'strict' | 'lax' | 'none';
    httpOnly?: boolean;
    secure?: boolean;
  }) => void;
  delete: (name: string) => void;
};

export function serializeSupabaseUser(user: User): SerializedSupabaseUser {
  return {
    id: user.id,
    aud: user.aud,
    email: user.email,
    phone: user.phone,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    phone_confirmed_at: user.phone_confirmed_at ?? null,
    confirmed_at: user.confirmed_at ?? null,
    is_anonymous: user.is_anonymous ?? false,
    identities: user.identities ?? null,
    factors: (user as any).factors ?? null,
    role: user.role ?? null,
  };
}

export function encodeSerializedUser(payload: SerializedSupabaseUser | null): string | null {
  if (!payload) {
    return null;
  }

  try {
    return encodeURIComponent(JSON.stringify(payload));
  } catch (error) {
    console.warn('[supabase-user-header] Failed to encode user payload', error);
    return null;
  }
}

export function decodeSerializedUser(value: string | null | undefined): SerializedSupabaseUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as SerializedSupabaseUser;
  } catch (error) {
    console.warn('[supabase-user-header] Failed to decode user payload', error);
    return null;
  }
}

export function toSupabaseUser(payload: SerializedSupabaseUser): User {
  return {
    id: payload.id,
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
    aud: payload.aud ?? 'authenticated',
    created_at: payload.created_at ?? new Date(0).toISOString(),
    updated_at: payload.updated_at ?? payload.created_at ?? new Date(0).toISOString(),
    last_sign_in_at: payload.last_sign_in_at ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    email_confirmed_at: payload.email_confirmed_at ?? null,
    phone_confirmed_at: payload.phone_confirmed_at ?? null,
    confirmed_at: payload.confirmed_at ?? null,
    is_anonymous: payload.is_anonymous ?? false,
    identities: payload.identities ?? null,
    factors: payload.factors ?? null,
    role: payload.role ?? null,
  } as User;
}

export function updateUserHeader(headers: MutableHeadersLike, user: User | null) {
  if (user) {
    const encoded = encodeSerializedUser(serializeSupabaseUser(user));
    if (encoded) {
      headers.set(SUPABASE_USER_HEADER, encoded);
      return;
    }
  }

  headers.delete(SUPABASE_USER_HEADER);
}

export function readUserFromHeaders(headers: ReadonlyHeadersLike): SerializedSupabaseUser | null {
  const value = headers.get(SUPABASE_USER_HEADER);
  return decodeSerializedUser(value ?? null);
}

export function setUserCookie(cookies: CookieSetter, user: User | null) {
  if (user) {
    const encoded = encodeSerializedUser(serializeSupabaseUser(user));
    if (!encoded) {
      return;
    }

    cookies.set({
      name: SUPABASE_USER_COOKIE,
      value: encoded,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60, // 1 hour, refreshed on each authenticated request
    });
    return;
  }

  cookies.delete(SUPABASE_USER_COOKIE);
}

export function readUserFromCookieHeader(headerValue: string | null | undefined): SerializedSupabaseUser | null {
  if (!headerValue) {
    return null;
  }

  const cookies = headerValue.split(';');
  for (const entry of cookies) {
    const [rawName, ...rest] = entry.trim().split('=');
    if (!rawName) {
      continue;
    }

    if (rawName === SUPABASE_USER_COOKIE) {
      const rawValue = rest.join('=');
      return decodeSerializedUser(rawValue ?? null);
    }
  }

  return null;
}
