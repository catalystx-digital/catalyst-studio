import { test, expect } from '@playwright/test';

test.describe('Studio CMS Deployment Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to the studio deployment page with test mode
    await page.goto('/studio/deployment?test=true');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Wait for React hydration
    await page.waitForTimeout(1000);
  });

  test('should display deployment page with tabs', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Deployment');

    // Check tabs are present
    await expect(page.locator('button[role="tab"]:has-text("Deploy")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("History")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Settings")')).toBeVisible();
  });

  test('should show CMS provider selection in deployment wizard', async ({ page }) => {
    // Ensure we're on the Deploy tab
    await page.click('button[role="tab"]:has-text("Deploy")');

    // Check wizard step indicator
    await expect(page.locator('text=Select Provider')).toBeVisible();
    await expect(page.locator('text=Content Mapping')).toBeVisible();
    await expect(page.locator('text=Deploy')).toBeVisible();
    await expect(page.locator('text=Complete')).toBeVisible();

    // Check CMS providers are displayed
    await expect(page.locator('text=Optimizely')).toBeVisible();
    await expect(page.locator('text=Contentful')).toBeVisible();
    await expect(page.locator('text=Strapi')).toBeVisible();
  });

  test('should open configuration modal when clicking on provider', async ({ page }) => {
    // Click on Optimizely provider
    await page.click('button:has-text("Optimizely")');

    // Check modal appears
    await expect(page.locator('text=Configure Optimizely')).toBeVisible();

    // Check form fields
    await expect(page.locator('label:has-text("API Key")')).toBeVisible();
    await expect(page.locator('label:has-text("Project ID")')).toBeVisible();
    await expect(page.locator('label:has-text("Environment")')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Configure Optimizely')).not.toBeVisible();
  });

  test('should display deployment history', async ({ page }) => {
    // Switch to History tab
    await page.click('button[role="tab"]:has-text("History")');

    // Check history section is visible
    await expect(page.locator('h3:has-text("Deployment History")')).toBeVisible();

    // Initially might be empty
    const emptyState = page.locator('text=No deployment history yet');
    if (await emptyState.isVisible()) {
      expect(await emptyState.textContent()).toContain('No deployment history');
    }
  });

  test('should show CMS provider settings', async ({ page }) => {
    // Switch to Settings tab
    await page.click('button[role="tab"]:has-text("Settings")');

    // Check settings content
    await expect(page.locator('h2:has-text("CMS Provider Settings")')).toBeVisible();
    await expect(page.locator('text=Manage your CMS provider connections')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that content is still accessible
    await expect(page.locator('h1')).toContainText('Deployment');

    // Tabs should still be functional
    await expect(page.locator('button[role="tab"]:has-text("Deploy")')).toBeVisible();

    // Provider cards should stack vertically
    const providerCards = page.locator('button:has-text("Optimizely"), button:has-text("Contentful"), button:has-text("Strapi")');
    const count = await providerCards.count();
    expect(count).toBe(3);
  });
});
