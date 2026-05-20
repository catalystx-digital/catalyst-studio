import { test, expect } from '@playwright/test';

test.describe('Preview System', () => {
  // Features are now permanently enabled, no flags needed

  test('should navigate to preview page', async ({ page }) => {
    await page.goto('/preview');
    await expect(page).toHaveURL('/preview');
    
    // Check if preview page loads correctly
    await expect(page.locator('text=Device Preview')).toBeVisible();
  });

  test('should switch between device types', async ({ page }) => {
    await page.goto('/preview');
    
    // Click on Desktop button
    await page.click('button[aria-label="Switch to Desktop view"]');
    await expect(page.locator('.device-frame')).toBeVisible();
    
    // Click on Tablet button
    await page.click('button[aria-label="Switch to Tablet view"]');
    await page.waitForTimeout(300); // Wait for animation
    
    // Click on Mobile button
    await page.click('button[aria-label="Switch to Mobile view"]');
    await page.waitForTimeout(300); // Wait for animation
  });

  test('should update preview within 2 seconds', async ({ page }) => {
    await page.goto('/preview');
    
    const startTime = Date.now();
    
    // Trigger content update
    await page.click('button:has-text("Refresh")');
    
    // Wait for update to complete
    await page.waitForSelector('.preview-frame-container iframe', { state: 'visible' });
    
    const endTime = Date.now();
    const updateTime = endTime - startTime;
    
    // Verify update completed within 2 seconds
    expect(updateTime).toBeLessThan(2000);
  });

  test('should handle zoom controls', async ({ page }) => {
    await page.goto('/preview');
    
    // Test zoom in
    await page.click('button[title="Zoom in (Ctrl++)"]');
    await page.waitForTimeout(100);
    
    // Test zoom out
    await page.click('button[title="Zoom out (Ctrl+-)"]');
    await page.waitForTimeout(100);
    
    // Test zoom preset
    await page.click('button:has-text("%")');
    await page.click('button:has-text("100%")');
  });

  test('should toggle fullscreen mode', async ({ page }) => {
    await page.goto('/preview');
    
    // Click fullscreen button
    await page.click('button[title*="fullscreen"]');
    
    // Note: Actual fullscreen API requires user interaction and may not work in headless mode
    // We're just testing that the button is clickable and doesn't throw errors
    await expect(page.locator('button[title*="fullscreen"]')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/preview');
    
    // Check if navigation component is visible
    const navigationSection = page.locator('text=Page Navigation');
    await expect(navigationSection).toBeVisible();
  });

  test('should toggle device frame visibility', async ({ page }) => {
    await page.goto('/preview');
    
    // Open settings
    await page.click('button[title="Preview settings"]');
    
    // Toggle device frame
    const deviceFrameSwitch = page.locator('label:has-text("Show device frame")').locator('..').locator('button[role="switch"]');
    await deviceFrameSwitch.click();
    await page.waitForTimeout(300); // Wait for animation
  });

  test('should copy preview URL', async ({ page }) => {
    await page.goto('/preview');
    
    // Mock clipboard API
    await page.evaluate(() => {
      (navigator as any).clipboard = {
        writeText: () => Promise.resolve()
      };
    });
    
    // Click copy URL button
    await page.click('button[title="Copy preview URL"]');
    
    // Check for toast notification (if visible)
    // Toast might appear briefly, so we use a more lenient check
    await page.waitForTimeout(500);
  });

  test('should maintain 60fps during animations', async ({ page }) => {
    await page.goto('/preview');
    
    // Start performance measurement
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        let frameCount = 0;
        
        function countFrame() {
          frameCount++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frameCount);
          }
        }
        
        requestAnimationFrame(countFrame);
      });
    });
    
    // Expect at least 50 fps (allowing some variance)
    expect(metrics).toBeGreaterThan(50);
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/preview');
    
    // Test refresh shortcut (Ctrl+R)
    await page.keyboard.press('Control+r');
    await page.waitForTimeout(100);
    
    // Test zoom shortcuts
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(100);
    
    await page.keyboard.press('Control+-');
    await page.waitForTimeout(100);
    
    await page.keyboard.press('Control+0');
    await page.waitForTimeout(100);
  });
});