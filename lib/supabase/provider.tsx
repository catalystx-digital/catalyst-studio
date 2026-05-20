'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createBrowserClient } from './client';
import { SupabaseListener } from './listener';

type SupabaseContextValue = {
  client: SupabaseClient;
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  serverAccessToken?: string;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export function SupabaseProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: Session | null;
}) {
  const [client] = useState(() => createBrowserClient());
  const [session, setSession] = useState<Session | null>(initialSession ?? null);

  const contextValue = useMemo(
    () => ({
      client,
      session,
      user: session?.user ?? null,
      setSession,
      serverAccessToken: initialSession?.access_token,
    }),
    [client, session, setSession, initialSession?.access_token],
  );

  return (
    <SupabaseContext.Provider value={contextValue}>
      <SupabaseListener />
      {children}
    </SupabaseContext.Provider>
  );
}

function useSupabaseContext(): SupabaseContextValue {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('Supabase hooks must be used within SupabaseProvider');
  }
  return context;
}

export function useSupabaseClient(): SupabaseClient {
  return useSupabaseContext().client;
}

export function useSupabaseSession(): Session | null {
  return useSupabaseContext().session;
}

export function useSupabaseUser(): User | null {
  return useSupabaseContext().user;
}

export function useSupabaseSessionSetter(): (session: Session | null) => void {
  return useSupabaseContext().setSession;
}

export function useSupabaseServerAccessToken(): string | undefined {
  return useSupabaseContext().serverAccessToken;
}
