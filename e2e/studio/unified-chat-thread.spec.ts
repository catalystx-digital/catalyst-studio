import { test, expect } from '@playwright/test';

const APP_BASE_URL = process.env.PLAYWRIGHT_APP_BASE_URL ?? 'http://localhost:4300';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? APP_BASE_URL;

test.describe('Unified chat thread continuity', () => {
  test('dashboard prompt appears inside builder assistant history', async ({ page, request }) => {
    const headerPayload = process.env.PLAYWRIGHT_AUTH_HEADER_USER ?? null;
    const encodedUser = headerPayload ? encodeURIComponent(headerPayload) : null;
    const authHeaders = encodedUser ? { 'x-catalyst-user': encodedUser } : undefined;

    if (encodedUser) {
      await page.setExtraHTTPHeaders({ 'x-catalyst-user': encodedUser });
    }

    const websiteResponse = await request.post(`${API_BASE_URL}/api/websites`, {
      data: {
        name: 'Unified Chat Flow',
        description: 'Verifies dashboard prompt continuity',
        category: 'testing',
      },
      headers: authHeaders,
    });

    expect(websiteResponse.ok()).toBeTruthy();
    const websitePayload = await websiteResponse.json();
    const websiteId = websitePayload.data.id as string;
    const accountId = websitePayload.data.accountId as string;
    expect(typeof accountId).toBe('string');
    expect(accountId).toBeTruthy();
    const builderSessionId = `studio-site-builder-assistant-${websiteId}`;
    const dashboardSessionId = `dashboard-${accountId}`;
    const prompt = `Dashboard continuity prompt ${Date.now()}`;

    try {
      const logResponse = await request.post(`${API_BASE_URL}/api/chat/log`, {
        data: {
          sessionId: dashboardSessionId,
          scope: 'account',
          idempotencyKey: `${dashboardSessionId}:${Date.now()}`,
          message: {
            content: prompt,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            source: 'e2e',
            scopeLabel: 'Dashboard Prompt',
          },
        },
        headers: authHeaders,
      });
      expect(logResponse.ok()).toBeTruthy();

      const adoptResponse = await request.post(`${API_BASE_URL}/api/ai-context/adopt`, {
        data: {
          sourceSessionId: dashboardSessionId,
          targetSessionId: builderSessionId,
          websiteId,
        },
        headers: authHeaders,
      });
      expect(adoptResponse.ok()).toBeTruthy();

      const contextResponse = await request.get(
        `${API_BASE_URL}/api/ai-context/${builderSessionId}?websiteId=${websiteId}`,
        { headers: authHeaders },
      );
      expect(contextResponse.ok()).toBeTruthy();
      const contextPayload = await contextResponse.json();
      const messages = contextPayload.data?.messages ?? [];
      const latestUserMessage = messages.find(
        (message: { role?: string; content?: string }) => message.role === 'user' && message.content?.includes(prompt),
      );
      expect(
        latestUserMessage,
        'builder assistant context should contain the dashboard prompt after adoption',
      ).toBeTruthy();

      await page.goto(`${APP_BASE_URL}/studio/site-builder?websiteId=${websiteId}`, { waitUntil: 'networkidle' });
      await page.waitForLoadState('networkidle');

      const chatHeader = page.getByRole('heading', { name: /AI Assistant/i }).first();
      await expect(chatHeader).toBeVisible({ timeout: 20000 });

      const recordedMessage = page.getByText(prompt, { exact: false });
      await expect(recordedMessage).toBeVisible({ timeout: 20000 });
    } finally {
      await request.delete(`${API_BASE_URL}/api/websites/${websiteId}`, {
        failOnStatusCode: false,
        headers: authHeaders,
      });
    }
  });
});
