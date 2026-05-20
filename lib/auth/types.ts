export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
    email?: string;
    preferred_username?: string;
  };
};

export type AppSession = {
  id: string;
  expiresAt: string;
  activeAccountId: string;
};

export type AuthSessionResponse = {
  user: AppUser | null;
  session: AppSession | null;
};

export function toAppUser(user: { id: string; email: string; name: string | null }): AppUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    user_metadata: {
      full_name: user.name ?? undefined,
      name: user.name ?? undefined,
      email: user.email,
    },
  };
}
