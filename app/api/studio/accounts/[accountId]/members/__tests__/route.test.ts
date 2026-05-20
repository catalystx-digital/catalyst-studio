/**
 * Members API Integration Tests
 */

import { NextRequest } from 'next/server';

import { ErrorHandlers } from '@/lib/api/errors';
import { getAuthorizedContext } from '@/lib/auth/authorization';
import { AccountRole } from '@/lib/generated/prisma';

// Mock prisma before importing routes
jest.mock('@/lib/prisma', () => ({
  prisma: {},
}));

import { GET } from '../route';
import { GET as GET_BY_ID, PATCH, DELETE } from '../[memberId]/route';

// Mock auth context
jest.mock('@/lib/auth/authorization', () => ({
  getAuthorizedContext: jest.fn(),
  requireAdmin: jest.fn((context) => {
    if (context.role !== 'admin') {
      throw ErrorHandlers.forbidden('Admin access required');
    }
  }),
}));

// Mock service
const mockService = {
  list: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/lib/studio/services/membership-service', () => ({
  MembershipService: jest.fn(() => mockService),
}));

type MockedAuth = jest.MockedFunction<typeof getAuthorizedContext>;
const mockGetAuthorizedContext = getAuthorizedContext as MockedAuth;

const TEST_ACCOUNT_ID = 'account-123';
const TEST_USER_ID = 'user-123';
const TEST_MEMBER_ID = 'member-456';
const TEST_WEBSITE_ID = 'website-789';

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

const baseMember = {
  id: TEST_MEMBER_ID,
  userId: 'target-user-123',
  email: 'member@example.com',
  name: 'Test Member',
  role: AccountRole.member,
  websiteAccess: 'all',
  websiteIds: [],
  websiteNames: [],
  invitedBy: { id: TEST_USER_ID, name: 'Admin', email: 'admin@example.com' },
  joinedAt: new Date(),
  createdAt: new Date(),
};

describe('Members API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthorizedContext.mockResolvedValue(adminAuth as any);
  });

  describe('GET /api/studio/accounts/[accountId]/members', () => {
    it('lists members successfully', async () => {
      mockService.list.mockResolvedValue({
        members: [baseMember],
        total: 1,
      });

      const request = createRequest(`http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members`);
      const response = await GET(request, { params: Promise.resolve({ accountId: TEST_ACCOUNT_ID }) });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.members).toHaveLength(1);
      expect(payload.data.members[0].id).toBe(TEST_MEMBER_ID);
      expect(payload.data.total).toBe(1);
    });

    it('respects pagination params', async () => {
      mockService.list.mockResolvedValue({
        members: [],
        total: 0,
      });

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members?limit=10&offset=20`
      );
      await GET(request, { params: Promise.resolve({ accountId: TEST_ACCOUNT_ID }) });

      expect(mockService.list).toHaveBeenCalledWith(TEST_ACCOUNT_ID, { limit: 10, offset: 20 });
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest(`http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members`);
      const response = await GET(request, { params: Promise.resolve({ accountId: TEST_ACCOUNT_ID }) });

      expect(response.status).toBe(403);
    });

    it('returns 403 when accessing different account', async () => {
      const request = createRequest(`http://localhost/api/studio/accounts/other-account/members`);
      const response = await GET(request, { params: Promise.resolve({ accountId: 'other-account' }) });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/studio/accounts/[accountId]/members/[memberId]', () => {
    it('returns member details successfully', async () => {
      mockService.getById.mockResolvedValue(baseMember);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.id).toBe(TEST_MEMBER_ID);
      expect(payload.data.email).toBe('member@example.com');
    });

    it('returns 404 when member not found', async () => {
      mockService.getById.mockResolvedValue(null);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/studio/accounts/[accountId]/members/[memberId]', () => {
    it('updates member role successfully', async () => {
      const updatedMember = { ...baseMember, role: AccountRole.admin };
      mockService.update.mockResolvedValue(updatedMember);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: 'admin' }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.role).toBe('admin');
      expect(mockService.update).toHaveBeenCalledWith(TEST_ACCOUNT_ID, TEST_MEMBER_ID, TEST_USER_ID, {
        role: 'admin',
        websiteAccess: undefined,
        websiteIds: undefined,
      });
    });

    it('updates website access successfully', async () => {
      const updatedMember = {
        ...baseMember,
        websiteAccess: 'specific',
        websiteIds: [TEST_WEBSITE_ID],
        websiteNames: ['Test Website'],
      };
      mockService.update.mockResolvedValue(updatedMember);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            websiteAccess: 'specific',
            websiteIds: [TEST_WEBSITE_ID],
          }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.websiteAccess).toBe('specific');
      expect(payload.data.websiteIds).toContain(TEST_WEBSITE_ID);
    });

    it('returns 400 for invalid role', async () => {
      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: 'invalid-role' }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: 'admin' }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/studio/accounts/[accountId]/members/[memberId]', () => {
    it('removes member successfully', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.data.success).toBe(true);
      expect(mockService.remove).toHaveBeenCalledWith(TEST_ACCOUNT_ID, TEST_MEMBER_ID, TEST_USER_ID);
    });

    it('returns 403 for non-admin users', async () => {
      mockGetAuthorizedContext.mockResolvedValue(memberAuth as any);

      const request = createRequest(
        `http://localhost/api/studio/accounts/${TEST_ACCOUNT_ID}/members/${TEST_MEMBER_ID}`,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ accountId: TEST_ACCOUNT_ID, memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(403);
    });

    it('returns 403 when accessing different account', async () => {
      const request = createRequest(
        `http://localhost/api/studio/accounts/other-account/members/${TEST_MEMBER_ID}`,
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ accountId: 'other-account', memberId: TEST_MEMBER_ID }),
      });

      expect(response.status).toBe(403);
    });
  });
});
