import fs from 'fs';
import path from 'path';
import { FullConfig, request } from '@playwright/test';
import { loadPlaywrightEnv } from './scripts/load-playwright-env';

loadPlaywrightEnv();

const AUTH_STATE_PATH =
  process.env.PLAYWRIGHT_AUTH_STATE ?? path.resolve(process.cwd(), '.playwright/.auth/unified-chat.json');
const APP_BASE_URL = process.env.PLAYWRIGHT_APP_BASE_URL ?? 'http://localhost:3000';
const TEST_EMAIL = process.env.PLAYWRIGHT_AUTH_EMAIL ?? 'unified-chat-e2e@example.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_AUTH_PASSWORD ?? 'UnifiedChat!234';

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const authRequest = await request.newContext({
    baseURL: APP_BASE_URL,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });

  try {
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
  } finally {
    await authRequest.dispose();
  }
}
