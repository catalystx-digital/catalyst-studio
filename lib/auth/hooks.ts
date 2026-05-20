'use client';

import { useAuthContext } from './provider';

export function useUser() {
  return useAuthContext().user;
}

export function useSession() {
  return useAuthContext().session;
}

export function useAuthLoading() {
  return useAuthContext().loading;
}

export function useAuthActions() {
  const { signIn, signUp, signOut, refreshSession } = useAuthContext();
  return { signIn, signUp, signOut, refreshSession };
}
