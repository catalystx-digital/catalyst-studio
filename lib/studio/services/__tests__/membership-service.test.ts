/**
 * MembershipService Unit Tests
 */

import { AuditAction } from '@/lib/generated/prisma';
import { AccountRole } from '@/lib/auth/account';
import { MembershipService } from '../membership-service';
import { ApiError } from '@/lib/api/errors';

// Track audit service calls
const mockAuditLog = jest.fn();

// Mock audit service
jest.mock('../audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: mockAuditLog,
  })),
  auditMemberRoleChanged: jest.fn((accountId, actorId, membershipId, metadata) => ({
    accountId,
    actorId,
    action: 'member_role_changed',
    targetType: 'membership',
    targetId: membershipId,
    metadata,
  })),
  auditMemberRemoved: jest.fn((accountId, actorId, membershipId, metadata) => ({
    accountId,
    actorId,
    action: 'member_removed',
    targetType: 'membership',
    targetId: membershipId,
    metadata,
  })),
}));

// Mock Prisma client
const createPrismaMock = () => ({
  accountMembership: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  website: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
});

// Test constants
const TEST_ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_ACTOR_ID = '123e4567-e89b-12d3-a456-426614174002';
const TEST_MEMBERSHIP_ID = 'mem-123';
const TEST_WEBSITE_ID = 'web-123';

