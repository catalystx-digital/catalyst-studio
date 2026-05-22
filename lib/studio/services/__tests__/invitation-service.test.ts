/**
 * InvitationService Unit Tests
 */

import { InvitationStatus, EmailDeliveryStatus, AuditAction } from '@/lib/generated/prisma';
import { AccountRole } from '@/lib/auth/account';
import { InvitationService } from '../invitation-service';
import { ApiError } from '@/lib/api/errors';

// Track audit service calls
const mockAuditLog = jest.fn();

// Mock audit service
jest.mock('../audit-service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: mockAuditLog,
  })),
  auditInvitationCreated: jest.fn((accountId, actorId, invitationId, metadata) => ({
    accountId,
    actorId,
    action: 'invitation_created',
    targetType: 'invitation',
    targetId: invitationId,
    metadata,
  })),
  auditInvitationAccepted: jest.fn((accountId, actorId, invitationId, metadata) => ({
    accountId,
    actorId,
    action: 'invitation_accepted',
    targetType: 'invitation',
    targetId: invitationId,
    metadata,
  })),
}));

// Mock Prisma client
const createPrismaMock = () => ({
  accountMembership: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
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
const TEST_INVITATION_ID = 'inv-123';
const TEST_EMAIL = 'test@example.com';
const TEST_WEBSITE_ID = 'web-123';

describe('InvitationService', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let service: InvitationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLog.mockClear();
    prismaMock = createPrismaMock();
    service = new InvitationService(prismaMock as any);
  });

  describe('create', () => {
    it('creates invitation successfully with all access', async () => {
      // Setup mocks
      const createdInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        token: 'test-token',
        status: InvitationStatus.pending,
        emailStatus: EmailDeliveryStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        respondedAt: null,
        emailSentAt: null,
        emailError: null,
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst
        .mockResolvedValueOnce(null) // For checking existing invitation
        .mockResolvedValueOnce(createdInvitation); // For getById
      prismaMock.invitation.create.mockResolvedValue(createdInvitation);
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
      });

      expect(result.invitation).toBeDefined();
      expect(result.invitation.email).toBe(TEST_EMAIL);
      expect(result.invitation.role).toBe(AccountRole.member);
      // Verify action link format (contains /invite/accept?token= with a hex token)
      expect(result.actionLink).toMatch(/\/invite\/accept\?token=[a-f0-9]+$/);
      expect(prismaMock.invitation.create).toHaveBeenCalled();
    });

    it('creates invitation with specific website access', async () => {
      const createdInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
        token: 'test-token',
        status: InvitationStatus.pending,
        emailStatus: EmailDeliveryStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        respondedAt: null,
        emailSentAt: null,
        emailError: null,
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst
        .mockResolvedValueOnce(null) // For checking existing invitation
        .mockResolvedValueOnce(createdInvitation); // For getById
      prismaMock.website.findMany
        .mockResolvedValueOnce([{ id: TEST_WEBSITE_ID }]) // For validation
        .mockResolvedValueOnce([{ id: TEST_WEBSITE_ID, name: 'Marketing Site' }]); // For getById
      prismaMock.invitation.create.mockResolvedValue(createdInvitation);
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });

      const result = await service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
      });

      expect(result.invitation.websiteAccess).toBe('specific');
      expect(result.invitation.websiteIds).toContain(TEST_WEBSITE_ID);
    });

    it('throws error if email is already a member', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue({
        id: 'existing-membership',
        accountId: TEST_ACCOUNT_ID,
        userId: 'some-user-id',
      });

      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'all',
        })
      ).rejects.toThrow(ApiError);

      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'all',
        })
      ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
    });

    it('throws error if pending invitation exists', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst.mockResolvedValue({
        id: 'existing-invitation',
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
      });

      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'all',
        })
      ).rejects.toMatchObject({ code: 'INVITATION_EXISTS' });
    });

    it('throws error for invalid email format', async () => {
      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: 'invalid-email',
          role: AccountRole.member,
          websiteAccess: 'all',
        })
      ).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
    });

    it('throws error for specific access without websiteIds', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'specific',
          websiteIds: [],
        })
      ).rejects.toMatchObject({ code: 'MISSING_WEBSITE_IDS' });
    });

    it('throws error for invalid websiteIds', async () => {
      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst.mockResolvedValue(null);
      prismaMock.website.findMany.mockResolvedValue([]); // No valid websites found

      await expect(
        service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'specific',
          websiteIds: ['invalid-id'],
        })
      ).rejects.toMatchObject({ code: 'INVALID_WEBSITE_IDS' });
    });
  });

  describe('resend', () => {
    it('resends invitation successfully', async () => {
      const existingInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(),
        createdAt: new Date(),
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        respondedAt: null,
        emailError: null,
      };

      prismaMock.invitation.findFirst.mockResolvedValue(existingInvitation);
      prismaMock.invitation.update.mockResolvedValue({
        ...existingInvitation,
        emailStatus: EmailDeliveryStatus.pending,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });

      const result = await service.resend(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(prismaMock.invitation.update).toHaveBeenCalled();
    });

    it('throws error when invitation not found', async () => {
      prismaMock.invitation.findFirst.mockResolvedValue(null);

      await expect(
        service.resend(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws error when invitation is not pending', async () => {
      prismaMock.invitation.findFirst.mockResolvedValue({
        id: TEST_INVITATION_ID,
        status: InvitationStatus.accepted,
      });

      await expect(
        service.resend(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });

    it('extends expiration date by 30 days on resend', async () => {
      const oldExpiresAt = new Date();
      const existingInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: TEST_USER_ID,
        expiresAt: oldExpiresAt,
        createdAt: new Date(),
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        respondedAt: null,
        emailError: null,
      };

      prismaMock.invitation.findFirst.mockResolvedValue(existingInvitation);
      prismaMock.invitation.update.mockResolvedValue({
        ...existingInvitation,
        emailStatus: EmailDeliveryStatus.pending,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });

      await service.resend(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID);

      // Verify update was called with new expiration date ~30 days from now
      expect(prismaMock.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_INVITATION_ID },
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
            emailStatus: EmailDeliveryStatus.pending,
          }),
        })
      );

      // Extract the expiresAt from the update call and verify it's approximately 30 days from now
      const updateCall = prismaMock.invitation.update.mock.calls[0][0];
      const newExpiresAt = updateCall.data.expiresAt as Date;
      const expectedExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      // Allow 1 minute tolerance for test execution time
      expect(newExpiresAt.getTime()).toBeGreaterThan(expectedExpiry - 60000);
      expect(newExpiresAt.getTime()).toBeLessThan(expectedExpiry + 60000);
    });

    it('throws error when resend limit exceeded', async () => {
      const existingInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(),
        createdAt: new Date(),
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        respondedAt: null,
        emailError: null,
        metadata: { resendCount: 3 }, // Already at limit
      };

      prismaMock.invitation.findFirst.mockResolvedValue(existingInvitation);

      await expect(
        service.resend(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID)
      ).rejects.toMatchObject({ code: 'RESEND_LIMIT_EXCEEDED' });
    });
  });

  describe('revoke', () => {
    it('revokes invitation successfully', async () => {
      const existingInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
      };

      prismaMock.invitation.findFirst.mockResolvedValue(existingInvitation);
      prismaMock.invitation.update.mockResolvedValue({
        ...existingInvitation,
        status: InvitationStatus.revoked,
        respondedAt: new Date(),
      });

      await service.revoke(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID);

      expect(prismaMock.invitation.update).toHaveBeenCalledWith({
        where: { id: TEST_INVITATION_ID },
        data: {
          status: InvitationStatus.revoked,
          respondedAt: expect.any(Date),
        },
      });
    });

    it('throws error when invitation not found', async () => {
      prismaMock.invitation.findFirst.mockResolvedValue(null);

      await expect(
        service.revoke(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID)
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws error when invitation is not pending', async () => {
      prismaMock.invitation.findFirst.mockResolvedValue({
        id: TEST_INVITATION_ID,
        status: InvitationStatus.revoked,
      });

      await expect(
        service.revoke(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });
  });

  describe('accept', () => {
    it('accepts invitation and creates membership', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires tomorrow
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);
      prismaMock.website.findMany.mockResolvedValue([]);
      prismaMock.accountMembership.create.mockResolvedValue({
        id: 'membership-123',
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: TEST_USER_ID,
        joinedAt: new Date(),
        createdAt: new Date(),
      });
      prismaMock.invitation.update.mockResolvedValue({
        ...invitation,
        status: InvitationStatus.accepted,
      });

      const result = await service.accept(TEST_INVITATION_ID, TEST_USER_ID, TEST_EMAIL);

      expect(result.membership).toBeDefined();
      expect(result.account.name).toBe('Test Account');
      expect(prismaMock.accountMembership.create).toHaveBeenCalled();
    });

    it('throws error when email does not match', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);

      await expect(
        service.accept(TEST_INVITATION_ID, TEST_USER_ID, 'wrong@email.com')
      ).rejects.toMatchObject({ code: 'EMAIL_MISMATCH' });
    });

    it('throws error when invitation is expired', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);

      await expect(
        service.accept(TEST_INVITATION_ID, TEST_USER_ID, TEST_EMAIL)
      ).rejects.toMatchObject({ code: 'EXPIRED' });
    });

    it('throws error when invitation is already accepted', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        status: InvitationStatus.accepted,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);

      await expect(
        service.accept(TEST_INVITATION_ID, TEST_USER_ID, TEST_EMAIL)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });
  });

  describe('decline', () => {
    it('declines invitation successfully', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);
      prismaMock.invitation.update.mockResolvedValue({
        ...invitation,
        status: InvitationStatus.declined,
      });

      await service.decline(TEST_INVITATION_ID, TEST_EMAIL);

      expect(prismaMock.invitation.update).toHaveBeenCalledWith({
        where: { id: TEST_INVITATION_ID },
        data: {
          status: InvitationStatus.declined,
          respondedAt: expect.any(Date),
        },
      });
    });

    it('throws error when invitation not found', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue(null);

      await expect(service.decline(TEST_INVITATION_ID, TEST_EMAIL)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('list', () => {
    it('lists invitations with pagination', async () => {
      const invitations = [
        {
          id: TEST_INVITATION_ID,
          accountId: TEST_ACCOUNT_ID,
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'all',
          websiteIds: [],
          status: InvitationStatus.pending,
          invitedBy: TEST_USER_ID,
          emailStatus: EmailDeliveryStatus.sent,
          emailSentAt: new Date(),
          expiresAt: new Date(),
          respondedAt: null,
          createdAt: new Date(),
          account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
        },
      ];

      prismaMock.invitation.findMany.mockResolvedValue(invitations);
      prismaMock.invitation.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([
        { id: TEST_USER_ID, name: 'Test User', email: 'inviter@example.com' },
      ]);
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.list(TEST_ACCOUNT_ID, { limit: 10, offset: 0 });

      expect(result.invitations).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by status', async () => {
      prismaMock.invitation.findMany.mockResolvedValue([]);
      prismaMock.invitation.count.mockResolvedValue(0);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.website.findMany.mockResolvedValue([]);

      await service.list(TEST_ACCOUNT_ID, { status: [InvitationStatus.pending] });

      expect(prismaMock.invitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [InvitationStatus.pending] },
          }),
        })
      );
    });
  });

  describe('getByToken', () => {
    it('returns invitation with account details', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        expiresAt: new Date(),
        respondedAt: null,
        createdAt: new Date(),
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });
      prismaMock.website.findMany.mockResolvedValue([]);

      const result = await service.getByToken('test-token');

      expect(result).toBeDefined();
      expect(result?.invitation.email).toBe(TEST_EMAIL);
      expect(result?.account.name).toBe('Test Account');
    });

    it('returns null when token not found', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue(null);

      const result = await service.getByToken('invalid-token');

      expect(result).toBeNull();
    });

    it('throws an explicit error for invalid stored roles', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue({
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: 'legacy-admin',
        websiteAccess: 'all',
        websiteIds: [],
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        expiresAt: new Date(),
        respondedAt: null,
        createdAt: new Date(),
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getByToken('test-token')).rejects.toMatchObject({
        code: 'INVALID_ACCOUNT_ROLE',
      });
    });
  });

  describe('markExpired', () => {
    it('marks expired invitations', async () => {
      prismaMock.invitation.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markExpired();

      expect(result).toBe(5);
      expect(prismaMock.invitation.updateMany).toHaveBeenCalledWith({
        where: {
          status: InvitationStatus.pending,
          expiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: InvitationStatus.expired,
        },
      });
    });
  });

  describe('updateEmailStatus', () => {
    it('updates email status to sent', async () => {
      prismaMock.invitation.update.mockResolvedValue({});

      await service.updateEmailStatus(TEST_INVITATION_ID, EmailDeliveryStatus.sent);

      expect(prismaMock.invitation.update).toHaveBeenCalledWith({
        where: { id: TEST_INVITATION_ID },
        data: {
          emailStatus: EmailDeliveryStatus.sent,
          emailSentAt: expect.any(Date),
          emailError: undefined,
        },
      });
    });

    it('updates email status to failed with error', async () => {
      prismaMock.invitation.update.mockResolvedValue({});

      await service.updateEmailStatus(TEST_INVITATION_ID, EmailDeliveryStatus.failed, 'SMTP error');

      expect(prismaMock.invitation.update).toHaveBeenCalledWith({
        where: { id: TEST_INVITATION_ID },
        data: {
          emailStatus: EmailDeliveryStatus.failed,
          emailSentAt: undefined,
          emailError: 'SMTP error',
        },
      });
    });
  });

  describe('audit logging integration', () => {
    it('logs invitation creation to audit', async () => {
      const createdInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        token: 'test-token',
        status: InvitationStatus.pending,
        emailStatus: EmailDeliveryStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        respondedAt: null,
        emailSentAt: null,
        emailError: null,
      };

      prismaMock.accountMembership.findFirst.mockResolvedValue(null);
      prismaMock.invitation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdInvitation);
      prismaMock.invitation.create.mockResolvedValue(createdInvitation);
      prismaMock.user.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        name: 'Test User',
        email: 'inviter@example.com',
      });
      prismaMock.website.findMany.mockResolvedValue([]);

      await service.create(TEST_ACCOUNT_ID, TEST_USER_ID, {
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
      });

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_USER_ID,
          action: 'invitation_created',
          targetType: 'invitation',
          targetId: TEST_INVITATION_ID,
        })
      );
    });

    it('logs invitation acceptance to audit', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        account: { id: TEST_ACCOUNT_ID, name: 'Test Account' },
      };

      prismaMock.invitation.findUnique.mockResolvedValue(invitation);
      prismaMock.website.findMany.mockResolvedValue([]);
      prismaMock.accountMembership.create.mockResolvedValue({
        id: 'membership-123',
        accountId: TEST_ACCOUNT_ID,
        userId: TEST_USER_ID,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        invitedBy: TEST_USER_ID,
        joinedAt: new Date(),
        createdAt: new Date(),
      });
      prismaMock.invitation.update.mockResolvedValue({
        ...invitation,
        status: InvitationStatus.accepted,
      });

      await service.accept(TEST_INVITATION_ID, TEST_USER_ID, TEST_EMAIL);

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_USER_ID,
          action: 'invitation_accepted',
          targetType: 'invitation',
          targetId: TEST_INVITATION_ID,
        })
      );
    });

    it('logs invitation revocation to audit', async () => {
      const existingInvitation = {
        id: TEST_INVITATION_ID,
        accountId: TEST_ACCOUNT_ID,
        email: TEST_EMAIL,
        status: InvitationStatus.pending,
        invitedBy: TEST_USER_ID,
      };

      prismaMock.invitation.findFirst.mockResolvedValue(existingInvitation);
      prismaMock.invitation.update.mockResolvedValue({
        ...existingInvitation,
        status: InvitationStatus.revoked,
        respondedAt: new Date(),
      });

      await service.revoke(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID);

      // Verify audit log was called via AuditService
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          actorId: TEST_USER_ID,
          action: AuditAction.invitation_revoked,
          targetType: 'invitation',
          targetId: TEST_INVITATION_ID,
        })
      );
    });
  });
});
