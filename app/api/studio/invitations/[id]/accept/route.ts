/**
 * Accept Invitation API
 *
 * POST /api/studio/invitations/[id]/accept - Accept an invitation
 *
 * This endpoint requires the user to be authenticated.
 * The authenticated user's email must match the invitation email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { InvitationService } from '@/lib/studio/services/invitation-service';

function getService() {
  return new InvitationService(prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await getAuthContext(request);

    if (!authContext.userId) {
      throw ErrorHandlers.unauthorized('Sign in required to accept invitation');
    }

    // Get user's email
    const user = await prisma.user.findUnique({
      where: { id: authContext.userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw ErrorHandlers.badRequest('User email not found. Please complete your profile.');
    }

    const { id } = await params;
    const service = getService();
    const result = await service.accept(id, authContext.userId, user.email);

    return NextResponse.json({
      data: {
        success: true,
        membership: {
          id: result.membership.id,
          accountId: result.membership.accountId,
          role: result.membership.role,
          websiteAccess: result.membership.websiteAccess,
        },
        account: result.account,
        message: `You have joined ${result.account.name}`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
