/**
 * Server-safe environment utilities for CMS components.
 * These functions can be called from both server and client components.
 */

/**
 * Check if we should show development-only empty states (server-safe version).
 * Returns false in production to prevent placeholder messages from appearing on exported sites.
 *
 * This function only checks environment variables and is safe to call from server components.
 * For client components that need additional DOM-based checks, use the version in alert.tsx.
 */
export function shouldShowDevEmptyStateServer(): boolean {
  // Primary check: NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Secondary check: explicit export build flag
  if (process.env.NEXT_PUBLIC_EXPORT_BUILD === 'true') {
    return false;
  }

  return true;
}
