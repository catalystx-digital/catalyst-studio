/**
 * Current User Membership API
 *
 * GET /api/studio/accounts/[accountId]/members/me - Get current user's membership info
 *
 * This endpoint allows any authenticated user to get their own membership details
 * for a specific account, including their role and permissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContextForAccount } from '@/lib/auth/authorization';
import { ROLE_PERMISSIONS } from '@/lib/auth/permissions';
import { AccountRoleType } from '@/lib/auth/account';

// =============================================================================
// GET - Get Current User's Membership
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Get authorization context for the target account
    // This will verify the user has a membership in this account
    const context = await getAuthorizedContextForAccount(request, accountId);

    // Get full membership details
    const membership = await prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId,
          userId: context.userId,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      throw ErrorHandlers.notFound('Membership');
    }

    // Get website names for specific access
    let websiteNames: string[] = [];
    if (membership.websiteAccess === 'specific' && membership.websiteIds.length > 0) {
      const websites = await prisma.website.findMany({
        where: { id: { in: membership.websiteIds } },
        select: { name: true },
      });
      websiteNames = websites.map((w) => w.name);
    }

    // Get permissions for this role
    const permissions = ROLE_PERMISSIONS[membership.role as AccountRoleType] || [];

    return NextResponse.json({
      data: {
        id: membership.id,
        userId: membership.userId,
        accountId: membership.accountId,
        email: membership.user?.email || null,
        name: membership.user?.name || null,
        role: membership.role,
        websiteAccess: membership.websiteAccess,
        websiteIds: membership.websiteIds,
        websiteNames,
        permissions,
        joinedAt: membership.joinedAt?.toISOString() || null,
        createdAt: membership.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
