/**
 * Membership Service
 *
 * Handles account membership management (update, remove, list).
 */

import { PrismaClient, AuditAction, Prisma } from '@/lib/generated/prisma';
import { AccountRole, type AccountRoleType } from '@/lib/auth/account';
import { ApiError } from '@/lib/api/errors';
import {
  AuditService,
  auditMemberRoleChanged,
  auditMemberRemoved,
} from './audit-service';

// =============================================================================
// Types
// =============================================================================

export interface MemberWithDetails {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: AccountRoleType;
  websiteAccess: string;
  websiteIds: string[];
  websiteNames: string[];
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  joinedAt: Date;
  createdAt: Date;
}

export interface UpdateMemberInput {
  role?: AccountRoleType;
  websiteAccess?: 'all' | 'specific';
  websiteIds?: string[];
}

// =============================================================================
// Membership Service
// =============================================================================

export class MembershipService {
  private auditService: AuditService;

  constructor(private prisma: PrismaClient) {
    this.auditService = new AuditService(prisma);
  }

  /**
   * List all members of an account
   */
  async list(
    accountId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ members: MemberWithDetails[]; total: number }> {
    const { limit = 50, offset = 0 } = options ?? {};

    const [memberships, total] = await Promise.all([
      this.prisma.accountMembership.findMany({
        where: { accountId },
        orderBy: { joinedAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      this.prisma.accountMembership.count({ where: { accountId } }),
    ]);

    // Get inviter details
    const inviterIds = memberships
      .map((m) => m.invitedBy)
      .filter((id): id is string => id !== null);

    const inviters = inviterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: inviterIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const inviterMap = new Map(inviters.map((u) => [u.id, u]));

    // Get website names
    const websiteIds = memberships.flatMap((m) => m.websiteIds);
    const websites = websiteIds.length
      ? await this.prisma.website.findMany({
          where: { id: { in: websiteIds } },
          select: { id: true, name: true },
        })
      : [];
    const websiteMap = new Map(websites.map((w) => [w.id, w.name]));

    const members: MemberWithDetails[] = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      websiteAccess: m.websiteAccess,
      websiteIds: m.websiteIds,
      websiteNames: m.websiteIds.map((id) => websiteMap.get(id) ?? 'Unknown'),
      invitedBy: m.invitedBy ? inviterMap.get(m.invitedBy) ?? null : null,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
    }));

    return { members, total };
  }

