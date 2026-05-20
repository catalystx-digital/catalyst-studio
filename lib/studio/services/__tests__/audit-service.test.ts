/**
 * AuditService Unit Tests
 */

import { AuditAction } from '@/lib/generated/prisma';
import {
  AuditService,
  AuditLogInput,
  auditInvitationCreated,
  auditInvitationAccepted,
  auditMemberRoleChanged,
  auditMemberRemoved,
  auditImpersonationStarted,
  auditImpersonationEnded,
} from '../audit-service';

// Mock Prisma client
const createPrismaMock = () => ({
  auditLog: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

// Test constants
const TEST_ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_ACTOR_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_TARGET_ID = 'target-123';

describe('AuditService', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = createPrismaMock();
    service = new AuditService(prismaMock as any);
  });

  describe('log', () => {
    it('creates audit log entry', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      const input: AuditLogInput = {
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        action: AuditAction.invitation_created,
        targetType: 'invitation',
        targetId: TEST_TARGET_ID,
        metadata: { email: 'test@example.com' },
      };

      await service.log(input);

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          actorType: 'user',
          action: AuditAction.invitation_created,
          targetType: 'invitation',
          targetId: TEST_TARGET_ID,
          metadata: { email: 'test@example.com' },
        }),
      });
    });

    it('uses system_admin actorType when specified', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      await service.log({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        actorType: 'system_admin',
        action: AuditAction.impersonation_started,
        targetType: 'user',
        targetId: TEST_TARGET_ID,
      });

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorType: 'system_admin',
        }),
      });
    });

    it('extracts IP address from x-forwarded-for header', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      const mockRequest = {
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'user-agent': 'Test Browser',
        }),
      } as Request;

      await service.log(
        {
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_role_changed,
        },
        { request: mockRequest }
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser',
        }),
      });
    });

    it('extracts IP address from x-real-ip header', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      const mockRequest = {
        headers: new Headers({
          'x-real-ip': '10.0.0.100',
        }),
      } as Request;

      await service.log(
        {
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_removed,
        },
        { request: mockRequest }
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '10.0.0.100',
        }),
      });
    });

    it('uses provided IP address over headers', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      const mockRequest = {
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1',
        }),
      } as Request;

      await service.log(
        {
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_removed,
          ipAddress: '10.10.10.10',
        },
        { request: mockRequest }
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '10.10.10.10',
        }),
      });
    });
  });

  describe('logMany', () => {
    it('creates multiple audit log entries', async () => {
      prismaMock.auditLog.createMany.mockResolvedValue({ count: 2 });

      const inputs: AuditLogInput[] = [
        {
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.invitation_created,
        },
        {
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.member_role_changed,
        },
      ];

      await service.logMany(inputs);

      expect(prismaMock.auditLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ action: AuditAction.invitation_created }),
          expect.objectContaining({ action: AuditAction.member_role_changed }),
        ]),
      });
    });
  });

  describe('query', () => {
    it('queries audit logs with filters', async () => {
      const logs = [
        {
          id: 'log-1',
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_ACTOR_ID,
          action: AuditAction.invitation_created,
          occurredAt: new Date(),
        },
      ];

      prismaMock.auditLog.findMany.mockResolvedValue(logs);
      prismaMock.auditLog.count.mockResolvedValue(1);

      const result = await service.query(TEST_ACCOUNT_ID, {
        actions: [AuditAction.invitation_created],
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toEqual(logs);
      expect(result.total).toBe(1);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: TEST_ACCOUNT_ID,
            action: { in: [AuditAction.invitation_created] },
          }),
          take: 10,
          skip: 0,
        })
      );
    });

    it('applies date range filters', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      prismaMock.auditLog.findMany.mockResolvedValue([]);
      prismaMock.auditLog.count.mockResolvedValue(0);

      await service.query(TEST_ACCOUNT_ID, { startDate, endDate });

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { gte: startDate, lte: endDate },
          }),
        })
      );
    });
  });

  describe('getTargetHistory', () => {
    it('returns audit logs for a target', async () => {
      const logs = [
        {
          id: 'log-1',
          targetId: TEST_TARGET_ID,
          action: AuditAction.member_role_changed,
        },
        {
          id: 'log-2',
          targetId: TEST_TARGET_ID,
          action: AuditAction.member_access_changed,
        },
      ];

      prismaMock.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.getTargetHistory(TEST_TARGET_ID);

      expect(result).toEqual(logs);
      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: { targetId: TEST_TARGET_ID },
        orderBy: { occurredAt: 'desc' },
      });
    });

    it('filters by accountId when provided', async () => {
      prismaMock.auditLog.findMany.mockResolvedValue([]);

      await service.getTargetHistory(TEST_TARGET_ID, TEST_ACCOUNT_ID);

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: { targetId: TEST_TARGET_ID, accountId: TEST_ACCOUNT_ID },
        orderBy: { occurredAt: 'desc' },
      });
    });
  });
});

