import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { loadPlaywrightEnv } from './scripts/load-playwright-env';

loadPlaywrightEnv();

const AUTH_STATE_PATH =
  process.env.PLAYWRIGHT_AUTH_STATE ?? path.resolve(process.cwd(), '.playwright/.auth/unified-chat.json');
const SKIP_WEBSERVER = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';

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
    baseURL: 'http://localhost:3000',
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
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 300 * 1000,
      },
  globalSetup: './playwright.global-setup.ts',
});
