import { test, expect } from '@playwright/test';

test.describe('Content Type Builder', () => {
  let testWebsiteId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test website for all tests
    const response = await request.post('/api/websites', {
      data: {
        name: 'Content Builder Test Website',
        description: 'Website for content type builder tests',
        category: 'Testing'
      }
    });
    const data = await response.json();
    testWebsiteId = data.data.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up test website
    if (testWebsiteId) {
      await request.delete(`/api/websites/${testWebsiteId}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Features are permanently enabled, no flags needed
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      // Clear any existing content types
      localStorage.removeItem('contentTypes');
    });
    
    // Navigate to studio content types page with website context
    await page.goto(`http://localhost:3000/studio/content-types?websiteId=${testWebsiteId}`);
    await page.waitForTimeout(1000);
  });

  test('should create a new content type', async ({ page }) => {
    // Check that a new content type is created automatically
    await expect(page.locator('h1')).toContainText('NewContentType');
    await expect(page.locator('text=0 fields')).toBeVisible();
  });

  test('should edit content type name', async ({ page }) => {
    // Click edit button - it's the button next to the h1
    await page.locator('h1').locator('..').locator('button').click();
    
    // Change the name
    await page.fill('input.text-2xl', 'BlogPost');
    await page.click('button:has-text("Save")');
    
    // Verify name changed
    await expect(page.locator('h1')).toContainText('BlogPost');
  });

  test('should add fields to content type', async ({ page }) => {
    // Click Add First Field button
    await page.click('button:has-text("Add First Field")');
    
    // Select Text field
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Verify field was added
    await expect(page.locator('text=1 field')).toBeVisible();
    await expect(page.locator('text=field_')).toBeVisible();
    
    // Add another field
    await page.click('button:has-text("Add Field")');
    await page.click('text=Number');
    await page.waitForTimeout(500);
    
    // Verify second field was added
    await expect(page.locator('text=2 fields')).toBeVisible();
  });

  test('should reorder fields using move buttons', async ({ page }) => {
    // Add two fields first
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Add Field")');
    await page.click('text=Number');
    await page.waitForTimeout(500);
    
    // Get initial order
    const fieldsBefore = await page.locator('[class*="card"]').filter({ hasText: 'field_' }).allTextContents();
    
    // Click move down on first field
    await page.locator('button[title="Move down"]').first().click();
    await page.waitForTimeout(500);
    
    // Get new order
    const fieldsAfter = await page.locator('[class*="card"]').filter({ hasText: 'field_' }).allTextContents();
    
    // Verify order changed
    expect(fieldsBefore[0]).not.toEqual(fieldsAfter[0]);
  });

  test('should open field properties panel', async ({ page }) => {
    // Add a field first
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Click settings button - it's in the field card
    await page.locator('[class*="card"]').filter({ hasText: 'field_' }).first().locator('button').nth(2).click();
    
    // Verify properties panel opened
    await expect(page.locator('text=Field Properties')).toBeVisible();
    await expect(page.locator('text=Display Label')).toBeVisible();
    await expect(page.locator('text=Required Field')).toBeVisible();
  });

  test('should update field properties', async ({ page }) => {
    // Add a field first
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Open properties panel - settings button in field card
    await page.locator('[class*="card"]').filter({ hasText: 'field_' }).first().locator('button').nth(2).click();
    
    // Update display label
    await page.fill('input[id="label"]', 'Article Title');
    
    // Toggle required field
    await page.click('button[role="switch"]');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(500);
    
    // Verify changes
    await expect(page.locator('text=Article Title')).toBeVisible();
    await expect(page.locator('text=Required')).toBeVisible();
  });

  test('should delete a field', async ({ page }) => {
    // Add a field first
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Verify field exists
    await expect(page.locator('text=1 field')).toBeVisible();
    
    // Click delete button (last button in the field card)
    await page.locator('[class*="card"]').filter({ hasText: 'field_' }).first().locator('button').nth(3).click();
    await page.waitForTimeout(500);
    
    // Verify field was deleted
    await expect(page.locator('text=0 fields')).toBeVisible();
    await expect(page.locator('text=No fields yet')).toBeVisible();
  });

  test('should persist content type after page refresh', async ({ page }) => {
    // Add fields
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Add Field")');
    await page.click('text=Number');
    await page.waitForTimeout(500);
    
    // Verify fields exist
    await expect(page.locator('text=2 fields')).toBeVisible();
    
    // Refresh page
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Verify fields persisted
    await expect(page.locator('text=2 fields')).toBeVisible();
  });

  test('should navigate to relationships page', async ({ page }) => {
    // Add a field to have some content
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Click Relationships button
    await page.click('button:has-text("Relationships")');
    
    // Verify navigation - updated to match studio route
    await expect(page).toHaveURL(new RegExp(`.*\/studio\/site-builder\/content-types.*websiteId=${testWebsiteId}`));
    await expect(page.locator('text=Content Relationships')).toBeVisible();
  });

  test('should validate field types', async ({ page }) => {
    // Test adding different field types
    const fieldTypes = [
      { name: 'Text', icon: '📝' },
      { name: 'Number', icon: '🔢' },
      { name: 'Boolean', icon: '✓' },
      { name: 'Date', icon: '📅' },
      { name: 'Image', icon: '🖼️' },
      { name: 'Rich Text', icon: '📄' },
    ];

    for (const fieldType of fieldTypes) {
      // Open modal
      await page.click('button:has-text("Add Field"), button:has-text("Add First Field")');
      
      // Select field type
      await page.click(`text=${fieldType.name}`);
      await page.waitForTimeout(500);
      
      // Verify field was added with correct type
      const fieldCard = page.locator('[class*="card"]').filter({ hasText: `field_` }).last();
      await expect(fieldCard).toContainText(fieldType.name.toLowerCase().replace(' ', ''));
    }
  });
});

