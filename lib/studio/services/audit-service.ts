/**
 * Audit Service
 *
 * Logs all RBAC-related actions for compliance and troubleshooting.
 */

import { PrismaClient, AuditAction, Prisma } from '@/lib/generated/prisma';
import { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

export type AuditActorType = 'user' | 'system_admin' | 'system';

export interface AuditLogInput {
  accountId: string;
  actorId: string;
  actorType?: AuditActorType;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogOptions {
  request?: NextRequest | Request;
}

// =============================================================================
// Audit Service
// =============================================================================

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an audit event
   */
  async log(input: AuditLogInput, options?: AuditLogOptions): Promise<void> {
    const { request } = options ?? {};

    // Extract IP and user agent from request if available
    let ipAddress = input.ipAddress;
    let userAgent = input.userAgent;

    if (request) {
      ipAddress ??= this.extractIpAddress(request);
      userAgent ??= request.headers.get('user-agent') ?? undefined;
    }

    await this.prisma.auditLog.create({
      data: {
        accountId: input.accountId,
        actorId: input.actorId,
        actorType: input.actorType ?? 'user',
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * Log multiple audit events in a transaction
   */
  async logMany(inputs: AuditLogInput[], options?: AuditLogOptions): Promise<void> {
    const { request } = options ?? {};

    const ipAddress = request ? this.extractIpAddress(request) : undefined;
    const userAgent = request?.headers.get('user-agent') ?? undefined;

    await this.prisma.auditLog.createMany({
      data: inputs.map((input) => ({
        accountId: input.accountId,
        actorId: input.actorId,
        actorType: input.actorType ?? 'user',
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? ipAddress,
        userAgent: input.userAgent ?? userAgent,
      })),
    });
  }

  /**
   * Query audit logs for an account
   */
  async query(
    accountId: string,
    options?: {
      actions?: AuditAction[];
      actorId?: string;
      targetId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const { actions, actorId, targetId, startDate, endDate, limit = 50, offset = 0 } = options ?? {};

    // Build date filter separately to combine gte and lte
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const where: Prisma.AuditLogWhereInput = {
      accountId,
      ...(actions?.length && { action: { in: actions } }),
      ...(actorId && { actorId }),
      ...(targetId && { targetId }),
      ...(Object.keys(dateFilter).length > 0 && { occurredAt: dateFilter }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }

  /**
   * Get audit logs for a specific target (user, invitation, membership)
   */
  async getTargetHistory(targetId: string, accountId?: string) {
    const where: Prisma.AuditLogWhereInput = {
      targetId,
      ...(accountId && { accountId }),
    };

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(request: Request | NextRequest): string | undefined {
    // Check common headers for proxied requests
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // For NextRequest, try to get from connection info
    if ('ip' in request && typeof request.ip === 'string') {
      return request.ip;
    }

    return undefined;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create audit log entry for invitation created
 */
export function auditInvitationCreated(
  accountId: string,
  actorId: string,
  invitationId: string,
  metadata: { email: string; role: string; websiteAccess: string }
): AuditLogInput {
  return {
    accountId,
    actorId,
    action: AuditAction.invitation_created,
    targetType: 'invitation',
    targetId: invitationId,
    metadata,
  };
}

/**
 * Create audit log entry for invitation accepted
 */
export function auditInvitationAccepted(
  accountId: string,
  actorId: string,
  invitationId: string,
  metadata: { membershipId: string; role: string }
): AuditLogInput {
  return {
    accountId,
    actorId,
    action: AuditAction.invitation_accepted,
    targetType: 'invitation',
    targetId: invitationId,
    metadata,
  };
}

/**
 * Create audit log entry for member role changed
 */
export function auditMemberRoleChanged(
  accountId: string,
  actorId: string,
  membershipId: string,
  metadata: { userId: string; oldRole: string; newRole: string }
): AuditLogInput {
  return {
    accountId,
    actorId,
    action: AuditAction.member_role_changed,
    targetType: 'membership',
    targetId: membershipId,
    metadata,
  };
}

/**
 * Create audit log entry for member removed
 */
export function auditMemberRemoved(
  accountId: string,
  actorId: string,
  membershipId: string,
  metadata: { userId: string; email?: string }
): AuditLogInput {
  return {
    accountId,
    actorId,
    action: AuditAction.member_removed,
    targetType: 'membership',
    targetId: membershipId,
    metadata,
  };
}

/**
 * Create audit log entry for impersonation started
 */
export function auditImpersonationStarted(
  accountId: string,
  systemAdminId: string,
  sessionId: string,
  metadata: { targetUserId: string; reason: string }
): AuditLogInput {
  return {
    accountId,
    actorId: systemAdminId,
    actorType: 'system_admin',
    action: AuditAction.impersonation_started,
    targetType: 'user',
    targetId: metadata.targetUserId,
    metadata: { sessionId, ...metadata },
  };
}

/**
 * Create audit log entry for impersonation ended
 */
export function auditImpersonationEnded(
  accountId: string,
  systemAdminId: string,
  sessionId: string,
  metadata: { targetUserId: string; duration: number }
): AuditLogInput {
  return {
    accountId,
    actorId: systemAdminId,
    actorType: 'system_admin',
    action: AuditAction.impersonation_ended,
    targetType: 'user',
    targetId: metadata.targetUserId,
    metadata: { sessionId, ...metadata },
  };
}
