/**
 * Invitation APIs
 *
 * POST /api/studio/invitations - Create a new invitation
 * GET /api/studio/invitations - List invitations for the account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContext, requireAdmin } from '@/lib/auth/authorization';
import { InvitationService } from '@/lib/studio/services/invitation-service';
import { sendEmail } from '@/lib/email/send-email';
import { generateInvitationEmail, getRoleDisplayName } from '@/lib/email/templates/invitation';
import { InvitationStatus, EmailDeliveryStatus } from '@/lib/generated/prisma';
import { type AccountRoleType } from '@/lib/auth/account';

// =============================================================================
// Schemas
// =============================================================================

const createSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']),
  websiteAccess: z.enum(['all', 'specific']),
  websiteIds: z.array(z.string()).optional(),
});

const listSchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val.split(',').filter((s) => Object.values(InvitationStatus).includes(s as InvitationStatus))
        : undefined
    ),
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
  return new InvitationService(prisma);
}

// =============================================================================
// POST - Create Invitation
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    requireAdmin(context);

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsed.error.flatten());
    }

    const { email, role, websiteAccess, websiteIds } = parsed.data;

    const service = getService();
    const { invitation, actionLink } = await service.create(context.accountId, context.userId!, {
      email,
      role: role as AccountRoleType,
      websiteAccess,
      websiteIds,
    });

    // Get account and inviter details for email
    const [account, inviter] = await Promise.all([
      prisma.account.findUnique({
        where: { id: context.accountId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: context.userId },
        select: { name: true, email: true },
      }),
    ]);

    // Generate and send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const declineLink = `${baseUrl}/invite/decline?id=${invitation.id}`;

    const emailHtml = generateInvitationEmail({
      accountName: account?.name ?? 'Unknown Account',
      inviterName: inviter?.name ?? inviter?.email ?? 'A team member',
      inviterEmail: inviter?.email ?? '',
      roleName: getRoleDisplayName(role),
      websiteNames: websiteAccess === 'specific' ? invitation.websiteNames : undefined,
      actionLink,
      declineLink,
      expiresAt: invitation.expiresAt,
    });

    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to join ${account?.name ?? 'a team'} on Catalyst Studio`,
      html: emailHtml,
    });

    // Update email status
    await service.updateEmailStatus(
      invitation.id,
      emailResult.success ? EmailDeliveryStatus.sent : EmailDeliveryStatus.failed,
      emailResult.error
    );

    return NextResponse.json(
      {
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          websiteAccess: invitation.websiteAccess,
          websiteIds: invitation.websiteIds,
          status: invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// =============================================================================
// GET - List Invitations
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthorizedContext(request);
    requireAdmin(context);

    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = listSchema.safeParse(searchParams);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid query parameters', parsed.error.flatten());
    }

    const { status, limit, offset } = parsed.data;

    const service = getService();
    const { invitations, total } = await service.list(context.accountId, {
      status: status as InvitationStatus[] | undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: {
        invitations: invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          websiteAccess: inv.websiteAccess,
          websiteIds: inv.websiteIds,
          websiteNames: inv.websiteNames,
          status: inv.status,
          invitedBy: inv.invitedBy,
          emailStatus: inv.emailStatus,
          emailSentAt: inv.emailSentAt?.toISOString() ?? null,
          expiresAt: inv.expiresAt.toISOString(),
          respondedAt: inv.respondedAt?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
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