test.describe('Content Type Builder - Edge Cases', () => {
  let testWebsiteId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test website for edge case tests
    const response = await request.post('/api/websites', {
      data: {
        name: 'Edge Case Test Website',
        description: 'Website for edge case testing',
        category: 'Testing'
      }
    });
    const data = await response.json();
    testWebsiteId = data.data.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up test website
    if (testWebsiteId) {
      await request.delete(`/api/websites/${testWebsiteId}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Features are permanently enabled, no flags needed
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.removeItem('contentTypes');
    });
    await page.goto(`http://localhost:3000/studio/content-types?websiteId=${testWebsiteId}`);
    await page.waitForTimeout(1000);
  });

  test('should handle rapid field additions', async ({ page }) => {
    // Rapidly add multiple fields
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Add Field"), button:has-text("Add First Field")');
      await page.click('text=Text');
      await page.waitForTimeout(100);
    }
    
    // Verify all fields were added
    await expect(page.locator('text=5 fields')).toBeVisible();
  });

  test('should handle long field names', async ({ page }) => {
    // Add a field
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Open properties - settings button in field card
    await page.locator('[class*="card"]').filter({ hasText: 'field_' }).first().locator('button').nth(2).click();
    
    // Set a very long label
    const longLabel = 'This is a very long field label that should be handled properly by the UI';
    await page.fill('input[id="label"]', longLabel);
    
    // Save
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(500);
    
    // Verify the long label is displayed (possibly truncated)
    await expect(page.locator(`text="${longLabel}"`)).toBeVisible();
  });

  test('should handle special characters in field names', async ({ page }) => {
    // Add a field
    await page.click('button:has-text("Add First Field")');
    await page.click('text=Text');
    await page.waitForTimeout(500);
    
    // Open properties - settings button in field card
    await page.locator('[class*="card"]').filter({ hasText: 'field_' }).first().locator('button').nth(2).click();
    
    // Try to set field name with special characters (should be sanitized)
    await page.fill('input[id="name"]', 'field-name_123');
    await page.fill('input[id="label"]', 'Field & Label!');
    
    // Save
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(500);
    
    // Verify the field was saved
    await expect(page.locator('text=Field & Label!')).toBeVisible();
  });
});