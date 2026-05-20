/**
 * Invitation Email Template
 *
 * HTML template for account invitations using Catalyst Studio brand.
 */

import { formatEmailDate } from '../send-email';

// =============================================================================
// Catalyst Studio Brand Colors
// =============================================================================

const BRAND = {
  // Primary
  orange: '#FF5500',
  orangeHover: '#FF6622',
  // Text colors (for light email background)
  textPrimary: '#1a1a1a',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  // Background
  backgroundLight: '#ffffff',
  backgroundSurface: '#f9fafb',
  // Border
  border: '#e5e7eb',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface InvitationEmailData {
  accountName: string;
  inviterName: string;
  inviterEmail: string;
  roleName: string;
  websiteNames?: string[];
  actionLink: string;
  declineLink: string;
  expiresAt: Date;
}

// =============================================================================
// Template
// =============================================================================

export function generateInvitationEmail(data: InvitationEmailData): string {
  const {
    accountName,
    inviterName,
    inviterEmail,
    roleName,
    websiteNames,
    actionLink,
    declineLink,
    expiresAt,
  } = data;

  const logoUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`
    : 'https://app.catalyst.studio/logo.png';

  const websiteSection = websiteNames?.length
    ? `
      <p style="margin-bottom: 20px; color: ${BRAND.textSecondary};">
        You'll have access to the following websites:
      </p>
      <ul style="margin-bottom: 20px; color: ${BRAND.textSecondary};">
        ${websiteNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('\n')}
      </ul>
    `
    : `
      <p style="margin-bottom: 20px; color: ${BRAND.textSecondary};">
        You'll have access to all websites in this account.
      </p>
    `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ${escapeHtml(accountName)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${BRAND.textPrimary}; background-color: ${BRAND.backgroundSurface}; margin: 0; padding: 40px 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: ${BRAND.backgroundLight}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="padding: 30px 40px; border-bottom: 1px solid ${BRAND.border};">
      <img src="${logoUrl}" alt="Catalyst Studio" style="height: 32px;">
    </div>

    <!-- Content -->
    <div style="padding: 40px;">
      <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 20px 0; color: ${BRAND.textPrimary};">
        You've been invited to join ${escapeHtml(accountName)}
      </h1>

      <p style="margin-bottom: 20px; color: ${BRAND.textSecondary};">
        <strong style="color: ${BRAND.textPrimary};">${escapeHtml(inviterName)}</strong> (${escapeHtml(inviterEmail)}) has invited you to collaborate on <strong style="color: ${BRAND.textPrimary};">${escapeHtml(accountName)}</strong> as a <strong style="color: ${BRAND.orange};">${escapeHtml(roleName)}</strong>.
      </p>

      ${websiteSection}

      <div style="text-align: center; margin: 32px 0;">
        <a href="${actionLink}" style="display: inline-block; background-color: ${BRAND.orange}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>

      <p style="color: ${BRAND.textMuted}; font-size: 14px; margin-bottom: 8px;">
        This invitation expires on <strong>${formatEmailDate(expiresAt)}</strong>.
      </p>

      <p style="color: ${BRAND.textMuted}; font-size: 14px;">
        If you don't want to join, you can ignore this email or
        <a href="${declineLink}" style="color: ${BRAND.orange}; text-decoration: underline;">decline the invitation</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 40px; background-color: ${BRAND.backgroundSurface}; border-top: 1px solid ${BRAND.border}; border-radius: 0 0 8px 8px;">
      <p style="color: ${BRAND.textMuted}; font-size: 12px; text-align: center; margin: 0;">
        This email was sent by <a href="https://catalyst.studio" style="color: ${BRAND.orange}; text-decoration: none;">Catalyst Studio</a> on behalf of ${escapeHtml(accountName)}.
        <br>
        If you didn't expect this invitation, you can safely ignore it.
      </p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

// =============================================================================
// Helpers
// =============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    admin: 'Administrator',
    member: 'Team Member',
  };
  return names[role] ?? role;
}
