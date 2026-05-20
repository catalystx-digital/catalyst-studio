/**
 * Decline Invitation API
 *
 * POST /api/studio/invitations/[id]/decline - Decline an invitation
 *
 * This endpoint requires the email to be provided in the body or
 * the user to be authenticated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { InvitationService } from '@/lib/studio/services/invitation-service';

const declineSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

function getService() {
  return new InvitationService(prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = declineSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsed.error.flatten());
    }

    // Get email from body or from header-based auth
    let email = parsed.data.email;

    if (!email) {
      // Try to get from authenticated user
      try {
        const { getAuthContext } = await import('@/lib/auth/context');
        const authContext = await getAuthContext(request);

        if (authContext.userId) {
          const user = await prisma.user.findUnique({
            where: { id: authContext.userId },
            select: { email: true },
          });
          email = user?.email ?? undefined;
        }
      } catch {
        // Not authenticated, that's ok
      }
    }

    if (!email) {
      throw ErrorHandlers.badRequest(
        'Email is required. Either sign in or provide email in request body.'
      );
    }

    const { id } = await params;
    const service = getService();
    await service.decline(id, email);

    return NextResponse.json({
      data: {
        success: true,
        message: 'Invitation declined',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
