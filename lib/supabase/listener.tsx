'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSupabaseClient,
  useSupabaseServerAccessToken,
  useSupabaseSessionSetter,
} from './provider';

export function SupabaseListener() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const setSession = useSupabaseSessionSetter();
  const serverAccessToken = useSupabaseServerAccessToken();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);

      switch (event) {
        case 'SIGNED_IN':
        case 'SIGNED_OUT':
        case 'USER_UPDATED':
        case 'PASSWORD_RECOVERY':
          router.refresh();
          return;
        case 'TOKEN_REFRESHED':
          if (!serverAccessToken) {
            router.refresh();
          }
          return;
        default:
          if (session?.access_token !== serverAccessToken && session) {
            router.refresh();
          }
      }
    });

    return () => {
      data?.subscription.unsubscribe();
    };
  }, [router, serverAccessToken, setSession, supabase]);

  return null;
}
