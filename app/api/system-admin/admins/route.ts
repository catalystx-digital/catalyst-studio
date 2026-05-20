/**
 * System Admins Management API
 *
 * GET /api/system-admin/admins - List all system admins
 * POST /api/system-admin/admins - Grant system admin to a user
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

const grantSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// =============================================================================
// Service
// =============================================================================

function getService() {
  return new ImpersonationService(prisma);
}

// =============================================================================
// GET - List System Admins
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

    const admins = await service.listSystemAdmins();

    return NextResponse.json({
      data: {
        admins: admins.map((admin) => ({
          userId: admin.userId,
          email: admin.email,
          name: admin.name,
          isActive: admin.isActive,
          grantedAt: admin.grantedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// =============================================================================
// POST - Grant System Admin
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
    const parsed = grantSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsed.error.flatten());
    }

    await service.grantSystemAdmin(parsed.data.userId, authContext.userId);

    return NextResponse.json({
      data: {
        success: true,
        message: 'System admin granted',
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
