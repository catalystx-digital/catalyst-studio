'use client';

/**
 * usePermissions Hook
 *
 * Client-side hook for permission checking based on user's role.
 * Fetches role information from the server and computes permissions.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, useUser } from '@/lib/auth/hooks';
import {
  Permission,
  ROLE_PERMISSIONS,
  ROLE_CAPABILITIES,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
} from '@/lib/auth/permissions';
import { AccountRoleType, AccountRole } from '@/lib/auth/account';

// =============================================================================
// Types
// =============================================================================

export interface UserPermissionInfo {
  role: AccountRoleType;
  permissions: Permission[];
  websiteAccess: 'all' | 'specific';
  websiteIds: string[];
}

export interface UsePermissionsReturn {
  /** Whether permission data is loading */
  isLoading: boolean;
  /** Error if permission fetch failed */
  error: string | null;
  /** User's role */
  role: AccountRoleType | null;
  /** All permissions for the user's role */
  permissions: Permission[];
  /** Check if user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if user has ANY of the given permissions */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Check if user has ALL of the given permissions */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Check if user is admin or owner */
  isAdmin: boolean;
  /** Check if user is a member (editor) */
  isEditor: boolean;
  /** Check if user is the owner */
  isOwner: boolean;
  /** Get role display name */
  roleDisplayName: string;
  /** Get role description */
  roleDescription: string;
  /** Get role capabilities */
  roleCapabilities: { capabilities: string[]; restrictions?: string[] } | null;
  /** Refetch permissions from server */
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePermissions(): UsePermissionsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionInfo, setPermissionInfo] = useState<UserPermissionInfo | null>(null);
  const user = useUser();
  const session = useSession();

  // Fetch user's role and permissions from the server
  const fetchPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!user) {
        setPermissionInfo(null);
        setIsLoading(false);
        return;
      }

      // Fetch membership info from API
      const accountId = session?.activeAccountId ?? user.id;
      const res = await fetch(`/api/studio/accounts/${accountId}/members/me`);

      if (!res.ok) {
        // If 404, user might not have a membership yet - default to admin for owner account
        if (res.status === 404) {
          setPermissionInfo({
            role: AccountRole.admin,
            permissions: ROLE_PERMISSIONS[AccountRole.admin],
            websiteAccess: 'all',
            websiteIds: [],
          });
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to load permissions');
      }

      const data = await res.json();
      const membership = data.data;

      setPermissionInfo({
        role: membership.role as AccountRoleType,
        permissions: ROLE_PERMISSIONS[membership.role as AccountRoleType] || [],
        websiteAccess: membership.websiteAccess || 'all',
        websiteIds: membership.websiteIds || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
      // Default to member permissions on error for safety
      setPermissionInfo({
        role: AccountRole.member,
        permissions: ROLE_PERMISSIONS[AccountRole.member],
        websiteAccess: 'all',
        websiteIds: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [session?.activeAccountId, user]);

  // Fetch on mount
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Computed values
  const role = permissionInfo?.role ?? null;
  const permissions = permissionInfo?.permissions ?? [];

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return permissions.includes(permission);
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      return perms.some((p) => permissions.includes(p));
    },
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      return perms.every((p) => permissions.includes(p));
    },
    [permissions]
  );

  const isAdmin = role === AccountRole.admin || role === AccountRole.owner;
  const isEditor = role === AccountRole.member;
  const isOwner = role === AccountRole.owner;

  const roleDisplayName = role ? ROLE_DISPLAY_NAMES[role] : '';
  const roleDescription = role ? ROLE_DESCRIPTIONS[role] : '';
  const roleCapabilities = role ? ROLE_CAPABILITIES[role] : null;

  return {
    isLoading,
    error,
    role,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isEditor,
    isOwner,
    roleDisplayName,
    roleDescription,
    roleCapabilities,
    refresh: fetchPermissions,
  };
}

// =============================================================================
// Utility Hook - Check Single Permission
// =============================================================================

/**
 * Simple hook to check a single permission
 * Useful for conditional rendering
 */
export function useHasPermission(permission: Permission): { allowed: boolean; isLoading: boolean } {
  const { hasPermission, isLoading } = usePermissions();
  return {
    allowed: hasPermission(permission),
    isLoading,
  };
}

// =============================================================================
// Utility Hook - Check if Admin
// =============================================================================

/**
 * Simple hook to check if user is admin
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { isAdmin, isLoading } = usePermissions();
  return { isAdmin, isLoading };
}
