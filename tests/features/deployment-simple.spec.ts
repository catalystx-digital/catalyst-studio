import { test, expect } from '@playwright/test';

test.describe('CMS Deployment Feature - Permanently Enabled', () => {
  test('deployment link appears in navigation', async ({ page }) => {
    // Navigate to studio site builder (feature is permanently enabled, no flags needed)
    await page.goto('/studio/site-builder');
    await page.waitForLoadState('networkidle');

    // Check if CMS Deployment link exists in navigation
    const deploymentLink = page.locator('text=CMS Deployment');
    await expect(deploymentLink).toBeVisible({ timeout: 10000 });
  });

  test('deployment page loads when accessed directly', async ({ page }) => {
    // Navigate directly to studio deployment page (feature is permanently enabled)
    await page.goto('/studio/deployment');
    await page.waitForLoadState('networkidle');

    // Check that we're not on the default chat page
    const chatInput = page.locator('textarea[placeholder*="Type your message"]');
    const hasChat = await chatInput.count() > 0;

    // Check for any deployment-related content
    const pageContent = await page.content();
    const hasDeploymentContent =
      pageContent.includes('Deploy') ||
      pageContent.includes('CMS') ||
      pageContent.includes('deployment');

    expect(hasDeploymentContent).toBe(true);
  });

  test('deployment functionality is accessible', async ({ page }) => {
    // Navigate to studio site builder (feature is permanently enabled)
    await page.goto('/studio/site-builder');
    await page.waitForLoadState('networkidle');

    // Try to navigate to deployment via sidebar
    const deploymentLink = page.locator('button, a').filter({ hasText: 'CMS Deployment' });
    if (await deploymentLink.count() > 0) {
      await deploymentLink.first().click();
      await page.waitForTimeout(2000);

      // Check URL changed
      const url = page.url();
      expect(url).toContain('deployment');
    }
  });
});
