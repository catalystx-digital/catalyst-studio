import { test, expect } from '@playwright/test';

test.describe('Default Routing With Studio Deployment', () => {
  test('should redirect root to /dashboard', async ({ page }) => {
    // Navigate to root - dashboard is now enabled by default
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for redirect to complete with extended timeout
    await page.waitForURL('/dashboard', { timeout: 30000 });

    // Verify we're on the dashboard page
    await expect(page).toHaveURL('/dashboard');

    // Ensure page content has loaded
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('dashboard page should be accessible directly', async ({ page }) => {
    // Navigate directly to dashboard
    const response = await page.goto('/dashboard', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Should load the dashboard page without 404
    expect(response?.status()).toBeLessThan(400);

    // Should be on dashboard URL
    await expect(page).toHaveURL('/dashboard');

    // Ensure content has loaded
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('studio site builder should be accessible directly', async ({ page }) => {
    // Navigate directly to studio site builder
    const response = await page.goto('/studio/site-builder', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Should load without 404
    expect(response?.status()).toBeLessThan(400);

    // Should be on studio site builder URL
    await expect(page).toHaveURL('/studio/site-builder');

    // Ensure content has loaded
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('studio studio routes should be accessible', async ({ page }) => {
    // Test studio studio deployment
    const deployResponse = await page.goto('/studio/deployment', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    expect(deployResponse?.status()).toBeLessThan(400);

    // Test studio studio preview
    const previewResponse = await page.goto('/studio/preview', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    expect(previewResponse?.status()).toBeLessThan(400);

    // Test studio studio team
    const teamResponse = await page.goto('/studio/team', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    expect(teamResponse?.status()).toBeLessThan(400);
  });
});
