import { test, expect } from '@playwright/test';

test.describe('Check JavaScript Execution', () => {
  test('authenticated app loads and redirects root to dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('/dashboard', { timeout: 30000 });

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('main', { name: 'Dashboard content' })).toBeVisible();
  });
});

test.describe('Check JavaScript Execution - unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('app loads public marketing root', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Catalyst Studio').first()).toBeVisible();
  });
});
