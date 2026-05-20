/**
 * RBAC Permission System
 *
 * Defines permissions, role mappings, and authorization utilities.
 */

import { AccountRole, type AccountRoleType } from './account';

// =============================================================================
// Permission Types
// =============================================================================

export type Permission =
  // Account-level permissions
  | 'account:view' // View account dashboard, basic info
  | 'account:manage_members' // Invite, remove, change roles
  | 'account:manage_settings' // Account settings, integrations
  | 'account:delete' // Delete entire account (future)

  // Website-level permissions
  | 'website:list' // See websites in sidebar
  | 'website:view' // View website content
  | 'website:edit' // Edit pages, components
  | 'website:manage_settings' // Website settings, design system
  | 'website:deploy' // Deploy to hosting provider
  | 'website:delete' // Delete website

  // Content Type permissions
  | 'content_type:list' // List content types
  | 'content_type:view' // View content type details
  | 'content_type:create' // Create new content types
  | 'content_type:edit' // Edit content type fields/settings
  | 'content_type:delete' // Delete content types (with cascade)

  // Content permissions (pages, custom content)
  | 'content:list' // List content items
  | 'content:view' // View content item details
  | 'content:create' // Create new content items
  | 'content:edit' // Edit content items
  | 'content:delete'; // Delete content items

// =============================================================================
// Role → Permission Mapping
// =============================================================================

export const ROLE_PERMISSIONS: Record<AccountRoleType, Permission[]> = {
  [AccountRole.owner]: [
    // Account permissions (all)
    'account:view',
    'account:manage_members',
    'account:manage_settings',
    'account:delete',

    // Website permissions (all)
    'website:list',
    'website:view',
    'website:edit',
    'website:manage_settings',
    'website:deploy',
    'website:delete',

    // Content Type permissions (all)
    'content_type:list',
    'content_type:view',
    'content_type:create',
    'content_type:edit',
    'content_type:delete',

    // Content permissions (all)
    'content:list',
    'content:view',
    'content:create',
    'content:edit',
    'content:delete',
  ],

  [AccountRole.admin]: [
    // Account permissions
    'account:view',
    'account:manage_members',
    'account:manage_settings',

    // Website permissions (all websites)
    'website:list',
    'website:view',
    'website:edit',
    'website:manage_settings',
    'website:deploy',
    'website:delete',

    // Content Type permissions (FULL ACCESS)
    'content_type:list',
    'content_type:view',
    'content_type:create',
    'content_type:edit',
    'content_type:delete',

    // Content permissions (FULL ACCESS)
    'content:list',
    'content:view',
    'content:create',
    'content:edit',
    'content:delete',
  ],

  [AccountRole.member]: [
    // Account permissions (VIEW ONLY)
    'account:view',

    // Website permissions (scoped by websiteAccess)
    'website:list', // Filtered to accessible websites
    'website:view',
    'website:edit',
    'website:deploy',
    // No: manage_settings, delete

    // Content Type permissions (READ ONLY)
    'content_type:list',
    'content_type:view',
    // No: content_type:create, content_type:edit, content_type:delete

    // Content permissions (FULL ACCESS)
    'content:list',
    'content:view',
    'content:create',
    'content:edit',
    'content:delete',
  ],
};

// =============================================================================
// Website Access Types
// =============================================================================

export type WebsiteAccessType = 'all' | 'specific';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AccountRoleType, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: AccountRoleType): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if permission is website-scoped (requires website context)
 */
export function isWebsitePermission(permission: Permission): boolean {
  return permission.startsWith('website:');
}

/**
 * Check if permission is content-type-scoped
 */
export function isContentTypePermission(permission: Permission): boolean {
  return permission.startsWith('content_type:');
}

/**
 * Check if permission is content-scoped
 */
export function isContentPermission(permission: Permission): boolean {
  return permission.startsWith('content:');
}

/**
 * Human-readable role names for display
 */
export const ROLE_DISPLAY_NAMES: Record<AccountRoleType, string> = {
  [AccountRole.owner]: 'Owner',
  [AccountRole.admin]: 'Administrator',
  [AccountRole.member]: 'Team Member',
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<AccountRoleType, string> = {
  [AccountRole.owner]: 'Full access to all features including account deletion. Can manage everything.',
  [AccountRole.admin]: 'Full access to content types, content, settings, and team management.',
  [AccountRole.member]: 'Can create and edit content only. Cannot modify content types or settings.',
};

/**
 * Detailed role capabilities for UI (used in role selection dialogs)
 */
export const ROLE_CAPABILITIES: Record<AccountRoleType, { capabilities: string[]; restrictions?: string[] }> = {
  [AccountRole.owner]: {
    capabilities: [
      'Create, edit, and delete content types',
      'Create, edit, and delete all content',
      'Manage website settings',
      'Invite and manage team members',
      'Deploy websites',
      'Delete account',
    ],
  },
  [AccountRole.admin]: {
    capabilities: [
      'Create, edit, and delete content types',
      'Create, edit, and delete all content',
      'Manage website settings',
      'Invite and manage team members',
      'Deploy websites',
    ],
  },
  [AccountRole.member]: {
    capabilities: [
      'View content types (read-only)',
      'Create, edit, and delete content',
      'Deploy websites',
    ],
    restrictions: [
      'Cannot create, edit, or delete content types',
      'Cannot manage website settings',
      'Cannot invite or manage team members',
    ],
  },
};
