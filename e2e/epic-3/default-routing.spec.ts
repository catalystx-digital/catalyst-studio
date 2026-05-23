import { test, expect } from '@playwright/test';

test.describe('Default Routing With Studio Deployment', () => {
  test('authenticated root redirects to /dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForURL('/dashboard', { timeout: 30000 });
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Default Routing With Studio Deployment - unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('root remains public marketing', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Catalyst Studio').first()).toBeVisible();
  });

  test('dashboard is accessible as a public shell', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Please sign in to view your websites.')).toBeVisible();
  });

  test('studio routes require sign-in', async ({ page }) => {
    await page.goto('/studio/deployment', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/sign-in?**', { timeout: 30000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('redirect_url')).toBe('/studio/deployment');
  });
});
