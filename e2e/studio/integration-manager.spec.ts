import { test, expect } from '@playwright/test';

test.describe('Studio Integration Manager', () => {
  test('allows adding, testing, and deleting an integration', async ({ page }) => {
    const integrations: any[] = [];

    await page.route('**/api/studio/account/integrations**', async route => {
      const request = route.request();
      const method = request.method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: integrations }),
        });
        return;
      }

      if (method === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}');
        const timestamp = new Date().toISOString();
        const secretFields = body.provider === 'optimizely' ? { clientSecret: true } : {};

        const created = {
          id: `int-${integrations.length + 1}`,
          accountId: 'acct-1',
          provider: body.provider,
          displayName: body.displayName,
          status: 'enabled',
          config: body.config,
          secretFields,
          lastTestedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        integrations.push(created);

        await route.fulfill({
          status: 201,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: created }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/api/studio/account/integrations/*', async route => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const pathSegments = url.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      const integrationId = pathSegments[pathSegments.length - (lastSegment === 'test' ? 2 : 1)];

      if (method === 'POST' && lastSegment === 'test') {
        const integration = integrations.find(item => item.id === integrationId);
        if (integration) {
          integration.lastTestedAt = new Date().toISOString();
          integration.updatedAt = integration.lastTestedAt;
        }

        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: { success: true, message: 'Test successful' } }),
        });
        return;
      }

      if (method === 'DELETE') {
        const index = integrations.findIndex(item => item.id === integrationId);
        if (index >= 0) {
          integrations.splice(index, 1);
        }

        await route.fulfill({ status: 204, body: '' });
        return;
      }

      await route.fallback();
    });

    await page.goto('/studio/settings');
    await expect(page.getByText('Integration Manager')).toBeVisible();
    await expect(page.getByText('Connect your first integration')).toBeVisible();

    await page.getByRole('button', { name: /Add Integration/i }).click();
    await expect(page.getByText(/Connect a provider/i)).toBeVisible();

    await page.getByLabelText(/Display name/i).fill('Optimizely Cloud');
    await page.getByLabelText(/Client ID/i).fill('client-123');
    await page.getByLabelText(/Client Secret/i).fill('secret-xyz');
    await page.getByRole('button', { name: /Create integration/i }).click();

    await expect(page.getByText('Optimizely Cloud')).toBeVisible();

    await page.getByRole('button', { name: /Test connection/i }).click();
    await expect(page.locator('text=Never tested')).toHaveCount(0);

    await page.getByRole('button', { name: /^Delete$/ }).click();
    await page.getByRole('button', { name: /^Delete$/ }).last().click();

    await expect(page.getByText('Connect your first integration')).toBeVisible();
  });
});
