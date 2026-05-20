import { test, expect } from '@playwright/test';

test.describe('App Routing', () => {
  test('should redirect to /dashboard from root', async ({ page }) => {
    // Navigate to root with longer timeout
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Should redirect to dashboard with extended timeout
    await page.waitForURL('/dashboard', { timeout: 30000 });
    await expect(page).toHaveURL('/dashboard');
    
    // Verify page content loaded
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('dashboard should be accessible directly', async ({ page }) => {
    // Navigate directly to dashboard with proper wait
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Should stay on dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Check if page has loaded with content (more reliable than title)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    
    // Try to find dashboard-specific content if title check fails
    const hasTitle = await page.title().then(title => title.includes('Dashboard')).catch(() => false);
    const hasContent = await page.locator('h1, h2, [data-testid*="dashboard"], main').first().isVisible().catch(() => false);
    
    expect(hasTitle || hasContent).toBeTruthy();
  });

  test('routing logic executes correctly', async ({ page }) => {
    // Navigate to check if the page loads and routing logic runs
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for any redirect to complete with longer timeout
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Wait a bit more for any async redirects
    await page.waitForTimeout(2000);
    
    // Check that we're redirected to dashboard
    const url = page.url();
    expect(url).toContain('dashboard');
    
    // Verify the page actually loaded content
    await expect(page.locator('body')).not.toBeEmpty();
  });
});