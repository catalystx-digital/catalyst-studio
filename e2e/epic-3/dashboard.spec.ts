import { test, expect } from '@playwright/test';

test.describe('Dashboard Tests', () => {
  test('dashboard page should load correctly', async ({ page }) => {
    // Navigate directly to dashboard
    const response = await page.goto('/dashboard');
    
    // Should load without 404
    expect(response?.status()).toBeLessThan(400);
    
    // Should be on dashboard URL
    await expect(page).toHaveURL('/dashboard');
    
    // Should have dashboard in title
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test('dashboard should have website creator', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for AI prompt section
    await expect(page.locator('text=What would you build today?')).toBeVisible();
    
    // Check for create button
    await expect(page.locator('button:has-text("Create Website")')).toBeVisible();
  });

  test('default navigation redirects to dashboard', async ({ page }) => {
    // Navigate to root
    await page.goto('/');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL('/dashboard');
  });
});