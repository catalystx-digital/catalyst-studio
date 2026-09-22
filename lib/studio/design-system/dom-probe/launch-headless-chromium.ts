import { chromium, type Browser, type LaunchOptions } from 'playwright-core'

import { getServerlessLaunchOptions, isServerless } from './serverless-config'

export const DEFAULT_TIMEOUT_MS = 60000

export async function launchHeadlessChromium(overrides: LaunchOptions = {}): Promise<Browser> {
  const serverless = isServerless()
  const serverlessOptions = await getServerlessLaunchOptions()
  const explicitPath = !serverless && process.env.CHROMIUM_EXECUTABLE_PATH
  const options: LaunchOptions = {
    headless: true,
    timeout: DEFAULT_TIMEOUT_MS,
    ...serverlessOptions,
    ...(explicitPath ? { executablePath: explicitPath } : {}),
    ...overrides
  }
  const source = (() => {
    if (overrides.executablePath) return 'launch options'
    if (explicitPath && options.executablePath) return 'CHROMIUM_EXECUTABLE_PATH'
    if (options.executablePath) return '@sparticuz/chromium'
    return 'Playwright default'
  })()
  const path = options.executablePath ?? 'managed by Playwright (no explicit path)'
  const action = serverless
    ? 'Check that @sparticuz/chromium and its bundled binary are included in the deployment.'
    : 'Set CHROMIUM_EXECUTABLE_PATH to an installed Chromium executable, or run npx playwright-core install --with-deps --only-shell chromium.'

  try {
    return await chromium.launch(options)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Chromium launch failed (source: ${source}; path: ${path}). ${action} Cause: ${detail}`
    )
  }
}
