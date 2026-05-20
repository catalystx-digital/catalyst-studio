/**
 * ImpersonationService Unit Tests
 */

import { ImpersonationService } from '../impersonation-service';
import { ApiError } from '@/lib/api/errors';

// Track audit service calls
const mockAuditLog = jest.fn();

// Mock audit service
jest.mock('../audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: mockAuditLog,
  })),
  auditImpersonationStarted: jest.fn((accountId, systemAdminId, sessionId, metadata) => ({
    accountId,
    actorId: systemAdminId,
    actorType: 'system_admin',
    action: 'impersonation_started',
    targetType: 'user',
    targetId: metadata.targetUserId,
    metadata: { sessionId, ...metadata },
  })),
  auditImpersonationEnded: jest.fn((accountId, systemAdminId, sessionId, metadata) => ({
    accountId,
    actorId: systemAdminId,
    actorType: 'system_admin',
    action: 'impersonation_ended',
    targetType: 'user',
    targetId: metadata.targetUserId,
    metadata: { sessionId, ...metadata },
  })),
}));

// Mock Prisma client
const createPrismaMock = () => ({
  systemAdmin: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  impersonationSession: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  accountMembership: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
});

// Test constants
const TEST_SYSTEM_ADMIN_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_TARGET_USER_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_TARGET_ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174002';
const TEST_SESSION_ID = 'session-123';

