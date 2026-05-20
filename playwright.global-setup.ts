import fs from 'fs';
import path from 'path';
import type { User } from '@supabase/supabase-js';
import { FullConfig, request } from '@playwright/test';
import { encodeSerializedUser, serializeSupabaseUser } from '@/lib/supabase/user-header';
import { loadPlaywrightEnv } from './scripts/load-playwright-env';

loadPlaywrightEnv();

const AUTH_STATE_PATH =
  process.env.PLAYWRIGHT_AUTH_STATE ?? path.resolve(process.cwd(), '.playwright/.auth/unified-chat.json');
const TEST_EMAIL = process.env.PLAYWRIGHT_SUPABASE_EMAIL ?? 'unified-chat-e2e@example.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_SUPABASE_PASSWORD ?? 'UnifiedChat!234';
const HEADER_BYPASS_PAYLOAD = process.env.PLAYWRIGHT_SUPABASE_HEADER_USER ?? null;

type SupabaseSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
};

export default async function globalSetup(_config: FullConfig) {
  if (HEADER_BYPASS_PAYLOAD) {
    await writeHeaderBypassStorageState(HEADER_BYPASS_PAYLOAD, AUTH_STATE_PATH);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Supabase environment variables are missing. Ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  await ensureTestUser(supabaseUrl, serviceRoleKey);
  const session = await createSession(supabaseUrl, anonKey);
  await writeStorageState(session, AUTH_STATE_PATH);
}

async function ensureTestUser(supabaseUrl: string, serviceRoleKey: string): Promise<void> {
  const adminRequest = await request.newContext({
    baseURL: supabaseUrl,
    extraHTTPHeaders: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });

  try {
    const lookup = await adminRequest.get('/auth/v1/admin/users', { params: { email: TEST_EMAIL } });

    if (!lookup.ok()) {
      throw new Error(`Failed to look up Supabase test user (${lookup.status()}): ${await lookup.text()}`);
    }

    const lookupPayload = await lookup.json();
    const existingUsers: User[] = Array.isArray(lookupPayload)
      ? lookupPayload
      : lookupPayload?.users ?? [];

    if (existingUsers.length > 0) {
      return;
    }

    const createResponse = await adminRequest.post('/auth/v1/admin/users', {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: { roles: ['e2e'], source: 'playwright' },
        user_metadata: { full_name: 'Unified Chat Tester', scope: 'playwright' },
      },
    });

    if (!createResponse.ok()) {
      throw new Error(`Failed to create Supabase test user (${createResponse.status()}): ${await createResponse.text()}`);
    }
  } finally {
    await adminRequest.dispose();
  }
}

async function createSession(supabaseUrl: string, anonKey: string): Promise<SupabaseSessionResponse> {
  const authRequest = await request.newContext({
    baseURL: supabaseUrl,
    extraHTTPHeaders: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await authRequest.post('/auth/v1/token?grant_type=password', {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create Supabase auth session (${response.status()}): ${await response.text()}`);
    }

    const payload = (await response.json()) as SupabaseSessionResponse;
    if (!payload?.access_token || !payload?.refresh_token) {
      throw new Error('Supabase auth session is missing required tokens');
    }

    return payload;
  } finally {
    await authRequest.dispose();
  }
}

async function writeStorageState(session: SupabaseSessionResponse, storageStatePath: string): Promise<void> {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + Math.max(session.expires_in - 30, 30);
  const cookieTemplate = {
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
  };

  const cookies = [
    {
      ...cookieTemplate,
      name: 'sb-access-token',
      value: session.access_token,
      expires: expiresAtSeconds,
    },
    {
      ...cookieTemplate,
      name: 'sb-refresh-token',
      value: session.refresh_token,
      expires: expiresAtSeconds + 60 * 60,
    },
  ];

  const serializedUser = serializeSupabaseUser(session.user);
  const encodedUser = encodeSerializedUser(serializedUser);

  if (encodedUser) {
    cookies.push({
      ...cookieTemplate,
      name: 'sb-user-meta',
      value: encodedUser,
      expires: expiresAtSeconds,
    });
  }

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  await fs.promises.writeFile(
    storageStatePath,
    JSON.stringify(
      {
        cookies,
        origins: [],
      },
      null,
      2
    ),
    'utf8'
  );
}

async function writeHeaderBypassStorageState(payload: string, storageStatePath: string): Promise<void> {
  const encodedUser = encodeURIComponent(payload);
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 60 * 60;
  const cookies = [
    {
      name: 'sb-user-meta',
      value: encodedUser,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
      expires: expiresAtSeconds,
    },
  ];

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  await fs.promises.writeFile(
    storageStatePath,
    JSON.stringify(
      {
        cookies,
        origins: [],
      },
      null,
      2
    ),
    'utf8'
  );
}
