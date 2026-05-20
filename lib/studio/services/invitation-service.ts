/**
 * Invitation Service
 *
 * Handles creating, sending, and managing account invitations.
 */

import { randomBytes } from 'crypto';
import {
  PrismaClient,
  InvitationStatus,
  EmailDeliveryStatus,
  AuditAction,
  Prisma,
} from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';
import { AccountRoleType } from '@/lib/auth/account';
import { AuditService, auditInvitationCreated, auditInvitationAccepted } from './audit-service';

// =============================================================================
// Types
// =============================================================================

export interface CreateInvitationInput {
  email: string;
  role: AccountRoleType;
  websiteAccess: 'all' | 'specific';
  websiteIds?: string[];
}

export interface InvitationWithDetails {
  id: string;
  email: string;
  role: AccountRoleType;
  websiteAccess: string;
  websiteIds: string[];
  websiteNames: string[];
  status: InvitationStatus;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  emailStatus: EmailDeliveryStatus;
  emailSentAt: Date | null;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
}

export interface AcceptInvitationResult {
  membership: {
    id: string;
    accountId: string;
    role: AccountRoleType;
    websiteAccess: string;
    websiteIds: string[];
  };
  account: {
    id: string;
    name: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const INVITATION_EXPIRY_DAYS = parseInt(process.env.INVITATION_EXPIRY_DAYS ?? '30', 10);
const INVITATION_RESEND_LIMIT = parseInt(process.env.INVITATION_RESEND_LIMIT ?? '3', 10);
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

// =============================================================================
// Invitation Service
// =============================================================================

export class InvitationService {
  private auditService: AuditService;

  constructor(private prisma: PrismaClient) {
    this.auditService = new AuditService(prisma);
  }

  /**
   * Create a new invitation
   */
  async create(
    accountId: string,
    invitedBy: string,
    input: CreateInvitationInput
  ): Promise<{ invitation: InvitationWithDetails; actionLink: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Validate email format
    if (!this.isValidEmail(normalizedEmail)) {
      throw new ApiError(400, 'Invalid email address', 'INVALID_EMAIL');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.accountMembership.findFirst({
      where: {
        accountId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      throw new ApiError(409, 'This user is already a member of this account', 'ALREADY_MEMBER');
    }

    // Check for pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        accountId,
        email: normalizedEmail,
        status: InvitationStatus.pending,
      },
    });

    if (existingInvitation) {
      throw new ApiError(
        409,
        'An invitation has already been sent to this email. Resend or revoke it first.',
        'INVITATION_EXISTS'
      );
    }

    // Validate websiteIds if specific access
    if (input.websiteAccess === 'specific') {
      if (!input.websiteIds?.length) {
        throw new ApiError(400, 'Website IDs required for specific access', 'MISSING_WEBSITE_IDS');
      }

      const validWebsites = await this.prisma.website.findMany({
        where: {
          id: { in: input.websiteIds },
          accountId,
        },
        select: { id: true },
      });

      if (validWebsites.length !== input.websiteIds.length) {
        throw new ApiError(400, 'One or more website IDs are invalid', 'INVALID_WEBSITE_IDS');
      }
    }

    // Generate secure token
    const token = randomBytes(TOKEN_LENGTH).toString('hex');

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Create the invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        accountId,
        email: normalizedEmail,
        role: input.role,
        websiteAccess: input.websiteAccess,
        websiteIds: input.websiteIds ?? [],
        token,
        invitedBy,
        expiresAt,
        status: InvitationStatus.pending,
        emailStatus: EmailDeliveryStatus.pending,
      },
    });

    // Log the action
    await this.auditService.log(
      auditInvitationCreated(accountId, invitedBy, invitation.id, {
        email: normalizedEmail,
        role: input.role,
        websiteAccess: input.websiteAccess,
      })
    );

    // Get invitation with details for response
    const invitationWithDetails = await this.getById(accountId, invitation.id);

    // Generate action link (this will be the Supabase invite URL in production)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const actionLink = `${baseUrl}/invite/accept?token=${token}`;

