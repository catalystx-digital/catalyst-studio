/**
 * Invitation API Integration Tests
 *
 * Tests the invitation API routes that require admin authentication.
 */

import { NextRequest } from 'next/server';

import { ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContext } from '@/lib/auth/authorization';
import { InvitationStatus, EmailDeliveryStatus } from '@/lib/generated/prisma';
import { AccountRole } from '@/lib/auth/account';

import { GET, POST } from '../route';
import { GET as GET_BY_ID } from '../[id]/route';
import { POST as REVOKE } from '../[id]/revoke/route';

// Mock auth context
jest.mock('@/lib/auth/authorization', () => ({
  getAuthorizedContext: jest.fn(),
  requireAdmin: jest.fn((context) => {
    if (context.role !== 'admin') {
      throw ErrorHandlers.forbidden('Admin access required');
    }
  }),
}));

// Mock Prisma for email/account lookup
jest.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock email service and templates
jest.mock('@/lib/email/send-email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/email/templates/invitation', () => ({
  generateInvitationEmail: jest.fn().mockReturnValue('<html>Email</html>'),
  getRoleDisplayName: jest.fn().mockReturnValue('Team Member'),
}));

// Mock service
const mockService = {
  create: jest.fn(),
  list: jest.fn(),
  getById: jest.fn(),
  getByToken: jest.fn(),
  resend: jest.fn(),
  revoke: jest.fn(),
  accept: jest.fn(),
  decline: jest.fn(),
  updateEmailStatus: jest.fn(),
};

jest.mock('@/lib/studio/services/invitation-service', () => ({
  InvitationService: jest.fn(() => mockService),
}));

type MockedAuth = jest.MockedFunction<typeof getAuthorizedContext>;
const mockGetAuthorizedContext = getAuthorizedContext as MockedAuth;

const TEST_ACCOUNT_ID = 'account-123';
const TEST_USER_ID = 'user-123';
const TEST_INVITATION_ID = 'invitation-123';
const TEST_EMAIL = 'invite@example.com';

const adminAuth = {
  accountId: TEST_ACCOUNT_ID,
  userId: TEST_USER_ID,
  role: AccountRole.admin,
  websiteAccess: 'all',
  websiteIds: [],
  isSystemAdmin: false,
  isImpersonating: false,
  membershipId: 'mem-123',
};

const memberAuth = {
  ...adminAuth,
  role: AccountRole.member,
};

function createRequest(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe('Invitation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthorizedContext.mockResolvedValue(adminAuth as any);
  });

  describe('POST /api/studio/invitations', () => {
    it('creates an invitation successfully', async () => {
      const createdInvitation = {
        id: TEST_INVITATION_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        websiteNames: [],
        status: InvitationStatus.pending,
        emailStatus: EmailDeliveryStatus.pending,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        respondedAt: null,
        createdAt: new Date(),
        invitedBy: { id: TEST_USER_ID, name: 'Test User', email: 'admin@example.com' },
      };

      mockService.create.mockResolvedValue({
        invitation: createdInvitation,
        actionLink: 'http://localhost:3000/invite/accept?token=abc123',
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { prisma } = require('@/lib/prisma');
      prisma.account.findUnique.mockResolvedValue({ name: 'Test Account' });
      prisma.user.findUnique.mockResolvedValue({ name: 'Test User', email: 'admin@example.com' });

      const request = createRequest('http://localhost/api/studio/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: TEST_EMAIL,
          role: 'member',
          websiteAccess: 'all',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.data.id).toBe(TEST_INVITATION_ID);
      expect(payload.data.email).toBe(TEST_EMAIL);
      expect(payload.data.role).toBe('member');
      expect(mockService.create).toHaveBeenCalledWith(TEST_ACCOUNT_ID, TEST_USER_ID, {
        email: TEST_EMAIL,
        role: 'member',
        websiteAccess: 'all',
        websiteIds: undefined,
      });
    });

    it('returns 400 for invalid email', async () => {
      const request = createRequest('http://localhost/api/studio/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          role: 'member',
          websiteAccess: 'all',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest('http://localhost/api/studio/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: TEST_EMAIL,
          role: 'member',
          websiteAccess: 'all',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/studio/invitations', () => {
    it('lists invitations successfully', async () => {
      const invitations = [
        {
          id: TEST_INVITATION_ID,
          email: TEST_EMAIL,
          role: AccountRole.member,
          websiteAccess: 'all',
          websiteIds: [],
          websiteNames: [],
          status: InvitationStatus.pending,
          invitedBy: { id: TEST_USER_ID, name: 'Test User', email: 'admin@example.com' },
          emailStatus: EmailDeliveryStatus.sent,
          emailSentAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          respondedAt: null,
          createdAt: new Date(),
        },
      ];

      mockService.list.mockResolvedValue({
        invitations,
        total: 1,
      });

      const request = createRequest('http://localhost/api/studio/invitations');
      const response = await GET(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.invitations).toHaveLength(1);
      expect(payload.data.invitations[0].id).toBe(TEST_INVITATION_ID);
      expect(payload.data.total).toBe(1);
    });

    it('filters by status', async () => {
      mockService.list.mockResolvedValue({
        invitations: [],
        total: 0,
      });

      const request = createRequest('http://localhost/api/studio/invitations?status=pending,expired');
      await GET(request);

      expect(mockService.list).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          status: ['pending', 'expired'],
        })
      );
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest('http://localhost/api/studio/invitations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/studio/invitations/[id]', () => {
    it('returns invitation by ID', async () => {
      const invitation = {
        id: TEST_INVITATION_ID,
        email: TEST_EMAIL,
        role: AccountRole.member,
        websiteAccess: 'all',
        websiteIds: [],
        websiteNames: [],
        status: InvitationStatus.pending,
        invitedBy: { id: TEST_USER_ID, name: 'Test User', email: 'admin@example.com' },
        emailStatus: EmailDeliveryStatus.sent,
        emailSentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        respondedAt: null,
        createdAt: new Date(),
      };

      mockService.getById.mockResolvedValue(invitation);

      const request = createRequest(`http://localhost/api/studio/invitations/${TEST_INVITATION_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_INVITATION_ID }) });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.id).toBe(TEST_INVITATION_ID);
    });

    it('returns 404 when invitation not found', async () => {
      mockService.getById.mockResolvedValue(null);

      const request = createRequest(`http://localhost/api/studio/invitations/${TEST_INVITATION_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_INVITATION_ID }) });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/studio/invitations/[id]/revoke', () => {
    it('revokes invitation successfully', async () => {
      mockService.revoke.mockResolvedValue(undefined);

      const request = createRequest(`http://localhost/api/studio/invitations/${TEST_INVITATION_ID}/revoke`, {
        method: 'POST',
      });
      const response = await REVOKE(request, { params: Promise.resolve({ id: TEST_INVITATION_ID }) });

      expect(response.status).toBe(200);
      expect(mockService.revoke).toHaveBeenCalledWith(TEST_ACCOUNT_ID, TEST_INVITATION_ID, TEST_USER_ID);
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest(`http://localhost/api/studio/invitations/${TEST_INVITATION_ID}/revoke`, {
        method: 'POST',
      });
      const response = await REVOKE(request, { params: Promise.resolve({ id: TEST_INVITATION_ID }) });

      expect(response.status).toBe(403);
    });
  });
});
