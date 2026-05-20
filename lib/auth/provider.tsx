'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSession, AppUser, AuthSessionResponse } from './types';

type AuthContextValue = {
  user: AppUser | null;
  session: AppSession | null;
  loading: boolean;
  refreshSession: () => Promise<AuthSessionResponse>;
  signIn: (input: { email: string; password: string }) => Promise<AuthSessionResponse>;
  signUp: (input: { name?: string; email: string; password: string }) => Promise<AuthSessionResponse>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readAuthResponse(response: Response): Promise<AuthSessionResponse> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Authentication failed');
  }
  return payload as AuthSessionResponse;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload: AuthSessionResponse) => {
    setUser(payload.user);
    setSession(payload.session);
    return payload;
  }, []);

  const refreshSession = useCallback(async () => {
    const payload = await readAuthResponse(await fetch('/api/auth/session', { cache: 'no-store' }));
    return applySession(payload);
  }, [applySession]);

  useEffect(() => {
    void refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const payload = await readAuthResponse(await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }));
      return applySession(payload);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (input: { name?: string; email: string; password: string }) => {
      const payload = await readAuthResponse(await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }));
      return applySession(payload);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading, refreshSession, signIn, signUp, signOut }),
    [loading, refreshSession, session, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('Auth hooks must be used within AuthProvider');
  }
  return context;
}
