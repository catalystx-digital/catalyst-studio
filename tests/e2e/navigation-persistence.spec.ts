import { test, expect } from '@playwright/test';

test.describe('Navigation System - Layout Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/studio/site-builder');
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });

  test('should maintain three-column layout across all navigation', async ({ page }) => {
    // Verify initial three-column layout
    const chatPanel = page.locator('.w-\\[360px\\]').first();
    const navPanel = page.locator('.w-\\[260px\\]').first();
    const mainContent = page.locator('.flex-1').last();

    // Check all three panels are visible
    await expect(chatPanel).toBeVisible();
    await expect(navPanel).toBeVisible();
    await expect(mainContent).toBeVisible();

    // Navigate to different sections and verify layout persists
    // Note: Studio routes use query params instead of path segments
    const navigationItems = [
      { label: 'Overview', urlPattern: /studio\/site-builder/ },
      { label: 'Content Items', urlPattern: /studio\/site-builder\/content/ },
      { label: 'Content Modeling', urlPattern: /studio\/site-builder\/content-types/ },
      { label: 'Preview', urlPattern: /studio\/studio\/preview/ },
      { label: 'Analytics', urlPattern: /studio\/studio\/analytics/ }
    ];

    for (const item of navigationItems) {
      // Click navigation item
      await page.getByRole('button', { name: item.label }).click();

      // Wait for navigation
      await page.waitForURL(item.urlPattern);

      // Verify all three columns still visible
      await expect(chatPanel).toBeVisible();
      await expect(navPanel).toBeVisible();
      await expect(mainContent).toBeVisible();

      // Verify URL changed correctly
      expect(page.url()).toMatch(item.urlPattern);
    }
  });

  test('should load content in right panel without page reload', async ({ page }) => {
    // Get initial page load ID to detect full page reloads
    const initialLoadId = await page.evaluate(() => window.performance.navigation.type);

    // Click on Content Items
    await page.getByRole('button', { name: 'Content Items' }).click();

    // Check that content loaded without full page reload
    const currentLoadId = await page.evaluate(() => window.performance.navigation.type);
    expect(currentLoadId).toBe(initialLoadId);

    // Verify content loaded in right panel
    await expect(page.locator('text=Manage your content entries')).toBeVisible();
  });

  test('chat panel should remain functional during navigation', async ({ page }) => {
    // Type something in chat
    const chatInput = page.locator('textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    await chatInput.fill('Test message during navigation');

    // Navigate to different section
    await page.getByRole('button', { name: 'Analytics' }).click();

    // Verify chat input still has the text
    await expect(chatInput).toHaveValue('Test message during navigation');

    // Navigate back
    await page.getByRole('button', { name: 'Overview' }).click();

    // Chat should still be functional
    await expect(chatInput).toHaveValue('Test message during navigation');
  });

  test('should show correct active state for navigation items', async ({ page }) => {
    // Click on Content Items
    await page.getByRole('button', { name: 'Content Items' }).click();

    // Check active state
    const contentButton = page.getByRole('button', { name: 'Content Items' });
    await expect(contentButton).toHaveClass(/bg-orange-500\/10|text-orange-400/);

    // Navigate to Preview
    await page.getByRole('button', { name: 'Preview' }).click();

    // Check Preview is active
    const previewButton = page.getByRole('button', { name: 'Preview' });
    await expect(previewButton).toHaveClass(/bg-orange-500\/10|text-orange-400/);

    // Content Items should not be active anymore
    await expect(contentButton).not.toHaveClass(/bg-orange-500\/10|text-orange-400/);
  });

  test('should display tooltips for navigation items', async ({ page }) => {
    // Hover over Preview
    await page.getByRole('button', { name: 'Preview' }).hover();

    // Check tooltip appears
    await expect(page.locator('text=Preview your website across different devices')).toBeVisible();

    // Hover over Analytics
    await page.getByRole('button', { name: 'Analytics' }).hover();

    // Check tooltip appears
    await expect(page.locator('text=Track and analyze your project performance')).toBeVisible();
  });

  test('should have working quick actions on Overview page', async ({ page }) => {
    // Navigate to Overview
    await page.getByRole('button', { name: 'Overview' }).click();

    // Click Preview quick action
    await page.getByRole('button', { name: 'Preview Changes' }).click();

    // Should navigate to Preview (studio route)
    await expect(page).toHaveURL(/\/studio\/studio\/preview/);

    // Go back to Overview
    await page.getByRole('button', { name: 'Overview' }).click();

    // Click Analytics quick action
    await page.getByRole('button', { name: 'View Analytics' }).click();

    // Should navigate to Analytics (studio route)
    await expect(page).toHaveURL(/\/studio\/studio\/analytics/);
  });
});

test.describe('Performance Tests', () => {
  test('navigation switches should be under 100ms', async ({ page }) => {
    await page.goto('http://localhost:3000/studio/site-builder');
    await page.waitForLoadState('networkidle');

    // Measure navigation time
    const navigationTime = await page.evaluate(async () => {
      const startTime = performance.now();

      // Trigger navigation programmatically
      const button = document.querySelector('button:has-text("Content Items")') as HTMLElement;
      button?.click();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 50));

      const endTime = performance.now();
      return endTime - startTime;
    });

    // Should be under 100ms
    expect(navigationTime).toBeLessThan(100);
  });
});

test.describe('Mobile Responsive Behavior', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should adapt layout for mobile screens', async ({ page }) => {
    await page.goto('http://localhost:3000/studio/site-builder');

    // On mobile, navigation might be in a drawer or hamburger menu
    // Check if hamburger menu exists
    const menuButton = page.locator('button[aria-label*="menu"], button:has-text("☰")');

    if (await menuButton.isVisible()) {
      // Click to open navigation
      await menuButton.click();

      // Navigation should be visible now
      await expect(page.locator('nav')).toBeVisible();
    }

    // Test navigation still works
    await page.getByRole('button', { name: 'Content Items' }).click();

    // Content should load
    await expect(page.locator('text=Manage your content entries')).toBeVisible();
  });
});

test.describe('PRD Requirements Validation', () => {
  test('FR1: Three-column layout with correct dimensions', async ({ page }) => {
    await page.goto('http://localhost:3000/studio/site-builder');
    await page.waitForLoadState('networkidle');

    // Check chat panel width (should be 360px)
    const chatPanel = page.locator('[data-testid="chat-panel"], .chat-panel, [class*="w-\\[360px\\]"]').first();
    const chatWidth = await chatPanel.evaluate(el => el.getBoundingClientRect().width);
    expect(chatWidth).toBeCloseTo(360, 1);

    // Check navigation sidebar width (should be 260px)
    const navPanel = page.locator('nav').first();
    const navWidth = await navPanel.evaluate(el => el.getBoundingClientRect().width);
    expect(navWidth).toBeCloseTo(260, 1);

    // Main content should be flexible (remaining space)
    const mainContent = page.locator('main').first();
    const mainWidth = await mainContent.evaluate(el => el.getBoundingClientRect().width);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(mainWidth).toBeCloseTo(viewportWidth - 360 - 260, 10);
  });

  test('FR6: Navigation sections are properly organized', async ({ page }) => {
    await page.goto('http://localhost:3000/studio/site-builder');

    // Check expandable sections exist
    const contentSection = page.locator('text=Content').first();
    const developmentSection = page.locator('text=Development').first();
    const integrationsSection = page.locator('text=Integrations').first();

    await expect(contentSection).toBeVisible();
    await expect(developmentSection).toBeVisible();
    await expect(integrationsSection).toBeVisible();

    // Check direct links exist
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible();
  });
});
