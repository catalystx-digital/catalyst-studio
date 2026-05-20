/**
 * Authorization Module Unit Tests
 */

// Mock prisma before importing authorization module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    impersonationSession: { findFirst: jest.fn() },
    accountMembership: { findUnique: jest.fn() },
    memberWebsiteAccess: { findMany: jest.fn() },
  },
}));

import { AccountRole } from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';
import {
  AuthorizedContext,
  assertPermission,
  canAccessWebsite,
  getAccessibleWebsiteFilter,
  getAccessibleWebsiteIds,
  hasPermission,
  requireAdmin,
  isAdmin,
} from '../authorization';

// Test helper to create mock context
function createMockContext(overrides: Partial<AuthorizedContext> = {}): AuthorizedContext {
  return {
    accountId: 'test-account-id',
    userId: 'test-user-id',
    role: AccountRole.member,
    websiteAccess: 'all',
    websiteIds: [],
    isSystemAdmin: false,
    isImpersonating: false,
    membershipId: 'test-membership-id',
    ...overrides,
  };
}

describe('assertPermission', () => {
  it('does not throw for admin with any permission', async () => {
    const context = createMockContext({ role: AccountRole.admin });

    await expect(assertPermission(context, 'account:manage_members')).resolves.not.toThrow();
    await expect(assertPermission(context, 'website:delete')).resolves.not.toThrow();
  });

  it('does not throw for member with allowed permission', async () => {
    const context = createMockContext({ role: AccountRole.member });

    await expect(assertPermission(context, 'account:view')).resolves.not.toThrow();
    await expect(assertPermission(context, 'website:edit')).resolves.not.toThrow();
  });

  it('throws for member without permission', async () => {
    const context = createMockContext({ role: AccountRole.member });

    await expect(assertPermission(context, 'account:manage_members')).rejects.toThrow(ApiError);
    await expect(assertPermission(context, 'website:delete')).rejects.toThrow(ApiError);
  });

  it('throws for member with specific access when accessing unauthorized website', async () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: ['website-1'],
    });

    await expect(assertPermission(context, 'website:edit', 'website-2')).rejects.toThrow(ApiError);
  });

  it('does not throw for member with specific access when accessing authorized website', async () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: ['website-1'],
    });

    await expect(assertPermission(context, 'website:edit', 'website-1')).resolves.not.toThrow();
  });
});

describe('canAccessWebsite', () => {
  describe('admin role', () => {
    it('returns true for any website', () => {
      const context = createMockContext({ role: AccountRole.admin });

      expect(canAccessWebsite(context, 'any-website-id')).toBe(true);
    });
  });

  describe('member role with all access', () => {
    it('returns true for any website', () => {
      const context = createMockContext({
        role: AccountRole.member,
        websiteAccess: 'all',
      });

      expect(canAccessWebsite(context, 'any-website-id')).toBe(true);
    });
  });

  describe('member role with specific access', () => {
    it('returns true for assigned website', () => {
      const context = createMockContext({
        role: AccountRole.member,
        websiteAccess: 'specific',
        websiteIds: ['website-1', 'website-2'],
      });

      expect(canAccessWebsite(context, 'website-1')).toBe(true);
      expect(canAccessWebsite(context, 'website-2')).toBe(true);
    });

    it('returns false for unassigned website', () => {
      const context = createMockContext({
        role: AccountRole.member,
        websiteAccess: 'specific',
        websiteIds: ['website-1'],
      });

      expect(canAccessWebsite(context, 'website-3')).toBe(false);
    });

    it('returns false when no websites assigned', () => {
      const context = createMockContext({
        role: AccountRole.member,
        websiteAccess: 'specific',
        websiteIds: [],
      });

      expect(canAccessWebsite(context, 'any-website')).toBe(false);
    });
  });
});

