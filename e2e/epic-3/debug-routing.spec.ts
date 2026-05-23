import { test, expect } from '@playwright/test';

test.describe('Routing Diagnostics', () => {
  test('authenticated root resolves through dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('/dashboard', { timeout: 30000 });

    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Routing Diagnostics - unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('guarded route redirects to sign-in', async ({ page }) => {
    await page.goto('/studio/team', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/sign-in?**', { timeout: 30000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/sign-in');
    expect(url.searchParams.get('redirect_url')).toBe('/studio/team');
  });
});
