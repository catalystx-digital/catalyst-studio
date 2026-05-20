/**
 * Email Service
 *
 * Sends transactional emails via SMTP (Gmail Enterprise).
 * Falls back to console logging in development when no SMTP credentials are configured.
 *
 * Future: Can be upgraded to Resend for email tracking capabilities.
 */

import nodemailer from 'nodemailer';

// =============================================================================
// Types
// =============================================================================

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// Configuration
// =============================================================================

function getTransporter() {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[email] SMTP credentials not configured, emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

// =============================================================================
// Send Email Function
// =============================================================================

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text } = options;

  const fromName = process.env.SMTP_FROM_NAME ?? 'Catalyst Studio';
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? 'noreply@example.com';

  const transporter = getTransporter();

  // If no transporter (no SMTP configured), log the email for development
  if (!transporter) {
    console.log('[email] Would send email:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  From: ${fromName} <${fromEmail}>`);
    console.log('  [HTML content omitted]');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text: text ?? stripHtml(html),
      html,
    });

    console.log('[email] Sent:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[email] Failed to send:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a date for display in emails
 */
export function formatEmailDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