describe('Convenience Functions', () => {
  describe('auditInvitationCreated', () => {
    it('creates invitation created log input', () => {
      const result = auditInvitationCreated(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'inv-123', {
        email: 'test@example.com',
        role: 'member',
        websiteAccess: 'all',
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        action: AuditAction.invitation_created,
        targetType: 'invitation',
        targetId: 'inv-123',
        metadata: {
          email: 'test@example.com',
          role: 'member',
          websiteAccess: 'all',
        },
      });
    });
  });

  describe('auditInvitationAccepted', () => {
    it('creates invitation accepted log input', () => {
      const result = auditInvitationAccepted(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'inv-123', {
        membershipId: 'mem-123',
        role: 'member',
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        action: AuditAction.invitation_accepted,
        targetType: 'invitation',
        targetId: 'inv-123',
        metadata: {
          membershipId: 'mem-123',
          role: 'member',
        },
      });
    });
  });

  describe('auditMemberRoleChanged', () => {
    it('creates member role changed log input', () => {
      const result = auditMemberRoleChanged(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'mem-123', {
        userId: 'user-123',
        oldRole: 'member',
        newRole: 'admin',
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        action: AuditAction.member_role_changed,
        targetType: 'membership',
        targetId: 'mem-123',
        metadata: {
          userId: 'user-123',
          oldRole: 'member',
          newRole: 'admin',
        },
      });
    });
  });

  describe('auditMemberRemoved', () => {
    it('creates member removed log input', () => {
      const result = auditMemberRemoved(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'mem-123', {
        userId: 'user-123',
        email: 'removed@example.com',
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        action: AuditAction.member_removed,
        targetType: 'membership',
        targetId: 'mem-123',
        metadata: {
          userId: 'user-123',
          email: 'removed@example.com',
        },
      });
    });
  });

  describe('auditImpersonationStarted', () => {
    it('creates impersonation started log input', () => {
      const result = auditImpersonationStarted(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'session-123', {
        targetUserId: 'target-user',
        reason: 'Support ticket #12345',
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        actorType: 'system_admin',
        action: AuditAction.impersonation_started,
        targetType: 'user',
        targetId: 'target-user',
        metadata: {
          sessionId: 'session-123',
          targetUserId: 'target-user',
          reason: 'Support ticket #12345',
        },
      });
    });
  });

  describe('auditImpersonationEnded', () => {
    it('creates impersonation ended log input', () => {
      const result = auditImpersonationEnded(TEST_ACCOUNT_ID, TEST_ACTOR_ID, 'session-123', {
        targetUserId: 'target-user',
        duration: 3600,
      });

      expect(result).toEqual({
        accountId: TEST_ACCOUNT_ID,
        actorId: TEST_ACTOR_ID,
        actorType: 'system_admin',
        action: AuditAction.impersonation_ended,
        targetType: 'user',
        targetId: 'target-user',
        metadata: {
          sessionId: 'session-123',
          targetUserId: 'target-user',
          duration: 3600,
        },
      });
    });
  });
});
