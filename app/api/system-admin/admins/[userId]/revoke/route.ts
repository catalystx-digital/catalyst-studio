/**
 * Revoke System Admin API
 *
 * POST /api/system-admin/admins/[userId]/revoke - Revoke system admin from a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { ImpersonationService } from '@/lib/studio/services/impersonation-service';

function getService() {
  return new ImpersonationService(prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authContext = await getAuthContext(request);

    if (!authContext.userId) {
      throw ErrorHandlers.unauthorized();
    }

    const service = getService();

    // Verify system admin status
    const isAdmin = await service.isSystemAdmin(authContext.userId);
    if (!isAdmin) {
      throw ErrorHandlers.forbidden('System admin access required');
    }

    const { userId } = await params;

    // Prevent self-revocation
    if (userId === authContext.userId) {
      throw ErrorHandlers.badRequest('Cannot revoke your own system admin status');
    }

    await service.revokeSystemAdmin(userId);

    return NextResponse.json({
      data: {
        success: true,
        message: 'System admin revoked',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