describe('MembershipService', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let service: MembershipService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLog.mockClear();
    prismaMock = createPrismaMock();
    service = new MembershipService(prismaMock as any);
  });

  describe('list', () => {
    it('lists members with user details', async () => {
      const memberships = [
        {
          id: TEST_MEMBERSHIP_ID,
          accountId: TEST_ACCOUNT_ID,
          userId: TEST_USER_ID,
          role: AccountRole.admin,
          websiteAccess: 'all',
          websiteIds: [],
          invitedBy: null,
          joinedAt: new Date(),
          createdAt: new Date(),
          user: {
            id: TEST_USER_ID,
            email: 'member@example.com',
            name: 'Test Member',
          },
        },
      ];

      prismaMock.accountMembership.findMany.mockResolvedValue(memberships);
      prismaMock.accountMembership.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.list(TEST_ACCOUNT_ID);

      expect(result.members).toHaveLength(1);
      expect(result.members[0].email).toBe('member@example.com');
      expect(result.total).toBe(1);
    });

    it('includes inviter details when present', async () => {
      const memberships = [
        {
          id: TEST_MEMBERSHIP_ID,
          accountId: TEST_ACCOUNT_ID,
          userId: TEST_USER_ID,
          role: AccountRole.member,
          websiteAccess: 'all',
          websiteIds: [],
          invitedBy: TEST_ACTOR_ID,
          joinedAt: new Date(),
          createdAt: new Date(),
          user: {
            id: TEST_USER_ID,
            email: 'member@example.com',
            name: 'Test Member',
          },
        },
      ];

      prismaMock.accountMembership.findMany.mockResolvedValue(memberships);
      prismaMock.accountMembership.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([
        { id: TEST_ACTOR_ID, name: 'Inviter', email: 'inviter@example.com' },
      ]);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.list(TEST_ACCOUNT_ID);

      expect(result.members[0].invitedBy).toBeDefined();
      expect(result.members[0].invitedBy?.email).toBe('inviter@example.com');
    });

    it('includes website names for specific access', async () => {
      const memberships = [
        {
          id: TEST_MEMBERSHIP_ID,
          accountId: TEST_ACCOUNT_ID,
          userId: TEST_USER_ID,
          role: AccountRole.member,
          websiteAccess: 'specific',
          websiteIds: [TEST_WEBSITE_ID],
          invitedBy: null,
          joinedAt: new Date(),
          createdAt: new Date(),
          user: {
            id: TEST_USER_ID,
            email: 'member@example.com',
            name: 'Test Member',
          },
        },
      ];

      prismaMock.accountMembership.findMany.mockResolvedValue(memberships);
      prismaMock.accountMembership.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.website.findMany.mockResolvedValue([
        { id: TEST_WEBSITE_ID, name: 'Marketing Site' },
      ]);

      const result = await service.list(TEST_ACCOUNT_ID);

      expect(result.members[0].websiteNames).toContain('Marketing Site');
    });

    it('respects pagination options', async () => {
      prismaMock.accountMembership.findMany.mockResolvedValue([]);
      prismaMock.accountMembership.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.website.findMany.mockResolvedValue([]);

      await service.list(TEST_ACCOUNT_ID, { limit: 10, offset: 20 });

      expect(prismaMock.accountMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('getById', () => {
    it('returns member details', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: {
          id: TEST_USER_ID,
          email: 'member@example.com',
          name: 'Test Member',
        },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.getById(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID);

      expect(result).toBeDefined();
      expect(result?.id).toBe(TEST_MEMBERSHIP_ID);
      expect(result?.email).toBe('member@example.com');
    });

    it('returns null when member not found', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);

      const result = await service.getById(TEST_ACCOUNT_ID, 'non-existent');

      expect(result).toBeNull();
    });

    it('throws an explicit error for invalid stored roles', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue({
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: 'legacy-admin',
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: {
          id: TEST_USER_ID,
          email: 'member@example.com',
          name: 'Test Member',
        },
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getById(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID)).rejects.toMatchObject({
        code: 'INVALID_ACCOUNT_ROLE',
      });
    });
  });

  describe('update', () => {
    it('updates member role successfully', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: { id: TEST_USER_ID, email: 'member@example.com', name: 'Test User' },
      };

      const updatedMembership = {
        ...membership,
        role: AccountRole.admin,
      };

      // First call: update validation check, Second call: getById after update
      prismaMock.accountMembership.findFirst
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(updatedMembership);
      prismaMock.accountMembership.count.mockResolvedValue(2); // Multiple admins
      prismaMock.accountMembership.update.mockResolvedValue(updatedMembership);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
        role: AccountRole.admin,
      });

      expect(result.role).toBe(AccountRole.admin);
      expect(prismaMock.accountMembership.update).toHaveBeenCalled();
    });

    it('throws error when demoting last admin', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.admin,
        websiteAccess: 'all',
        websiteIds: [],
        user: { id: TEST_USER_ID, email: 'admin@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.accountMembership.count.mockResolvedValue(1); // Last admin

      await expect(
        service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
          role: AccountRole.member,
        })
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    });

    it('updates website access successfully', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: { id: TEST_USER_ID, email: 'member@example.com', name: 'Test User' },
      };

      const updatedMembership = {
        ...membership,
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
      };

      // First call: update validation check, Second call: getById after update
      prismaMock.accountMembership.findFirst
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(updatedMembership);
      prismaMock.website.findMany
        .mockResolvedValueOnce([{ id: TEST_WEBSITE_ID }]) // Validation check
        .mockResolvedValueOnce([{ name: 'Test Website' }]); // For getById websiteNames
      prismaMock.accountMembership.update.mockResolvedValue(updatedMembership);
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
      });

      expect(result.websiteAccess).toBe('specific');
      expect(result.websiteIds).toContain(TEST_WEBSITE_ID);
    });

    it('throws error for specific access without websiteIds', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        user: { id: TEST_USER_ID, email: 'member@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);

      await expect(
        service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
          websiteAccess: 'specific',
          websiteIds: [],
        })
      ).rejects.toMatchObject({ code: 'MISSING_WEBSITE_IDS' });
    });

    it('throws error for invalid websiteIds', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        user: { id: TEST_USER_ID, email: 'member@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.website.findMany.mockResolvedValue([]); // No valid websites

      await expect(
        service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
          websiteAccess: 'specific',
          websiteIds: ['invalid-id'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_WEBSITE_IDS' });
    });

    it('throws error when member not found', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
          role: AccountRole.admin,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns current data when nothing to update', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: { id: TEST_USER_ID, email: 'member@example.com', name: 'Member' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
        role: AccountRole.member, // Same role
      });

      expect(prismaMock.accountMembership.update).not.toHaveBeenCalled();
      expect(result.role).toBe(AccountRole.member);
    });
  });

  describe('remove', () => {
    it('removes member successfully', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        user: { id: TEST_USER_ID, email: 'member@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.accountMembership.delete.mockResolvedValue(membership);

      await service.remove(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID);

      expect(prismaMock.accountMembership.delete).toHaveBeenCalledWith({
        where: { id: TEST_MEMBERSHIP_ID },
      });
    });

    it('throws error when removing self', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_ACTOR_ID, // Same as actor
        role: AccountRole.member,
        user: { id: TEST_ACTOR_ID, email: 'actor@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);

      await expect(
        service.remove(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID)
      ).rejects.toMatchObject({ code: 'SELF_REMOVAL' });
    });

    it('throws error when removing last admin', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.admin,
        user: { id: TEST_USER_ID, email: 'admin@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.accountMembership.count.mockResolvedValue(1); // Last admin

      await expect(
        service.remove(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID)
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    });

    it('throws error when member not found', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('getCount', () => {
    it('returns member counts', async () => {
      prismaMock.accountMembership.count
        .mockResolvedValueOnce(10) // Total
        .mockResolvedValueOnce(3); // Admins

      const result = await service.getCount(TEST_ACCOUNT_ID);

      expect(result.total).toBe(10);
      expect(result.admins).toBe(3);
      expect(result.members).toBe(7);
    });
  });

  describe('isMember', () => {
    it('returns true when user is a member', async () => {
      prismaMock.accountMembership.findUnique.mockResolvedValue({
        id: TEST_MEMBERSHIP_ID,
      });

      const result = await service.isMember(TEST_ACCOUNT_ID, TEST_USER_ID);

      expect(result).toBe(true);
    });

    it('returns false when user is not a member', async () => {
      prismaMock.accountMembership.findUnique.mockResolvedValue(null);

      const result = await service.isMember(TEST_ACCOUNT_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('getUserMemberships', () => {
    it('returns all memberships for a user', async () => {
      const memberships = [
        {
          accountId: TEST_ACCOUNT_ID,
          role: AccountRole.admin,
          websiteAccess: 'all',
          account: { id: TEST_ACCOUNT_ID, name: 'Account 1' },
        },
        {
          accountId: 'account-2',
          role: AccountRole.member,
          websiteAccess: 'specific',
          account: { id: 'account-2', name: 'Account 2' },
        },
      ];

      prismaMock.accountMembership.findMany.mockResolvedValue(memberships);

      const result = await service.getUserMemberships(TEST_USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].accountName).toBe('Account 1');
      expect(result[1].accountName).toBe('Account 2');
    });
  });

  describe('audit logging integration', () => {
    it('logs role change to audit', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: { id: TEST_USER_ID, email: 'member@example.com', name: 'Test User' },
      };

      const updatedMembership = {
        ...membership,
        role: AccountRole.admin,
      };

      prismaMock.accountMembership.findFirst
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(updatedMembership);
      prismaMock.accountMembership.count.mockResolvedValue(2); // Not last admin
      prismaMock.accountMembership.update.mockResolvedValue(updatedMembership);
      prismaMock.website.findMany.mockResolvedValue([]);
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
        role: AccountRole.admin,
      });

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_role_changed,
          targetType: 'membership',
          targetId: TEST_MEMBERSHIP_ID,
        })
      );
    });

    it('logs access change to audit', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: null,
        joinedAt: new Date(),
        createdAt: new Date(),
        user: { id: TEST_USER_ID, email: 'member@example.com', name: 'Test User' },
      };

      const updatedMembership = {
        ...membership,
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
      };

      prismaMock.accountMembership.findFirst
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(updatedMembership);
      prismaMock.website.findMany
        .mockResolvedValueOnce([{ id: TEST_WEBSITE_ID }])
        .mockResolvedValueOnce([{ name: 'Test Website' }]);
      prismaMock.accountMembership.update.mockResolvedValue(updatedMembership);
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.update(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID, {
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
      });

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_access_changed,
          targetType: 'membership',
          targetId: TEST_MEMBERSHIP_ID,
        })
      );
    });

    it('logs member removal to audit', async () => {
      const membership = {
        id: TEST_MEMBERSHIP_ID,
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        user: { id: TEST_USER_ID, email: 'member@example.com' },
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(membership);
      prismaMock.accountMembership.delete.mockResolvedValue(membership);

      await service.remove(TEST_ACCOUNT_ID, TEST_MEMBERSHIP_ID, TEST_ACTOR_ID);

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_removed,
          targetType: 'membership',
          targetId: TEST_MEMBERSHIP_ID,
        })
      );
    });
  });
});
