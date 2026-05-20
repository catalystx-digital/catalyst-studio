import type { User } from '@supabase/supabase-js';
import { PrismaClient, InvitationStatus } from '@/lib/generated/prisma';
import { invalidateAuthContext } from '@/lib/auth/auth-context-cache';

// Account roles - these match the string values in the database
export const AccountRole = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
} as const;

export type AccountRoleType = (typeof AccountRole)[keyof typeof AccountRole];

type EnsureAccountOptions = {
  name?: string;
};

export async function ensureAccount(
  prisma: PrismaClient,
  accountId: string,
  options: EnsureAccountOptions = {}
): Promise<void> {
  const displayName = options.name || `Account ${accountId}`;
  await (prisma as any).account?.upsert?.({
    where: { id: accountId },
    create: { id: accountId, name: displayName },
    update: { name: displayName },
  });
}

export async function ensureAccountForUser(prisma: PrismaClient, user: User): Promise<string> {
  const accountId = user.id;
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.preferred_username as string | undefined) ||
    user.email ||
    `Account ${accountId}`;

  await ensureAccount(prisma, accountId, { name: displayName });

  await (prisma as any).user?.upsert?.({
    where: { id: user.id },
    create: { id: user.id, email: user.email, name: displayName },
    update: { email: user.email, name: displayName },
  });

  // Account creators get admin role with access to all websites
  await (prisma as any).accountMembership?.upsert?.({
    where: { accountId_userId: { accountId, userId: user.id } },
    create: {
      accountId,
      userId: user.id,
      role: AccountRole.admin,
      websiteAccess: 'all',
      websiteIds: [],
    },
    update: {},
  });

  // Auto-accept any pending invitations for this user's email
  if (user.email) {
    await autoAcceptPendingInvitations(prisma, user.id, user.email);
  }

  return accountId;
}

/**
 * Auto-accept pending invitations for a newly signed-up user.
 * This creates memberships in the accounts they were invited to.
 */
async function autoAcceptPendingInvitations(
  prisma: PrismaClient,
  userId: string,
  userEmail: string
): Promise<void> {
  try {
    // Find all pending, non-expired invitations for this email
    const pendingInvitations = await (prisma as any).invitation?.findMany?.({
      where: {
        email: userEmail.toLowerCase(),
        status: InvitationStatus.pending,
        expiresAt: { gt: new Date() },
      },
    });

    if (!pendingInvitations?.length) {
      return;
    }

    for (const invitation of pendingInvitations) {
      try {
        // Check if membership already exists (shouldn't, but be safe)
        const existingMembership = await (prisma as any).accountMembership?.findUnique?.({
          where: {
            accountId_userId: {
              accountId: invitation.accountId,
              userId,
            },
          },
        });

        if (existingMembership) {
          // Already a member, just mark invitation as accepted
          await (prisma as any).invitation?.update?.({
            where: { id: invitation.id },
            data: {
              status: InvitationStatus.accepted,
              respondedAt: new Date(),
            },
          });
          continue;
        }

        // Filter out any deleted websites from websiteIds
        let validWebsiteIds: string[] = [];
        if (invitation.websiteIds?.length) {
          const validWebsites = await (prisma as any).website?.findMany?.({
            where: {
              id: { in: invitation.websiteIds },
              accountId: invitation.accountId,
            },
            select: { id: true },
          });
          validWebsiteIds = validWebsites?.map((w: { id: string }) => w.id) ?? [];
        }

        // Create the membership
        await (prisma as any).accountMembership?.create?.({
          data: {
            accountId: invitation.accountId,
            userId,
            role: invitation.role,
            websiteAccess: invitation.websiteAccess,
            websiteIds: validWebsiteIds,
            invitedBy: invitation.invitedBy,
            joinedAt: new Date(),
          },
        });

        // Mark invitation as accepted
        await (prisma as any).invitation?.update?.({
          where: { id: invitation.id },
          data: {
            status: InvitationStatus.accepted,
            respondedAt: new Date(),
          },
        });

        console.log(`[auto-accept] Accepted invitation ${invitation.id} for ${userEmail} to account ${invitation.accountId}`);
      } catch (inviteError) {
        // Log but don't fail the entire sign-up process
        console.error(`[auto-accept] Failed to accept invitation ${invitation.id}:`, inviteError);
      }
    }
  } catch (error) {
    // Log but don't fail the sign-up process
    console.error('[auto-accept] Failed to process pending invitations:', error);
  }
}

/**
 * Get the account ID for a user WITHOUT creating/updating records.
 * Use this for regular API requests. Use ensureAccountForUser() only on login/signup.
 *
 * @returns accountId if user has an account, null otherwise
 */
export async function getAccountIdForUser(
  prisma: PrismaClient,
  userId: string
): Promise<string | null> {
  const membership = await (prisma as any).accountMembership?.findFirst?.({
    where: { userId },
    select: { accountId: true },
  });

  return membership?.accountId ?? null;
}

/**
 * Get the account ID for a user, throwing if not found.
 * Use this for authenticated API requests where account must exist.
 */
export async function requireAccountIdForUser(
  prisma: PrismaClient,
  userId: string
): Promise<string> {
  const accountId = await getAccountIdForUser(prisma, userId);

  if (!accountId) {
    throw new Error(`No account found for user ${userId}`);
  }

  return accountId;
}

/**
 * Invalidate auth context cache for a user.
 * Call this when user's account/membership changes.
 */
export function invalidateUserAuthCache(userId: string): void {
  invalidateAuthContext(userId);
}
