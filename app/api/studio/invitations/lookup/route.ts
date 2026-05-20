/**
 * Lookup Invitation by Token API
 *
 * GET /api/studio/invitations/lookup?token=xxx - Get invitation details by token
 *
 * This is a public API used by the accept invitation page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { InvitationService } from '@/lib/studio/services/invitation-service';

function getService() {
  return new InvitationService(prisma);
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      throw ErrorHandlers.badRequest('Token is required');
    }

    const service = getService();
    const result = await service.getByToken(token);

    if (!result) {
      throw ErrorHandlers.notFound('Invitation');
    }

    const { invitation, account } = result;

    // Don't expose sensitive token data
    return NextResponse.json({
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        websiteAccess: invitation.websiteAccess,
        websiteNames: invitation.websiteNames,
        status: invitation.status,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt.toISOString(),
        account: {
          id: account.id,
          name: account.name,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
