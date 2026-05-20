/**
 * Serverless Chromium Configuration
 *
 * This module provides the correct Chromium configuration for serverless environments
 * like Vercel/AWS Lambda where the full Playwright browser binaries are not available.
 *
 * On serverless:
 * - Uses @sparticuz/chromium which provides a compressed Chromium binary (~45MB)
 * - The binary is extracted to /tmp at runtime
 * - Must use playwright-core (not playwright) which doesn't bundle browsers
 *
 * On local development:
 * - Falls back to system-installed Chromium
 * - Playwright's bundled browsers work normally
 */

import type { LaunchOptions } from 'playwright-core'

/**
 * Detect if running in a serverless environment
 */
export function isServerless(): boolean {
  // Vercel serverless
  if (process.env.VERCEL === '1') return true
  // AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true
  // Netlify Functions
  if (process.env.NETLIFY === 'true') return true
  // Generic serverless indicator
  if (process.env.SERVERLESS === 'true') return true

  return false
}

/**
 * Get the Chromium executable path for the current environment
 *
 * In serverless: Uses @sparticuz/chromium which extracts to /tmp
 * In local dev: Returns undefined to use Playwright's default
 */
export async function getChromiumExecutablePath(): Promise<string | undefined> {
  if (!isServerless()) {
    // Local development - use Playwright's bundled Chromium
    return undefined
  }

  try {
    // Dynamic import to avoid loading in local dev
    const chromium = await import('@sparticuz/chromium')
    return await chromium.default.executablePath()
  } catch (error) {
    console.warn(
      '[DomProbe] Failed to load @sparticuz/chromium, falling back to default:',
      error instanceof Error ? error.message : error
    )
    return undefined
  }
}

/**
 * Get Chromium launch options optimized for serverless environments
 *
 * Includes:
 * - Correct executable path for serverless
 * - Memory-optimized args for Lambda/serverless
 * - Headless mode configuration
 *
 * Note: @sparticuz/chromium always runs in headless shell mode via args,
 * so we don't set the `headless` property (it's handled by the args).
 */
export async function getServerlessLaunchOptions(): Promise<Partial<LaunchOptions>> {
  if (!isServerless()) {
    // Local development - minimal config
    return {
      headless: true
    }
  }

  try {
    const chromium = await import('@sparticuz/chromium')

    // @sparticuz/chromium provides args that include headless shell mode
    // The executablePath points to the extracted Chromium binary
    return {
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      // Note: headless mode is already set via args (--headless='shell')
      // We explicitly set to true for playwright-core compatibility
      headless: true
    }
  } catch (error) {
    console.warn(
      '[DomProbe] Failed to get serverless launch options, using defaults:',
      error instanceof Error ? error.message : error
    )
    return {
      headless: true
    }
  }
}