    return {
      invitation: invitationWithDetails!,
      actionLink,
    };
  }

  /**
   * List invitations for an account
   */
  async list(
    accountId: string,
    options?: {
      status?: InvitationStatus[];
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invitations: InvitationWithDetails[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options ?? {};

    const where: Prisma.InvitationWhereInput = {
      accountId,
      ...(status?.length && { status: { in: status } }),
    };

    const [invitations, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          account: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.invitation.count({ where }),
    ]);

    // Get inviter details
    const inviterIds = [...new Set(invitations.map((inv) => inv.invitedBy))];
    const inviters = await this.prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, name: true, email: true },
    });
    const inviterMap = new Map(inviters.map((u) => [u.id, u]));

    // Get website names for invitations with specific access
    const websiteIds = invitations.flatMap((inv) => inv.websiteIds);
    const websites = websiteIds.length
      ? await this.prisma.website.findMany({
          where: { id: { in: websiteIds } },
          select: { id: true, name: true },
        })
      : [];
    const websiteMap = new Map(websites.map((w) => [w.id, w.name]));

    const invitationsWithDetails: InvitationWithDetails[] = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      websiteAccess: inv.websiteAccess,
      websiteIds: inv.websiteIds,
      websiteNames: inv.websiteIds.map((id) => websiteMap.get(id) ?? 'Unknown'),
      status: inv.status,
      invitedBy: inviterMap.get(inv.invitedBy) ?? { id: inv.invitedBy, name: null, email: null },
      emailStatus: inv.emailStatus,
      emailSentAt: inv.emailSentAt,
      expiresAt: inv.expiresAt,
      respondedAt: inv.respondedAt,
      createdAt: inv.createdAt,
    }));

    return { invitations: invitationsWithDetails, total };
  }

  /**
   * Get invitation by ID
   */
  async getById(accountId: string, invitationId: string): Promise<InvitationWithDetails | null> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, accountId },
    });

    if (!invitation) {
      return null;
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { id: true, name: true, email: true },
    });

    const websiteNames = invitation.websiteIds.length
      ? await this.prisma.website
          .findMany({
            where: { id: { in: invitation.websiteIds } },
            select: { name: true },
          })
          .then((websites) => websites.map((w) => w.name))
      : [];

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      websiteAccess: invitation.websiteAccess,
      websiteIds: invitation.websiteIds,
      websiteNames,
      status: invitation.status,
      invitedBy: inviter ?? { id: invitation.invitedBy, name: null, email: null },
      emailStatus: invitation.emailStatus,
      emailSentAt: invitation.emailSentAt,
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      createdAt: invitation.createdAt,
    };
  }

  /**
   * Get invitation by token (for accept page)
   */
  async getByToken(token: string): Promise<{
    invitation: InvitationWithDetails;
    account: { id: string; name: string };
  } | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        account: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return null;
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { id: true, name: true, email: true },
    });

    const websiteNames = invitation.websiteIds.length
      ? await this.prisma.website
          .findMany({
            where: { id: { in: invitation.websiteIds } },
            select: { name: true },
          })
          .then((websites) => websites.map((w) => w.name))
      : [];

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        websiteAccess: invitation.websiteAccess,
        websiteIds: invitation.websiteIds,
        websiteNames,
        status: invitation.status,
        invitedBy: inviter ?? { id: invitation.invitedBy, name: null, email: null },
        emailStatus: invitation.emailStatus,
        emailSentAt: invitation.emailSentAt,
        expiresAt: invitation.expiresAt,
        respondedAt: invitation.respondedAt,
        createdAt: invitation.createdAt,
      },
      account: invitation.account,
    };
  }

  /**
   * Resend an invitation
   */
  async resend(accountId: string, invitationId: string, actorId: string): Promise<InvitationWithDetails> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, accountId },
    });

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found', 'NOT_FOUND');
    }

    if (invitation.status !== InvitationStatus.pending) {
      throw new ApiError(400, 'Can only resend pending invitations', 'INVALID_STATUS');
    }

    // Check resend limit (count by looking at audit logs for resends)
    // For MVP, we'll just track this in metadata
    const metadata = (invitation as any).metadata ?? {};
    const resendCount = metadata.resendCount ?? 0;

    if (resendCount >= INVITATION_RESEND_LIMIT) {
      throw new ApiError(
        429,
        `Maximum resend limit (${INVITATION_RESEND_LIMIT}) reached`,
        'RESEND_LIMIT_EXCEEDED'
      );
    }

    // Extend expiry
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Update invitation
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        expiresAt: newExpiresAt,
        emailStatus: EmailDeliveryStatus.pending,
      },
    });

    // Log the action
    await this.auditService.log({
      accountId,
      actorId,
      action: AuditAction.invitation_resent,
      targetType: 'invitation',
      targetId: invitationId,
      metadata: { email: invitation.email, resendCount: resendCount + 1 },
    });

    return (await this.getById(accountId, invitationId))!;
  }

  /**
   * Revoke an invitation
   */
  async revoke(accountId: string, invitationId: string, actorId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, accountId },
    });

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found', 'NOT_FOUND');
    }

    if (invitation.status !== InvitationStatus.pending) {
      throw new ApiError(400, 'Can only revoke pending invitations', 'INVALID_STATUS');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.revoked,
        respondedAt: new Date(),
      },
    });

    // Log the action
    await this.auditService.log({
      accountId,
      actorId,
      action: AuditAction.invitation_revoked,
      targetType: 'invitation',
      targetId: invitationId,
      metadata: { email: invitation.email },
    });
  }

  /**
   * Accept an invitation
   */
  async accept(
    invitationId: string,
    userId: string,
    userEmail: string
  ): Promise<AcceptInvitationResult> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        account: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found', 'NOT_FOUND');
    }

    // Validate invitation state
    this.validateForAccept(invitation, userEmail);

    // Filter out any deleted websites from websiteIds
    const validWebsiteIds = invitation.websiteIds.length
      ? await this.prisma.website
          .findMany({
            where: { id: { in: invitation.websiteIds }, accountId: invitation.accountId },
            select: { id: true },
          })
          .then((websites) => websites.map((w) => w.id))
      : [];

    // Create membership
    const membership = await this.prisma.accountMembership.create({
      data: {
        accountId: invitation.accountId,
        userId,
        role: invitation.role,
        websiteAccess: invitation.websiteAccess,
        websiteIds: validWebsiteIds,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      },
    });

    // Update invitation status
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.accepted,
        respondedAt: new Date(),
      },
    });

    // Log the action
    await this.auditService.log(
      auditInvitationAccepted(invitation.accountId, userId, invitationId, {
        membershipId: membership.id,
        role: invitation.role,
      })
    );

    return {
      membership: {
        id: membership.id,
        accountId: membership.accountId,
        role: membership.role,
        websiteAccess: membership.websiteAccess,
        websiteIds: membership.websiteIds,
      },
      account: invitation.account,
    };
  }

  /**
   * Decline an invitation
   */
  async decline(invitationId: string, userEmail: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found', 'NOT_FOUND');
    }

    // Validate invitation state
    this.validateForAccept(invitation, userEmail);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.declined,
        respondedAt: new Date(),
      },
    });

    // Log the action
    await this.auditService.log({
      accountId: invitation.accountId,
      actorId: invitation.invitedBy, // Use inviter as actor since we don't have user's ID
      action: AuditAction.invitation_declined,
      targetType: 'invitation',
      targetId: invitationId,
      metadata: { email: invitation.email },
    });
  }

  /**
   * Mark expired invitations
   */
  async markExpired(): Promise<number> {
    const result = await this.prisma.invitation.updateMany({
      where: {
        status: InvitationStatus.pending,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: InvitationStatus.expired,
      },
    });

    return result.count;
  }

  /**
   * Update email status after sending
   */
  async updateEmailStatus(
    invitationId: string,
    status: EmailDeliveryStatus,
    error?: string
  ): Promise<void> {
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        emailStatus: status,
        emailSentAt: status === EmailDeliveryStatus.sent ? new Date() : undefined,
        emailError: error,
      },
    });
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private validateForAccept(
    invitation: { status: InvitationStatus; email: string; expiresAt: Date },
    userEmail: string
  ): void {
    // Check email matches
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ApiError(
        403,
        `Please sign in with ${invitation.email} to accept this invitation`,
        'EMAIL_MISMATCH'
      );
    }

    // Check status
    if (invitation.status !== InvitationStatus.pending) {
      const messages: Record<InvitationStatus, string> = {
        [InvitationStatus.pending]: '',
        [InvitationStatus.accepted]: 'This invitation has already been accepted',
        [InvitationStatus.declined]: 'This invitation has been declined',
        [InvitationStatus.expired]: 'This invitation has expired. Contact the admin for a new one.',
        [InvitationStatus.revoked]: 'This invitation is no longer valid',
      };
      throw new ApiError(400, messages[invitation.status], 'INVALID_STATUS');
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      throw new ApiError(
        400,
        'This invitation has expired. Contact the admin for a new one.',
        'EXPIRED'
      );
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
