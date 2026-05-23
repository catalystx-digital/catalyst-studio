import { test, expect } from '@playwright/test';

test.describe('App Routing', () => {
  test('authenticated root redirects to dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForURL('/dashboard', { timeout: 30000 });
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('App Routing - unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('root shows the public marketing page', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Catalyst Studio').first()).toBeVisible();
  });

  test('dashboard shows the public dashboard shell', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Please sign in to view your websites.')).toBeVisible();
  });

  test('guarded routes redirect to sign-in with redirect_url', async ({ page }) => {
    await page.goto('/studio/site-builder?websiteId=test-site', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/sign-in?**', { timeout: 30000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('redirect_url')).toBe('/studio/site-builder?websiteId=test-site');
  });
});
