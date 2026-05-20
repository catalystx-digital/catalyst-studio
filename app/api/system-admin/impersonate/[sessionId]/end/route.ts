/**
 * End Impersonation API
 *
 * POST /api/system-admin/impersonate/[sessionId]/end - End an impersonation session
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
  { params }: { params: Promise<{ sessionId: string }> }
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

    const { sessionId } = await params;
    await service.endSession(authContext.userId, sessionId);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Impersonation session ended',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
