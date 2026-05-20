/**
 * Resend Invitation API
 *
 * POST /api/studio/invitations/[id]/resend - Resend invitation email
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContext, requireAdmin } from '@/lib/auth/authorization';
import { InvitationService } from '@/lib/studio/services/invitation-service';
import { sendEmail } from '@/lib/email/send-email';
import { generateInvitationEmail, getRoleDisplayName } from '@/lib/email/templates/invitation';
import { EmailDeliveryStatus } from '@/lib/generated/prisma';

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
    const invitation = await service.resend(context.accountId, id, context.userId!);

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

    // Get the invitation token for the action link
    const fullInvitation = await prisma.accountInvitation.findUnique({
      where: { id },
      select: { token: true },
    });

    // Generate and send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const actionLink = `${baseUrl}/invite/accept?token=${fullInvitation?.token}`;
    const declineLink = `${baseUrl}/invite/decline?id=${invitation.id}`;

    const emailHtml = generateInvitationEmail({
      accountName: account?.name ?? 'Unknown Account',
      inviterName: inviter?.name ?? inviter?.email ?? 'A team member',
      inviterEmail: inviter?.email ?? '',
      roleName: getRoleDisplayName(invitation.role),
      websiteNames: invitation.websiteAccess === 'specific' ? invitation.websiteNames : undefined,
      actionLink,
      declineLink,
      expiresAt: invitation.expiresAt,
    });

    const emailResult = await sendEmail({
      to: invitation.email,
      subject: `Reminder: You're invited to join ${account?.name ?? 'a team'} on Catalyst Studio`,
      html: emailHtml,
    });

    // Update email status
    await service.updateEmailStatus(
      invitation.id,
      emailResult.success ? EmailDeliveryStatus.sent : EmailDeliveryStatus.failed,
      emailResult.error
    );

    return NextResponse.json({
      data: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        emailStatus: emailResult.success ? EmailDeliveryStatus.sent : EmailDeliveryStatus.failed,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