describe('ImpersonationService', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let service: ImpersonationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLog.mockClear();
    prismaMock = createPrismaMock();
    service = new ImpersonationService(prismaMock as any);
  });

  describe('isSystemAdmin', () => {
    it('returns true for active system admin', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });

      const result = await service.isSystemAdmin(TEST_SYSTEM_ADMIN_ID);

      expect(result).toBe(true);
    });

    it('returns false for inactive system admin', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: false,
      });

      const result = await service.isSystemAdmin(TEST_SYSTEM_ADMIN_ID);

      expect(result).toBe(false);
    });

    it('returns false when not a system admin', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue(null);

      const result = await service.isSystemAdmin(TEST_SYSTEM_ADMIN_ID);

      expect(result).toBe(false);
    });
  });

  describe('startSession', () => {
    it('starts impersonation session successfully', async () => {
      const startedAt = new Date();

      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'target@example.com',
        name: 'Target User',
      });
      prismaMock.accountMembership.findUnique.mockResolvedValue({
        accountId: TEST_TARGET_ACCOUNT_ID,
        userId: TEST_TARGET_USER_ID,
      });
      prismaMock.impersonationSession.findFirst.mockResolvedValue(null); // No existing session
      prismaMock.impersonationSession.create.mockResolvedValue({
        id: TEST_SESSION_ID,
        systemAdminId: TEST_SYSTEM_ADMIN_ID,
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket #12345',
        startedAt,
        endedAt: null,
      });

      const result = await service.startSession(TEST_SYSTEM_ADMIN_ID, {
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket #12345',
      });

      expect(result.id).toBe(TEST_SESSION_ID);
      expect(result.targetUserId).toBe(TEST_TARGET_USER_ID);
      expect(result.reason).toBe('Support ticket #12345');
    });

    it('throws error when not a system admin', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue(null);

      await expect(
        service.startSession(TEST_SYSTEM_ADMIN_ID, {
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          reason: 'Support ticket #12345',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws error when target user not found', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.startSession(TEST_SYSTEM_ADMIN_ID, {
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          reason: 'Support ticket #12345',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws error when user is not a member of account', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'target@example.com',
      });
      prismaMock.accountMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.startSession(TEST_SYSTEM_ADMIN_ID, {
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          reason: 'Support ticket #12345',
        })
      ).rejects.toMatchObject({ code: 'NOT_MEMBER' });
    });

    it('throws error when already has active session', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'target@example.com',
      });
      prismaMock.accountMembership.findUnique.mockResolvedValue({
        accountId: TEST_TARGET_ACCOUNT_ID,
        userId: TEST_TARGET_USER_ID,
      });
      prismaMock.impersonationSession.findFirst.mockResolvedValue({
        id: 'existing-session',
        endedAt: null,
      });

      await expect(
        service.startSession(TEST_SYSTEM_ADMIN_ID, {
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          reason: 'Support ticket #12345',
        })
      ).rejects.toMatchObject({ code: 'SESSION_EXISTS' });
    });

    it('throws error for invalid reason', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'target@example.com',
      });
      prismaMock.accountMembership.findUnique.mockResolvedValue({
        accountId: TEST_TARGET_ACCOUNT_ID,
        userId: TEST_TARGET_USER_ID,
      });
      prismaMock.impersonationSession.findFirst.mockResolvedValue(null);

      await expect(
        service.startSession(TEST_SYSTEM_ADMIN_ID, {
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          reason: 'short', // Too short
        })
      ).rejects.toMatchObject({ code: 'INVALID_REASON' });
    });
  });

  describe('endSession', () => {
    it('ends session successfully', async () => {
      const startedAt = new Date(Date.now() - 60000); // Started 1 minute ago
      const session = {
        id: TEST_SESSION_ID,
        systemAdminId: TEST_SYSTEM_ADMIN_ID,
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket',
        startedAt,
        endedAt: null,
      };

      prismaMock.impersonationSession.findFirst.mockResolvedValue(session);
      prismaMock.impersonationSession.update.mockResolvedValue({
        ...session,
        endedAt: new Date(),
      });

      await service.endSession(TEST_SYSTEM_ADMIN_ID, TEST_SESSION_ID);

      expect(prismaMock.impersonationSession.update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        data: { endedAt: expect.any(Date) },
      });
    });

    it('throws error when session not found', async () => {
      prismaMock.impersonationSession.findFirst.mockResolvedValue(null);

      await expect(
        service.endSession(TEST_SYSTEM_ADMIN_ID, TEST_SESSION_ID)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('getActiveSession', () => {
    it('returns active session', async () => {
      const session = {
        id: TEST_SESSION_ID,
        systemAdminId: TEST_SYSTEM_ADMIN_ID,
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        startedAt: new Date(),
        endedAt: null,
      };

      prismaMock.impersonationSession.findFirst.mockResolvedValue(session);

      const result = await service.getActiveSession(TEST_SYSTEM_ADMIN_ID);

      expect(result).toBeDefined();
      expect(result?.id).toBe(TEST_SESSION_ID);
    });

    it('returns null when no active session', async () => {
      prismaMock.impersonationSession.findFirst.mockResolvedValue(null);

      const result = await service.getActiveSession(TEST_SYSTEM_ADMIN_ID);

      expect(result).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('lists sessions with pagination', async () => {
      const sessions = [
        {
          id: TEST_SESSION_ID,
          systemAdminId: TEST_SYSTEM_ADMIN_ID,
          targetUserId: TEST_TARGET_USER_ID,
          targetAccountId: TEST_TARGET_ACCOUNT_ID,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      ];

      prismaMock.impersonationSession.findMany.mockResolvedValue(sessions);
      prismaMock.impersonationSession.count.mockResolvedValue(1);

      const result = await service.listSessions(TEST_SYSTEM_ADMIN_ID);

      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('respects pagination options', async () => {
      prismaMock.impersonationSession.findMany.mockResolvedValue([]);
      prismaMock.impersonationSession.count.mockResolvedValue(0);

      await service.listSessions(TEST_SYSTEM_ADMIN_ID, { limit: 10, offset: 20 });

      expect(prismaMock.impersonationSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('grantSystemAdmin', () => {
    it('grants system admin to new user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'user@example.com',
      });
      prismaMock.systemAdmin.findUnique.mockResolvedValue(null);
      prismaMock.systemAdmin.create.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: true,
        grantedAt: new Date(),
      });

      await service.grantSystemAdmin(TEST_TARGET_USER_ID, TEST_SYSTEM_ADMIN_ID);

      expect(prismaMock.systemAdmin.create).toHaveBeenCalledWith({
        data: { userId: TEST_TARGET_USER_ID, grantedBy: TEST_SYSTEM_ADMIN_ID },
      });
    });

    it('reactivates inactive system admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'user@example.com',
      });
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: false,
      });
      prismaMock.systemAdmin.update.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: true,
      });

      await service.grantSystemAdmin(TEST_TARGET_USER_ID, TEST_SYSTEM_ADMIN_ID);

      expect(prismaMock.systemAdmin.update).toHaveBeenCalled();
    });

    it('throws error when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.grantSystemAdmin(TEST_TARGET_USER_ID, TEST_SYSTEM_ADMIN_ID)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws error when already an active admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'user@example.com',
      });
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: true,
      });

      await expect(
        service.grantSystemAdmin(TEST_TARGET_USER_ID, TEST_SYSTEM_ADMIN_ID)
      ).rejects.toMatchObject({ code: 'ALREADY_ADMIN' });
    });
  });

  describe('revokeSystemAdmin', () => {
    it('revokes system admin status', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: true,
      });
      prismaMock.impersonationSession.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.systemAdmin.update.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: false,
      });

      await service.revokeSystemAdmin(TEST_TARGET_USER_ID);

      expect(prismaMock.systemAdmin.update).toHaveBeenCalledWith({
        where: { userId: TEST_TARGET_USER_ID },
        data: { isActive: false },
      });
    });

    it('ends active impersonation sessions when revoking', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: true,
      });
      prismaMock.impersonationSession.updateMany.mockResolvedValue({ count: 2 });
      prismaMock.systemAdmin.update.mockResolvedValue({
        userId: TEST_TARGET_USER_ID,
        isActive: false,
      });

      await service.revokeSystemAdmin(TEST_TARGET_USER_ID);

      expect(prismaMock.impersonationSession.updateMany).toHaveBeenCalledWith({
        where: { systemAdminId: TEST_TARGET_USER_ID, endedAt: null },
        data: { endedAt: expect.any(Date) },
      });
    });

    it('throws error when system admin not found', async () => {
      prismaMock.systemAdmin.findUnique.mockResolvedValue(null);

      await expect(service.revokeSystemAdmin(TEST_TARGET_USER_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('listSystemAdmins', () => {
    it('lists all system admins', async () => {
      const admins = [
        {
          userId: TEST_SYSTEM_ADMIN_ID,
          isActive: true,
          grantedAt: new Date(),
          user: { email: 'admin1@example.com', name: 'Admin 1' },
        },
        {
          userId: TEST_TARGET_USER_ID,
          isActive: false,
          grantedAt: new Date(),
          user: { email: 'admin2@example.com', name: 'Admin 2' },
        },
      ];

      prismaMock.systemAdmin.findMany.mockResolvedValue(admins);

      const result = await service.listSystemAdmins();

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('admin1@example.com');
      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(false);
    });
  });

  describe('audit logging integration', () => {
    it('logs impersonation start to audit', async () => {
      const startedAt = new Date();

      prismaMock.systemAdmin.findUnique.mockResolvedValue({
        userId: TEST_SYSTEM_ADMIN_ID,
        isActive: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_TARGET_USER_ID,
        email: 'target@example.com',
        name: 'Target User',
      });
      prismaMock.accountMembership.findUnique.mockResolvedValue({
        accountId: TEST_TARGET_ACCOUNT_ID,
        userId: TEST_TARGET_USER_ID,
      });
      prismaMock.impersonationSession.findFirst.mockResolvedValue(null);
      prismaMock.impersonationSession.create.mockResolvedValue({
        id: TEST_SESSION_ID,
        systemAdminId: TEST_SYSTEM_ADMIN_ID,
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket #12345',
        startedAt,
        endedAt: null,
      });

      await service.startSession(TEST_SYSTEM_ADMIN_ID, {
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket #12345',
      });

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_TARGET_ACCOUNT_ID,
          actorId: TEST_SYSTEM_ADMIN_ID,
          actorType: 'system_admin',
          action: 'impersonation_started',
          targetType: 'user',
          targetId: TEST_TARGET_USER_ID,
        })
      );
    });

    it('logs impersonation end to audit', async () => {
      const startedAt = new Date(Date.now() - 60000);
      const session = {
        id: TEST_SESSION_ID,
        systemAdminId: TEST_SYSTEM_ADMIN_ID,
        targetUserId: TEST_TARGET_USER_ID,
        targetAccountId: TEST_TARGET_ACCOUNT_ID,
        reason: 'Support ticket',
        startedAt,
        endedAt: null,
      };

      prismaMock.impersonationSession.findFirst.mockResolvedValue(session);
      prismaMock.impersonationSession.update.mockResolvedValue({
        ...session,
        endedAt: new Date(),
      });

      await service.endSession(TEST_SYSTEM_ADMIN_ID, TEST_SESSION_ID);

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_TARGET_ACCOUNT_ID,
          actorId: TEST_SYSTEM_ADMIN_ID,
          actorType: 'system_admin',
          action: 'impersonation_ended',
          targetType: 'user',
          targetId: TEST_TARGET_USER_ID,
        })
      );
    });
  });
});
