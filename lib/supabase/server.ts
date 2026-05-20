import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function createCookieAdapter(store: CookieStore) {
  return {
    getAll() {
      return store.getAll().map(({ name, value }) => ({ name, value }));
    },
    setAll(cookiesToSet: SupabaseCookie[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        try {
          const mutable = store as unknown as {
            set: (name: string, value: string, options?: CookieOptions) => void;
          };

          if (typeof mutable.set === 'function') {
            mutable.set(name, value, options ?? {});
          }
        } catch {
          // Readonly cookies (e.g., during static render) cannot be mutated; ignore.
        }
      });
    },
  };
}

function createSupabaseServerClient(store: CookieStore): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient(url, anonKey, {
    cookies: createCookieAdapter(store),
  });
}

export async function getServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createSupabaseServerClient(cookieStore);
}

export async function getRouteSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createSupabaseServerClient(cookieStore);
}

