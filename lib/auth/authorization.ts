/**
 * Authorization Module
 *
 * Provides authorization context and permission checking for RBAC.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AccountRole, type AccountRoleType } from './account';
import { ApiError } from '@/lib/api/errors';
import {
  Permission,
  ROLE_PERMISSIONS,
  WebsiteAccessType,
  isWebsitePermission,
} from './permissions';
import { getAuthContext, AuthContext } from './context';

// =============================================================================
// Types
// =============================================================================

export interface AuthorizedContext extends AuthContext {
  role: AccountRoleType;
  websiteAccess: WebsiteAccessType;
  websiteIds: string[];
  isSystemAdmin: boolean;
  isImpersonating: boolean;
  impersonatorId?: string;
  membershipId: string;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get full authorization context for a user in an account
 *
 * This extends the basic auth context with role, permissions, and website access info.
 */
export async function getAuthorizedContext(
  req?: Request | NextRequest,
  options?: { requireFresh?: boolean }
): Promise<AuthorizedContext> {
  // First get the basic auth context
  const authContext = await getAuthContext(req, options);

  const { accountId, userId } = authContext;

  if (!userId) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  // Check for active impersonation session
  const impersonation = await prisma.impersonationSession.findFirst({
    where: {
      targetUserId: userId,
      targetAccountId: accountId,
      endedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  });

  // Get membership for this account
  const membership = await prisma.accountMembership.findUnique({
    where: { accountId_userId: { accountId, userId } },
  });

  if (!membership) {
    throw new ApiError(403, 'Not a member of this account', 'FORBIDDEN');
  }

  // Check if user is system admin
  const systemAdmin = await prisma.systemAdmin.findUnique({
    where: { userId },
    select: { isActive: true },
  });

  return {
    accountId,
    userId,
    role: membership.role as AccountRoleType,
    websiteAccess: membership.websiteAccess as WebsiteAccessType,
    websiteIds: membership.websiteIds,
    isSystemAdmin: systemAdmin?.isActive ?? false,
    isImpersonating: !!impersonation,
    impersonatorId: impersonation?.systemAdminId ?? undefined,
    membershipId: membership.id,
  };
}

/**
 * Get authorization context for a user in a SPECIFIC account
 *
 * Use this when the target account is specified in the URL (e.g., /api/accounts/[accountId]/...)
 * and the user may be managing an account they were invited to (not their own default account).
 */
export async function getAuthorizedContextForAccount(
  req: Request | NextRequest,
  targetAccountId: string,
  options?: { requireFresh?: boolean }
): Promise<AuthorizedContext> {
  // First get the basic auth context (to get the userId)
  const authContext = await getAuthContext(req, options);

  const { userId } = authContext;

  if (!userId) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
  }

  // Check for active impersonation session in the target account
  const impersonation = await prisma.impersonationSession.findFirst({
    where: {
      targetUserId: userId,
      targetAccountId: targetAccountId,
      endedAt: null,
    },
    orderBy: { startedAt: 'desc' },
  });

  // Get membership for the TARGET account (not the user's default account)
  const membership = await prisma.accountMembership.findUnique({
    where: { accountId_userId: { accountId: targetAccountId, userId } },
  });

  if (!membership) {
    throw new ApiError(403, 'Not a member of this account', 'FORBIDDEN');
  }

  // Check if user is system admin
  const systemAdmin = await prisma.systemAdmin.findUnique({
    where: { userId },
    select: { isActive: true },
  });

  return {
    accountId: targetAccountId,
    userId,
    role: membership.role as AccountRoleType,
    websiteAccess: membership.websiteAccess as WebsiteAccessType,
    websiteIds: membership.websiteIds,
    isSystemAdmin: systemAdmin?.isActive ?? false,
    isImpersonating: !!impersonation,
    impersonatorId: impersonation?.systemAdminId ?? undefined,
    membershipId: membership.id,
  };
}

/**
 * Assert that the user has a specific permission
 *
 * @throws ApiError with 403 status if permission denied
 */
export async function assertPermission(
  context: AuthorizedContext,
  permission: Permission,
  websiteId?: string
): Promise<void> {
  const rolePermissions = ROLE_PERMISSIONS[context.role];

  // Check if role has this permission
  if (!rolePermissions?.includes(permission)) {
    throw new ApiError(403, `Permission denied: ${permission}`, 'FORBIDDEN');
  }

  // For website-scoped permissions, check website access
  if (isWebsitePermission(permission) && websiteId) {
    if (!canAccessWebsite(context, websiteId)) {
      throw new ApiError(403, 'No access to this website', 'FORBIDDEN');
    }
  }
}

/**
 * Check if user can access a website (for filtering lists)
 */
export function canAccessWebsite(
  context: AuthorizedContext,
  websiteId: string
): boolean {
  // Admins access all websites
  if (context.role === AccountRole.admin) {
    return true;
  }

  // Members with "all" access can access all websites
  if (context.websiteAccess === 'all') {
    return true;
  }

  // Members with "specific" access can only access assigned websites
  return context.websiteIds.includes(websiteId);
}

/**
 * Get website filter for Prisma queries
 *
 * Returns a filter object to use in Prisma where clauses to limit
 * results to websites the user can access.
 */
export function getAccessibleWebsiteFilter(
  context: AuthorizedContext
): { id?: { in: string[] } } | Record<string, never> {
  // Admins and members with "all" access see all websites
  if (context.role === AccountRole.admin || context.websiteAccess === 'all') {
    return {}; // No filter needed
  }

  // Members with "specific" access only see their assigned websites
  return {
    id: { in: context.websiteIds },
  };
}

/**
 * Get list of accessible website IDs for a user
 *
 * For admins and users with "all" access, returns null (meaning all websites).
 * For users with "specific" access, returns the list of assigned website IDs.
 */
export function getAccessibleWebsiteIds(
  context: AuthorizedContext
): string[] | null {
  if (context.role === AccountRole.admin || context.websiteAccess === 'all') {
    return null; // All websites accessible
  }

  return context.websiteIds;
}

/**
 * Check if user has a specific permission (without throwing)
 */
export function hasPermission(
  context: AuthorizedContext,
  permission: Permission,
  websiteId?: string
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[context.role];

  // Check if role has this permission
  if (!rolePermissions?.includes(permission)) {
    return false;
  }

  // For website-scoped permissions, check website access
  if (isWebsitePermission(permission) && websiteId) {
    return canAccessWebsite(context, websiteId);
  }

  return true;
}

/**
 * Require admin role
 *
 * @throws ApiError with 403 status if not an admin
 */
export function requireAdmin(context: AuthorizedContext): void {
  if (context.role !== AccountRole.admin && context.role !== AccountRole.owner) {
    throw new ApiError(403, 'Admin access required', 'FORBIDDEN');
  }
}

/**
 * Check if user is an admin (includes owner role)
 */
export function isAdmin(context: AuthorizedContext): boolean {
  return context.role === AccountRole.admin || context.role === AccountRole.owner;
}
