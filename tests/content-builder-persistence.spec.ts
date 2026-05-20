import { test, expect } from '@playwright/test';

test.describe('Content Type Builder Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Features are permanently enabled, no flags needed
    await page.goto('http://localhost:3000');
  });

  test('should persist fields after page refresh', async ({ page }) => {
    // Navigate to content builder
    await page.goto('http://localhost:3000/content-builder');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Check if we're on the content builder page
    const heading = await page.locator('h1').first();
    console.log('Page heading:', await heading.textContent());
    
    // Click Add Field button
    const addFieldButton = page.locator('button:has-text("Add Field"), button:has-text("Add First Field")').first();
    await expect(addFieldButton).toBeVisible({ timeout: 10000 });
    await addFieldButton.click();
    
    // Wait for modal to appear
    await page.waitForTimeout(1000);
    
    // Select Text field type
    const textFieldCard = page.locator('text=Text').first();
    await expect(textFieldCard).toBeVisible({ timeout: 5000 });
    await textFieldCard.click();
    
    // Wait for field to be added
    await page.waitForTimeout(1000);
    
    // Verify field was added
    const fieldCard = page.locator('[class*="card"]').filter({ hasText: 'New Field' });
    await expect(fieldCard).toBeVisible();
    
    // Check localStorage
    const storageBeforeRefresh = await page.evaluate(() => {
      return localStorage.getItem('contentTypes');
    });
    console.log('localStorage before refresh:', storageBeforeRefresh);
    
    // Add another field
    await page.locator('button:has-text("Add Field")').click();
    await page.waitForTimeout(500);
    await page.locator('text=Number').first().click();
    await page.waitForTimeout(1000);
    
    // Check localStorage again
    const storageAfterSecondField = await page.evaluate(() => {
      return localStorage.getItem('contentTypes');
    });
    console.log('localStorage after adding second field:', storageAfterSecondField);
    
    // Count fields before refresh
    const fieldsBeforeRefresh = await page.locator('[class*="card"]').filter({ hasText: 'field_' }).count();
    console.log('Fields before refresh:', fieldsBeforeRefresh);
    
    // Refresh the page
    await page.reload();
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check localStorage after refresh
    const storageAfterRefresh = await page.evaluate(() => {
      return localStorage.getItem('contentTypes');
    });
    console.log('localStorage after refresh:', storageAfterRefresh);
    
    // Count fields after refresh
    const fieldsAfterRefresh = await page.locator('[class*="card"]').filter({ hasText: 'field_' }).count();
    console.log('Fields after refresh:', fieldsAfterRefresh);
    
    // Verify fields persisted
    expect(fieldsAfterRefresh).toBe(fieldsBeforeRefresh);
    expect(fieldsAfterRefresh).toBeGreaterThan(0);
  });

  test('should check what is in localStorage', async ({ page }) => {
    await page.goto('http://localhost:3000/content-builder');
    await page.waitForTimeout(2000);
    
    // Get all localStorage data
    const allStorage = await page.evaluate(() => {
      const result: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            result[key] = JSON.parse(localStorage.getItem(key) || '{}');
          } catch {
            result[key] = localStorage.getItem(key);
          }
        }
      }
      return result;
    });
    
    console.log('All localStorage:', JSON.stringify(allStorage, null, 2));
  });
});