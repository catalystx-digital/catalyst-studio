/**
 * Single Member API
 *
 * GET /api/studio/accounts/[accountId]/members/[memberId] - Get member details
 * PATCH /api/studio/accounts/[accountId]/members/[memberId] - Update member
 * DELETE /api/studio/accounts/[accountId]/members/[memberId] - Remove member
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContextForAccount, requireAdmin } from '@/lib/auth/authorization';
import { MembershipService } from '@/lib/studio/services/membership-service';
import { type AccountRoleType } from '@/lib/auth/account';

// =============================================================================
// Schemas
// =============================================================================

const updateSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  websiteAccess: z.enum(['all', 'specific']).optional(),
  websiteIds: z.array(z.string()).optional(),
});

// =============================================================================
// Service
// =============================================================================

function getService() {
  return new MembershipService(prisma);
}

// =============================================================================
// GET - Get Member Details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; memberId: string }> }
) {
  try {
    const { accountId, memberId } = await params;

    // Get authorization context for the target account
    const context = await getAuthorizedContextForAccount(request, accountId);

    requireAdmin(context);

    const service = getService();
    const member = await service.getById(accountId, memberId);

    if (!member) {
      throw ErrorHandlers.notFound('Member');
    }

    return NextResponse.json({
      data: {
        id: member.id,
        userId: member.userId,
        email: member.email,
        name: member.name,
        role: member.role,
        websiteAccess: member.websiteAccess,
        websiteIds: member.websiteIds,
        websiteNames: member.websiteNames,
        invitedBy: member.invitedBy,
        joinedAt: member.joinedAt.toISOString(),
        createdAt: member.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// =============================================================================
// PATCH - Update Member
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; memberId: string }> }
) {
  try {
    const { accountId, memberId } = await params;

    // Get authorization context for the target account
    const context = await getAuthorizedContextForAccount(request, accountId);

    requireAdmin(context);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsed.error.flatten());
    }

    const { role, websiteAccess, websiteIds } = parsed.data;

    const service = getService();
    const member = await service.update(accountId, memberId, context.userId!, {
      role: role as AccountRoleType | undefined,
      websiteAccess,
      websiteIds,
    });

    return NextResponse.json({
      data: {
        id: member.id,
        userId: member.userId,
        email: member.email,
        name: member.name,
        role: member.role,
        websiteAccess: member.websiteAccess,
        websiteIds: member.websiteIds,
        websiteNames: member.websiteNames,
        invitedBy: member.invitedBy,
        joinedAt: member.joinedAt.toISOString(),
        createdAt: member.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// =============================================================================
// DELETE - Remove Member
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; memberId: string }> }
) {
  try {
    const { accountId, memberId } = await params;

    // Get authorization context for the target account
    const context = await getAuthorizedContextForAccount(request, accountId);

    requireAdmin(context);

    const service = getService();
    await service.remove(accountId, memberId, context.userId!);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Member removed from account',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
