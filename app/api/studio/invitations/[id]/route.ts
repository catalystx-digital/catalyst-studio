/**
 * Single Invitation API
 *
 * GET /api/studio/invitations/[id] - Get invitation details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContext, requireAdmin } from '@/lib/auth/authorization';
import { InvitationService } from '@/lib/studio/services/invitation-service';

function getService() {
  return new InvitationService(prisma);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthorizedContext(request);
    requireAdmin(context);

    const { id } = await params;
    const service = getService();
    const invitation = await service.getById(context.accountId, id);

    if (!invitation) {
      throw ErrorHandlers.notFound('Invitation');
    }

    return NextResponse.json({
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        websiteAccess: invitation.websiteAccess,
        websiteIds: invitation.websiteIds,
        websiteNames: invitation.websiteNames,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        emailStatus: invitation.emailStatus,
        emailSentAt: invitation.emailSentAt?.toISOString() ?? null,
        expiresAt: invitation.expiresAt.toISOString(),
        respondedAt: invitation.respondedAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
