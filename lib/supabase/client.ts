'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export function createBrowserClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createSupabaseBrowserClient(url, anonKey);
}
