/**
 * Start Impersonation API
 *
 * POST /api/system-admin/impersonate - Start impersonating a user
 * GET /api/system-admin/impersonate - Get current active session
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { ImpersonationService } from '@/lib/studio/services/impersonation-service';

// =============================================================================
// Schemas
// =============================================================================

const startSchema = z.object({
  targetUserId: z.string().uuid('Invalid user ID'),
  targetAccountId: z.string().uuid('Invalid account ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

// =============================================================================
// Service
// =============================================================================

function getService() {
  return new ImpersonationService(prisma);
}

// =============================================================================
// POST - Start Impersonation
// =============================================================================

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = startSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsed.error.flatten());
    }

    const session = await service.startSession(authContext.userId, parsed.data);

    return NextResponse.json({
      data: {
        id: session.id,
        targetUserId: session.targetUserId,
        targetAccountId: session.targetAccountId,
        reason: session.reason,
        startedAt: session.startedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// =============================================================================
// GET - Get Active Session
// =============================================================================

export async function GET(request: NextRequest) {
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

    const session = await service.getActiveSession(authContext.userId);

    if (!session) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        id: session.id,
        targetUserId: session.targetUserId,
        targetAccountId: session.targetAccountId,
        reason: session.reason,
        startedAt: session.startedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