describe('getAccessibleWebsiteFilter', () => {
  it('returns empty object for admin', () => {
    const context = createMockContext({ role: AccountRole.admin });

    expect(getAccessibleWebsiteFilter(context)).toEqual({});
  });

  it('returns empty object for member with all access', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'all',
    });

    expect(getAccessibleWebsiteFilter(context)).toEqual({});
  });

  it('returns filter with website IDs for member with specific access', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: ['website-1', 'website-2'],
    });

    expect(getAccessibleWebsiteFilter(context)).toEqual({
      id: { in: ['website-1', 'website-2'] },
    });
  });

  it('returns filter with empty array for member with no websites', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: [],
    });

    expect(getAccessibleWebsiteFilter(context)).toEqual({
      id: { in: [] },
    });
  });
});

describe('getAccessibleWebsiteIds', () => {
  it('returns null for admin (all websites)', () => {
    const context = createMockContext({ role: AccountRole.admin });

    expect(getAccessibleWebsiteIds(context)).toBeNull();
  });

  it('returns null for member with all access', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'all',
    });

    expect(getAccessibleWebsiteIds(context)).toBeNull();
  });

  it('returns website IDs for member with specific access', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: ['website-1', 'website-2'],
    });

    expect(getAccessibleWebsiteIds(context)).toEqual(['website-1', 'website-2']);
  });
});

describe('hasPermission', () => {
  it('returns true when admin has permission', () => {
    const context = createMockContext({ role: AccountRole.admin });

    expect(hasPermission(context, 'account:manage_members')).toBe(true);
    expect(hasPermission(context, 'website:delete')).toBe(true);
  });

  it('returns false when member lacks permission', () => {
    const context = createMockContext({ role: AccountRole.member });

    expect(hasPermission(context, 'account:manage_members')).toBe(false);
    expect(hasPermission(context, 'website:delete')).toBe(false);
  });

  it('returns true when member has permission', () => {
    const context = createMockContext({ role: AccountRole.member });

    expect(hasPermission(context, 'account:view')).toBe(true);
    expect(hasPermission(context, 'website:edit')).toBe(true);
  });

  it('considers website access for website permissions', () => {
    const context = createMockContext({
      role: AccountRole.member,
      websiteAccess: 'specific',
      websiteIds: ['website-1'],
    });

    expect(hasPermission(context, 'website:edit', 'website-1')).toBe(true);
    expect(hasPermission(context, 'website:edit', 'website-2')).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('does not throw for admin role', () => {
    const context = createMockContext({ role: AccountRole.admin });

    expect(() => requireAdmin(context)).not.toThrow();
  });

  it('throws for member role', () => {
    const context = createMockContext({ role: AccountRole.member });

    expect(() => requireAdmin(context)).toThrow(ApiError);
    expect(() => requireAdmin(context)).toThrow('Admin access required');
  });
});

describe('isAdmin', () => {
  it('returns true for admin role', () => {
    const context = createMockContext({ role: AccountRole.admin });

    expect(isAdmin(context)).toBe(true);
  });

  it('returns false for member role', () => {
    const context = createMockContext({ role: AccountRole.member });

    expect(isAdmin(context)).toBe(false);
  });
});

describe('AuthorizedContext properties', () => {
  it('includes all required properties', () => {
    const context = createMockContext();

    expect(context).toHaveProperty('accountId');
    expect(context).toHaveProperty('userId');
    expect(context).toHaveProperty('role');
    expect(context).toHaveProperty('websiteAccess');
    expect(context).toHaveProperty('websiteIds');
    expect(context).toHaveProperty('isSystemAdmin');
    expect(context).toHaveProperty('isImpersonating');
    expect(context).toHaveProperty('membershipId');
  });

  it('can have optional impersonatorId', () => {
    const context = createMockContext({
      isImpersonating: true,
      impersonatorId: 'system-admin-id',
    });

    expect(context.isImpersonating).toBe(true);
    expect(context.impersonatorId).toBe('system-admin-id');
  });
});
