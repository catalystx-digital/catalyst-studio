/**
 * Impersonation Service
 *
 * Allows system admins to impersonate users for support purposes.
 */

import { PrismaClient, AuditAction } from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';
import {
  AuditService,
  auditImpersonationStarted,
  auditImpersonationEnded,
} from './audit-service';

// =============================================================================
// Types
// =============================================================================

export interface ImpersonationSession {
  id: string;
  systemAdminId: string;
  targetUserId: string;
  targetAccountId: string;
  reason: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface StartImpersonationInput {
  targetUserId: string;
  targetAccountId: string;
  reason: string;
}

// =============================================================================
// Impersonation Service
// =============================================================================

export class ImpersonationService {
  private auditService: AuditService;

  constructor(private prisma: PrismaClient) {
    this.auditService = new AuditService(prisma);
  }

  /**
   * Check if a user is a system admin
   */
  async isSystemAdmin(userId: string): Promise<boolean> {
    const systemAdmin = await this.prisma.systemAdmin.findUnique({
      where: { userId },
      select: { isActive: true },
    });

    return systemAdmin?.isActive ?? false;
  }

  /**
   * Start an impersonation session
   */
  async startSession(
    systemAdminId: string,
    input: StartImpersonationInput
  ): Promise<ImpersonationSession> {
    // Verify system admin status
    const isAdmin = await this.isSystemAdmin(systemAdminId);
    if (!isAdmin) {
      throw new ApiError(403, 'Not authorized to impersonate users', 'FORBIDDEN');
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
    });

    if (!targetUser) {
      throw new ApiError(404, 'Target user not found', 'NOT_FOUND');
    }

    // Verify target user is a member of the account
    const membership = await this.prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: input.targetAccountId,
          userId: input.targetUserId,
        },
      },
    });

    if (!membership) {
      throw new ApiError(400, 'User is not a member of this account', 'NOT_MEMBER');
    }

    // Check for existing active session
    const existingSession = await this.prisma.impersonationSession.findFirst({
      where: {
        systemAdminId,
        endedAt: null,
      },
    });

    if (existingSession) {
      throw new ApiError(
        400,
        'You already have an active impersonation session. End it first.',
        'SESSION_EXISTS'
      );
    }

    // Validate reason
    if (!input.reason || input.reason.trim().length < 10) {
      throw new ApiError(
        400,
        'Please provide a detailed reason for impersonation (min 10 characters)',
        'INVALID_REASON'
      );
    }

    // Create session
    const session = await this.prisma.impersonationSession.create({
      data: {
        systemAdminId,
        targetUserId: input.targetUserId,
        targetAccountId: input.targetAccountId,
        reason: input.reason.trim(),
      },
    });

    // Log the action
    await this.auditService.log(
      auditImpersonationStarted(input.targetAccountId, systemAdminId, session.id, {
        targetUserId: input.targetUserId,
        reason: input.reason.trim(),
      })
    );

    return session;
  }

  /**
   * End an impersonation session
   */
  async endSession(systemAdminId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.impersonationSession.findFirst({
      where: {
        id: sessionId,
        systemAdminId,
        endedAt: null,
      },
    });

    if (!session) {
      throw new ApiError(404, 'Active session not found', 'NOT_FOUND');
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - session.startedAt.getTime();

    await this.prisma.impersonationSession.update({
      where: { id: sessionId },
      data: { endedAt },
    });

    // Log the action
    await this.auditService.log(
      auditImpersonationEnded(session.targetAccountId, systemAdminId, sessionId, {
        targetUserId: session.targetUserId,
        duration: Math.round(durationMs / 1000), // Duration in seconds
      })
    );
  }

  /**
   * Get active session for a system admin
   */
  async getActiveSession(systemAdminId: string): Promise<ImpersonationSession | null> {
    return this.prisma.impersonationSession.findFirst({
      where: {
        systemAdminId,
        endedAt: null,
      },
    });
  }

  /**
   * List all sessions for a system admin
   */
  async listSessions(
    systemAdminId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ sessions: ImpersonationSession[]; total: number }> {
    const { limit = 50, offset = 0 } = options ?? {};

    const [sessions, total] = await Promise.all([
      this.prisma.impersonationSession.findMany({
        where: { systemAdminId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.impersonationSession.count({ where: { systemAdminId } }),
    ]);

    return { sessions, total };
  }

  /**
   * Grant system admin status to a user
   */
  async grantSystemAdmin(userId: string, grantedBy?: string): Promise<void> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, 'User not found', 'NOT_FOUND');
    }

    // Check if already a system admin
    const existing = await this.prisma.systemAdmin.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ApiError(409, 'User is already a system admin', 'ALREADY_ADMIN');
      }

      // Reactivate
      await this.prisma.systemAdmin.update({
        where: { userId },
        data: { isActive: true, grantedBy, grantedAt: new Date() },
      });
    } else {
      await this.prisma.systemAdmin.create({
        data: { userId, grantedBy },
      });
    }
  }

  /**
   * Revoke system admin status from a user
   */
  async revokeSystemAdmin(userId: string): Promise<void> {
    const systemAdmin = await this.prisma.systemAdmin.findUnique({
      where: { userId },
    });

    if (!systemAdmin) {
      throw new ApiError(404, 'System admin not found', 'NOT_FOUND');
    }

    // End any active sessions
    await this.prisma.impersonationSession.updateMany({
      where: { systemAdminId: userId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Deactivate (don't delete for audit trail)
    await this.prisma.systemAdmin.update({
      where: { userId },
      data: { isActive: false },
    });
  }

  /**
   * List all system admins
   */
  async listSystemAdmins(): Promise<
    {
      userId: string;
      email: string | null;
      name: string | null;
      isActive: boolean;
      grantedAt: Date;
    }[]
  > {
    const admins = await this.prisma.systemAdmin.findMany({
      include: {
        user: { select: { email: true, name: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });

    return admins.map((admin) => ({
      userId: admin.userId,
      email: admin.user.email,
      name: admin.user.name,
      isActive: admin.isActive,
      grantedAt: admin.grantedAt,
    }));
  }
}
