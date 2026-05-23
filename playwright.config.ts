import path from 'path';
import { randomBytes } from 'crypto';
import { defineConfig, devices } from '@playwright/test';
import { loadPlaywrightEnv } from './scripts/load-playwright-env';

loadPlaywrightEnv();

const AUTH_STATE_PATH =
  process.env.PLAYWRIGHT_AUTH_STATE ?? path.resolve(process.cwd(), '.playwright/.auth/unified-chat.json');
const SKIP_WEBSERVER = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';
const APP_BASE_URL = process.env.PLAYWRIGHT_APP_BASE_URL ?? 'http://localhost:4300';
const APP_PORT = new URL(APP_BASE_URL).port || '3000';
const SERVER_MODE = process.env.PLAYWRIGHT_SERVER_MODE ?? 'production';
const rawTargetToken = process.env.PLAYWRIGHT_TARGET_TOKEN ?? `catalyst-studio-playwright-${randomBytes(16).toString('hex')}`;
if (!/^[A-Za-z0-9_.:-]+$/.test(rawTargetToken)) {
  throw new Error('PLAYWRIGHT_TARGET_TOKEN may only contain letters, numbers, dots, underscores, colons, and hyphens.');
}
const PLAYWRIGHT_TARGET_TOKEN = rawTargetToken;

process.env.PLAYWRIGHT_TARGET_TOKEN = PLAYWRIGHT_TARGET_TOKEN;

const WEB_SERVER_COMMAND = SERVER_MODE === 'dev'
  ? `cross-env STUDIO_DISABLE_WORKFLOW_PLUGIN=true PLAYWRIGHT_TARGET_TOKEN=${PLAYWRIGHT_TARGET_TOKEN} PORT=${APP_PORT} npm run build:components && cross-env STUDIO_DISABLE_WORKFLOW_PLUGIN=true PLAYWRIGHT_TARGET_TOKEN=${PLAYWRIGHT_TARGET_TOKEN} PORT=${APP_PORT} next dev -p ${APP_PORT}`
  : `cross-env STUDIO_DISABLE_WORKFLOW_PLUGIN=true PLAYWRIGHT_TARGET_TOKEN=${PLAYWRIGHT_TARGET_TOKEN} npm run build:no-workflow && cross-env STUDIO_DISABLE_WORKFLOW_PLUGIN=true PLAYWRIGHT_TARGET_TOKEN=${PLAYWRIGHT_TARGET_TOKEN} PORT=${APP_PORT} next start -p ${APP_PORT}`;
const REUSE_EXISTING_SERVER = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';

/**
 * Playwright configuration for Windows local testing
 * Focused on protecting existing chat functionality during brownfield enhancement
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : '50%', // Balanced worker count to prevent resource exhaustion
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['github']
  ],
  
  // Global timeout settings
  globalTimeout: 60 * 60 * 1000, // 1 hour
  timeout: 60 * 1000, // 60 seconds per test
  
  // Expect settings
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },
  
  use: {
    baseURL: APP_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: AUTH_STATE_PATH,
    // Optimized timeout settings
    actionTimeout: 30000,
    navigationTimeout: 60000,
    // Performance optimizations (removed --disable-web-security for security)
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-networking',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports with enhanced settings */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Enhanced mobile settings
        hasTouch: true,
        isMobile: true,
        actionTimeout: 45000,
        navigationTimeout: 90000,
        // Ensure JavaScript is enabled
        javaScriptEnabled: true,
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        // Enhanced mobile settings
        hasTouch: true,
        isMobile: true,
        actionTimeout: 45000,
        navigationTimeout: 90000,
        // Ensure JavaScript is enabled
        javaScriptEnabled: true,
      },
    },
    // Add tablet testing
    {
      name: 'iPad',
      use: {
        ...devices['iPad Pro'],
        hasTouch: true,
        isMobile: true,
        actionTimeout: 45000,
        navigationTimeout: 90000,
        javaScriptEnabled: true,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: SKIP_WEBSERVER
    ? undefined
    : {
        command: WEB_SERVER_COMMAND,
        url: APP_BASE_URL,
        reuseExistingServer: REUSE_EXISTING_SERVER,
        timeout: 300 * 1000,
      },
  globalSetup: './playwright.global-setup.ts',
});
