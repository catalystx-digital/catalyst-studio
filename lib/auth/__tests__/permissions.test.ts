/**
 * Permissions Module Unit Tests
 */

import { AccountRole } from '@/lib/generated/prisma';
import {
  Permission,
  ROLE_PERMISSIONS,
  roleHasPermission,
  getPermissionsForRole,
  isWebsitePermission,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
} from '../permissions';

describe('ROLE_PERMISSIONS', () => {
  describe('admin role', () => {
    it('has all account permissions', () => {
      const adminPermissions = ROLE_PERMISSIONS[AccountRole.admin];

      expect(adminPermissions).toContain('account:view');
      expect(adminPermissions).toContain('account:manage_members');
      expect(adminPermissions).toContain('account:manage_settings');
    });

    it('has all website permissions', () => {
      const adminPermissions = ROLE_PERMISSIONS[AccountRole.admin];

      expect(adminPermissions).toContain('website:list');
      expect(adminPermissions).toContain('website:view');
      expect(adminPermissions).toContain('website:edit');
      expect(adminPermissions).toContain('website:manage_settings');
      expect(adminPermissions).toContain('website:deploy');
      expect(adminPermissions).toContain('website:delete');
    });
  });

  describe('member role', () => {
    it('has limited account permissions', () => {
      const memberPermissions = ROLE_PERMISSIONS[AccountRole.member];

      expect(memberPermissions).toContain('account:view');
      expect(memberPermissions).not.toContain('account:manage_members');
      expect(memberPermissions).not.toContain('account:manage_settings');
    });

    it('has limited website permissions', () => {
      const memberPermissions = ROLE_PERMISSIONS[AccountRole.member];

      expect(memberPermissions).toContain('website:list');
      expect(memberPermissions).toContain('website:view');
      expect(memberPermissions).toContain('website:edit');
      expect(memberPermissions).toContain('website:deploy');
      expect(memberPermissions).not.toContain('website:manage_settings');
      expect(memberPermissions).not.toContain('website:delete');
    });
  });
});

describe('roleHasPermission', () => {
  it('returns true when admin has permission', () => {
    expect(roleHasPermission(AccountRole.admin, 'account:manage_members')).toBe(true);
    expect(roleHasPermission(AccountRole.admin, 'website:delete')).toBe(true);
  });

  it('returns false when member lacks permission', () => {
    expect(roleHasPermission(AccountRole.member, 'account:manage_members')).toBe(false);
    expect(roleHasPermission(AccountRole.member, 'website:delete')).toBe(false);
  });

  it('returns true when member has permission', () => {
    expect(roleHasPermission(AccountRole.member, 'account:view')).toBe(true);
    expect(roleHasPermission(AccountRole.member, 'website:edit')).toBe(true);
  });
});

describe('getPermissionsForRole', () => {
  it('returns all permissions for admin', () => {
    const permissions = getPermissionsForRole(AccountRole.admin);

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions).toContain('account:manage_members');
    expect(permissions).toContain('website:delete');
  });

  it('returns limited permissions for member', () => {
    const permissions = getPermissionsForRole(AccountRole.member);

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions).not.toContain('account:manage_members');
    expect(permissions).not.toContain('website:delete');
  });
});

describe('isWebsitePermission', () => {
  it('returns true for website permissions', () => {
    expect(isWebsitePermission('website:view')).toBe(true);
    expect(isWebsitePermission('website:edit')).toBe(true);
    expect(isWebsitePermission('website:delete')).toBe(true);
  });

  it('returns false for account permissions', () => {
    expect(isWebsitePermission('account:view')).toBe(false);
    expect(isWebsitePermission('account:manage_members')).toBe(false);
  });
});

describe('ROLE_DISPLAY_NAMES', () => {
  it('has display names for all roles', () => {
    expect(ROLE_DISPLAY_NAMES[AccountRole.admin]).toBe('Administrator');
    expect(ROLE_DISPLAY_NAMES[AccountRole.member]).toBe('Team Member');
  });
});

describe('ROLE_DESCRIPTIONS', () => {
  it('has descriptions for all roles', () => {
    expect(ROLE_DESCRIPTIONS[AccountRole.admin]).toContain('Full access');
    expect(ROLE_DESCRIPTIONS[AccountRole.member]).toContain('assigned websites');
  });
});
