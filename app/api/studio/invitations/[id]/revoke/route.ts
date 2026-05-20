/**
 * Revoke Invitation API
 *
 * POST /api/studio/invitations/[id]/revoke - Revoke a pending invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/errors';
import { getAuthorizedContext, requireAdmin } from '@/lib/auth/authorization';
import { InvitationService } from '@/lib/studio/services/invitation-service';

function getService() {
  return new InvitationService(prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthorizedContext(request);
    requireAdmin(context);

    const { id } = await params;
    const service = getService();
    await service.revoke(context.accountId, id, context.userId!);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Invitation revoked',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
