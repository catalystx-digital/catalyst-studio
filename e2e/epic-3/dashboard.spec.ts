import { test, expect } from '@playwright/test';

test.describe('Dashboard Tests', () => {
  test('authenticated dashboard page should load correctly', async ({ page }) => {
    const response = await page.goto('/dashboard');

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/dashboard');
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test('authenticated dashboard should have website creator', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Create your first website' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create with AI' })).toBeVisible();
  });
});

test.describe('Dashboard Tests - unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('dashboard shows sign-in prompt without redirecting', async ({ page }) => {
    const response = await page.goto('/dashboard');

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Please sign in to view your websites.')).toBeVisible();
  });
});
