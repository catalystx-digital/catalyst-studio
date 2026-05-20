/**
 * System Admin Users API
 *
 * GET /api/system-admin/users - List all users (for impersonation lookup)
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

const searchSchema = z.object({
  q: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
});

// =============================================================================
// Service
// =============================================================================

function getService() {
  return new ImpersonationService(prisma);
}

// =============================================================================
// GET - Search Users
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

    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = searchSchema.safeParse(searchParams);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid query parameters', parsed.error.flatten());
    }

    const { q, limit, offset } = parsed.data;

    // Build where clause for search
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          memberships: {
            select: {
              accountId: true,
              role: true,
              account: { select: { name: true } },
            },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        users: users.map((user: any) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
          accounts: user.memberships.map((m: any) => ({
            accountId: m.accountId,
            accountName: m.account.name,
            role: m.role,
          })),
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
