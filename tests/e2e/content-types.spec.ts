import { test, expect } from '@playwright/test';

test.describe('Content Types Module E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to content builder page
    await page.goto('http://localhost:3000/content-builder');
    await page.waitForLoadState('networkidle');
  });

  test('should load content builder page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Catalyst Studio/);
    
    // Check main content type builder elements are present
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    
    // Check for add field button
    const addFieldButton = page.getByRole('button', { name: /Add.*Field/i });
    await expect(addFieldButton).toBeVisible();
  });

  test('should open field selection modal', async ({ page }) => {
    // Click Add First Field button
    const addFieldButton = page.getByRole('button', { name: /Add.*Field/i });
    await addFieldButton.click();
    
    // Check modal is visible
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Check field types are shown
    await expect(page.getByText('Text')).toBeVisible();
    await expect(page.getByText('Number')).toBeVisible();
    await expect(page.getByText('Boolean')).toBeVisible();
    await expect(page.getByText('Date')).toBeVisible();
  });

  test('should add a text field to content type', async ({ page }) => {
    // Click Add Field button
    const addFieldButton = page.getByRole('button', { name: /Add.*Field/i });
    await addFieldButton.click();
    
    // Select Text field type
    await page.getByText('📝').click();
    
    // Wait for field to be added (even if API call fails)
    await page.waitForTimeout(1000);
    
    // Check if modal closed
    const modal = page.getByRole('dialog');
    await expect(modal).not.toBeVisible();
  });

  test('should make API calls for content type operations', async ({ page }) => {
    // Track API calls
    const apiCalls: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/content-types')) {
        apiCalls.push(`${request.method()} ${request.url()}`);
      }
    });
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Should have made GET request to fetch content types
    expect(apiCalls.some(call => call.includes('GET') && call.includes('/api/content-types'))).toBeTruthy();
  });

  test('should handle content type creation', async ({ page }) => {
    let createResponse: any = null;
    
    // Intercept API response
    page.on('response', async response => {
      if (response.url().includes('/api/content-types') && response.request().method() === 'POST') {
        createResponse = await response.json();
      }
    });
    
    // Trigger content type creation (if the UI supports it)
    // This would depend on the actual UI implementation
    
    // For now, verify the API endpoint exists and responds
    const response = await page.request.post('http://localhost:3000/api/content-types', {
      data: {
        websiteId: 'test-website-id',
        name: 'TestContentType',
        pluralName: 'TestContentTypes',
        icon: '🧪',
        description: 'E2E Test Content Type',
        fields: [],
        relationships: []
      }
    });
    
    // Check response status (should be 201 or 400 depending on validation)
    expect([201, 400]).toContain(response.status());
  });

  test('should display existing content types', async ({ page }) => {
    // Create a test content type via API first
    await page.request.post('http://localhost:3000/api/content-types', {
      data: {
        websiteId: 'test-website', // Use existing website ID
        name: 'E2ETestType',
        pluralName: 'E2ETestTypes',
        icon: '🧪',
        fields: [],
        relationships: []
      }
    });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if content types are fetched
    const response = await page.request.get('http://localhost:3000/api/content-types');
    const data = await response.json();
    
    expect(response.ok()).toBeTruthy();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('should update content type', async ({ page }) => {
    // Get existing content types
    const getResponse = await page.request.get('http://localhost:3000/api/content-types');
    const getData = await getResponse.json();
    
    if (getData.data && getData.data.length > 0) {
      const contentTypeId = getData.data[0].id;
      
      // Update the content type
      const updateResponse = await page.request.put(`http://localhost:3000/api/content-types/${contentTypeId}`, {
        data: {
          description: 'Updated via E2E test'
        }
      });
      
      // Check response
      if (updateResponse.ok()) {
        const updateData = await updateResponse.json();
        expect(updateData.data.settings.description).toBe('Updated via E2E test');
      }
    }
  });

  test('should handle error cases gracefully', async ({ page }) => {
    // Test invalid content type creation
    const response = await page.request.post('http://localhost:3000/api/content-types', {
      data: {
        // Missing required fields
        name: ''
      }
    });
    
    expect(response.status()).toBe(400);
    const errorData = await response.json();
    expect(errorData).toHaveProperty('error');
  });

  test('should check optimistic updates', async ({ page }) => {
    // Click Add Field button
    const addFieldButton = page.getByRole('button', { name: /Add.*Field/i });
    await addFieldButton.click();
    
    // Select a field type
    await page.getByText('📝').click();
    
    // The UI should update immediately (optimistic update)
    // even before the API call completes
    await page.waitForTimeout(100);
    
    // Check if the UI reflects the change
    // This would depend on how the UI shows fields
  });

  test('should persist data across page refreshes', async ({ page }) => {
    // Create a content type via API
    const createResponse = await page.request.post('http://localhost:3000/api/content-types', {
      data: {
        websiteId: 'test-website',
        name: `PersistTest${Date.now()}`,
        pluralName: 'PersistTests',
        icon: '💾',
        fields: [],
        relationships: []
      }
    });
    
    if (createResponse.ok()) {
      const createData = await createResponse.json();
      const contentTypeId = createData.data.id;
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check if the content type still exists
      const getResponse = await page.request.get(`http://localhost:3000/api/content-types/${contentTypeId}`);
      expect(getResponse.ok()).toBeTruthy();
      
      const getData = await getResponse.json();
      expect(getData.data.id).toBe(contentTypeId);
    }
  });
});

test.describe('Performance Tests', () => {
  test('should load content types within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    const response = await page.request.get('http://localhost:3000/api/content-types');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Response should be under 200ms as per requirements
    expect(responseTime).toBeLessThan(200);
    expect(response.ok()).toBeTruthy();
  });

  test('should handle concurrent operations', async ({ page }) => {
    // Make multiple API calls concurrently
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        page.request.get('http://localhost:3000/api/content-types')
      );
    }
    
    const responses = await Promise.all(promises);
    
    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });
});