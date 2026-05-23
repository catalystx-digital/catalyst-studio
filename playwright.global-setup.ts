import fs from 'fs';
import path from 'path';
import { FullConfig, request } from '@playwright/test';
import { loadPlaywrightEnv } from './scripts/load-playwright-env';
import { AUTH_SESSION_COOKIE } from './lib/auth/constants';

loadPlaywrightEnv();

const AUTH_STATE_PATH =
  process.env.PLAYWRIGHT_AUTH_STATE ?? path.resolve(process.cwd(), '.playwright/.auth/unified-chat.json');
const APP_BASE_URL = process.env.PLAYWRIGHT_APP_BASE_URL ?? 'http://localhost:4300';
const PLAYWRIGHT_TARGET_TOKEN = process.env.PLAYWRIGHT_TARGET_TOKEN;
const PLAYWRIGHT_TARGET_HEADER = 'x-catalyst-playwright-target';
const TEST_EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL ?? 'unified-chat-e2e@example.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD ?? 'UnifiedChat!234';

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const authRequest = await request.newContext({
    baseURL: APP_BASE_URL,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });

  try {
    if (PLAYWRIGHT_TARGET_TOKEN) {
      const targetResponse = await authRequest.get('/', { failOnStatusCode: false });
      const actualToken = targetResponse.headers()[PLAYWRIGHT_TARGET_HEADER];

      if (actualToken !== PLAYWRIGHT_TARGET_TOKEN) {
        throw new Error(
          [
            `Playwright target validation failed for ${APP_BASE_URL}.`,
            `Expected ${PLAYWRIGHT_TARGET_HEADER} to match this test run, received ${actualToken ? '<present but different>' : '<missing>'}.`,
            'Start the app through Playwright, or set PLAYWRIGHT_TARGET_TOKEN on the explicitly reused server.',
          ].join(' '),
        );
      }
    }

    let response = await authRequest.post('/api/auth/sign-in', {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
      failOnStatusCode: false,
    });

    if (response.status() === 401) {
      response = await authRequest.post('/api/auth/sign-up', {
        data: {
          name: 'Unified Chat Tester',
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        },
        failOnStatusCode: false,
      });
    }

    if (!response.ok()) {
      throw new Error(`Failed to create app auth session (${response.status()}): ${await response.text()}`);
    }

    await authRequest.storageState({ path: AUTH_STATE_PATH });
    const authState = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf8')) as {
      cookies?: Array<{ name?: string; value?: string; domain?: string }>;
      origins?: unknown[];
    };
    const appHostname = new URL(APP_BASE_URL).hostname;
    const hasSessionCookie = authState.cookies?.some((cookie) =>
      cookie.name === AUTH_SESSION_COOKIE
      && typeof cookie.value === 'string'
      && Boolean(cookie.value)
      && typeof cookie.domain === 'string'
      && (cookie.domain === appHostname || cookie.domain === `.${appHostname}`)
    );
    if (!hasSessionCookie) {
      throw new Error(`Playwright auth setup did not write ${AUTH_SESSION_COOKIE} for ${appHostname} to ${AUTH_STATE_PATH}.`);
    }
  } finally {
    await authRequest.dispose();
  }
}