  /**
   * Get a single member by ID
   */
  async getById(accountId: string, membershipId: string): Promise<MemberWithDetails | null> {
    const membership = await this.prisma.accountMembership.findFirst({
      where: { id: membershipId, accountId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!membership) {
      return null;
    }

    const inviter = membership.invitedBy
      ? await this.prisma.user.findUnique({
          where: { id: membership.invitedBy },
          select: { id: true, name: true, email: true },
        })
      : null;

    const websiteNames = membership.websiteIds.length
      ? await this.prisma.website
          .findMany({
            where: { id: { in: membership.websiteIds } },
            select: { name: true },
          })
          .then((websites) => websites.map((w) => w.name))
      : [];

    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      websiteAccess: membership.websiteAccess,
      websiteIds: membership.websiteIds,
      websiteNames,
      invitedBy: inviter,
      joinedAt: membership.joinedAt,
      createdAt: membership.createdAt,
    };
  }

  /**
   * Update a member's role or access
   */
  async update(
    accountId: string,
    membershipId: string,
    actorId: string,
    input: UpdateMemberInput
  ): Promise<MemberWithDetails> {
    const membership = await this.prisma.accountMembership.findFirst({
      where: { id: membershipId, accountId },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!membership) {
      throw new ApiError(404, 'Member not found', 'NOT_FOUND');
    }

    // Prevent removing the last admin
    if (input.role === AccountRole.member && membership.role === AccountRole.admin) {
      const adminCount = await this.prisma.accountMembership.count({
        where: { accountId, role: AccountRole.admin },
      });

      if (adminCount === 1) {
        throw new ApiError(
          400,
          'Cannot demote the last admin. Promote another member first.',
          'LAST_ADMIN'
        );
      }
    }

    // Validate websiteIds if specific access
    if (input.websiteAccess === 'specific') {
      const websiteIds = input.websiteIds ?? membership.websiteIds;

      if (!websiteIds.length) {
        throw new ApiError(400, 'Website IDs required for specific access', 'MISSING_WEBSITE_IDS');
      }

      const validWebsites = await this.prisma.website.findMany({
        where: { id: { in: websiteIds }, accountId },
        select: { id: true },
      });

      if (validWebsites.length !== websiteIds.length) {
        throw new ApiError(400, 'One or more website IDs are invalid', 'INVALID_WEBSITE_IDS');
      }
    }

    const updateData: Prisma.AccountMembershipUpdateInput = {};
    const oldRole = membership.role;
    const oldAccess = membership.websiteAccess;

    if (input.role !== undefined && input.role !== membership.role) {
      updateData.role = input.role;
    }

    if (input.websiteAccess !== undefined && input.websiteAccess !== membership.websiteAccess) {
      updateData.websiteAccess = input.websiteAccess;
    }

    if (input.websiteIds !== undefined) {
      updateData.websiteIds = input.websiteIds;
    }

    // If nothing to update, just return current data
    if (Object.keys(updateData).length === 0) {
      return (await this.getById(accountId, membershipId))!;
    }

    await this.prisma.accountMembership.update({
      where: { id: membershipId },
      data: updateData,
    });

    // Log audit events
    if (input.role !== undefined && input.role !== oldRole) {
      await this.auditService.log(
        auditMemberRoleChanged(accountId, actorId, membershipId, {
          userId: membership.userId,
          oldRole,
          newRole: input.role,
        })
      );
    }

    if (
      input.websiteAccess !== undefined &&
      (input.websiteAccess !== oldAccess ||
        JSON.stringify(input.websiteIds) !== JSON.stringify(membership.websiteIds))
    ) {
      await this.auditService.log({
        accountId,
        actorId,
        action: AuditAction.member_access_changed,
        targetType: 'membership',
        targetId: membershipId,
        metadata: {
          userId: membership.userId,
          oldAccess,
          newAccess: input.websiteAccess,
          oldWebsiteIds: membership.websiteIds,
          newWebsiteIds: input.websiteIds ?? membership.websiteIds,
        },
      });
    }

    return (await this.getById(accountId, membershipId))!;
  }

  /**
   * Remove a member from the account
   */
  async remove(accountId: string, membershipId: string, actorId: string): Promise<void> {
    const membership = await this.prisma.accountMembership.findFirst({
      where: { id: membershipId, accountId },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!membership) {
      throw new ApiError(404, 'Member not found', 'NOT_FOUND');
    }

    // Prevent self-removal
    if (membership.userId === actorId) {
      throw new ApiError(400, 'Cannot remove yourself. Transfer ownership first.', 'SELF_REMOVAL');
    }

    // Prevent removing the last admin
    if (membership.role === AccountRole.admin) {
      const adminCount = await this.prisma.accountMembership.count({
        where: { accountId, role: AccountRole.admin },
      });

      if (adminCount === 1) {
        throw new ApiError(
          400,
          'Cannot remove the last admin. Promote another member first.',
          'LAST_ADMIN'
        );
      }
    }

    await this.prisma.accountMembership.delete({
      where: { id: membershipId },
    });

    // Log the action
    await this.auditService.log(
      auditMemberRemoved(accountId, actorId, membershipId, {
        userId: membership.userId,
        email: membership.user.email ?? undefined,
      })
    );
  }

  /**
   * Get member count for an account
   */
  async getCount(accountId: string): Promise<{ total: number; admins: number; members: number }> {
    const [total, admins] = await Promise.all([
      this.prisma.accountMembership.count({ where: { accountId } }),
      this.prisma.accountMembership.count({ where: { accountId, role: AccountRole.admin } }),
    ]);

    return {
      total,
      admins,
      members: total - admins,
    };
  }

  /**
   * Check if a user is a member of an account
   */
  async isMember(accountId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.accountMembership.findUnique({
      where: { accountId_userId: { accountId, userId } },
    });

    return membership !== null;
  }

  /**
   * Get a user's membership across all accounts
   */
  async getUserMemberships(userId: string): Promise<
    {
      accountId: string;
      accountName: string;
      role: AccountRoleType;
      websiteAccess: string;
    }[]
  > {
    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId },
      include: {
        account: { select: { id: true, name: true } },
      },
    });

    return memberships.map((m) => ({
      accountId: m.account.id,
      accountName: m.account.name,
      role: m.role,
      websiteAccess: m.websiteAccess,
    }));
  }
}
