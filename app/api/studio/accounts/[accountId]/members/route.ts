/**
 * Account Members API
 *
 * GET /api/studio/accounts/[accountId]/members - List all members
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContextForAccount, requireAdmin } from '@/lib/auth/authorization';
import { MembershipService } from '@/lib/studio/services/membership-service';

// =============================================================================
// Schemas
// =============================================================================

const listSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
});

// =============================================================================
// Service
// =============================================================================

function getService() {
  return new MembershipService(prisma);
}

// =============================================================================
// GET - List Members
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Get authorization context for the target account
    const context = await getAuthorizedContextForAccount(request, accountId);

    // Only admins can list members
    requireAdmin(context);

    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = listSchema.safeParse(searchParams);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid query parameters', parsed.error.flatten());
    }

    const { limit, offset } = parsed.data;

    const service = getService();
    const { members, total } = await service.list(accountId, { limit, offset });

    return NextResponse.json({
      data: {
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          email: m.email,
          name: m.name,
          role: m.role,
          websiteAccess: m.websiteAccess,
          websiteIds: m.websiteIds,
          websiteNames: m.websiteNames,
          invitedBy: m.invitedBy,
          joinedAt: m.joinedAt.toISOString(),
          createdAt: m.createdAt.toISOString(),
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
