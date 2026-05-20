import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Optimizely Content Instance Creation (Story 15.2)
 * 
 * These tests verify the deployment workflow functionality
 * and the content creation capabilities through the UI.
 */

test.describe('Optimizely Deployment - Story 15.2', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create a new context with viewport
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    
    // Navigate to the studio deployment page for test-website
    await page.goto('http://localhost:3000/studio/deployment?websiteId=test-website');
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should load deployment page with correct website context', async () => {
    // Verify the deployment page loads
    await expect(page).toHaveTitle(/Catalyst Studio/);
    
    // Check for deployment wizard presence
    const deploymentWizard = page.locator('[data-testid="deployment-wizard"]');
    await expect(deploymentWizard).toBeVisible({ timeout: 10000 });
    
    // Verify tabs are present
    await expect(page.locator('button[role="tab"]:has-text("Deploy")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("History")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Settings")')).toBeVisible();
  });

  test('should display CMS provider selector with Optimizely option', async () => {
    // Look for CMS provider selector
    const providerSelector = page.locator('[data-testid="cms-provider-selector"]');
    await expect(providerSelector).toBeVisible({ timeout: 10000 });
    
    // Check for Optimizely provider option
    const optimizelyOption = page.locator('text=/Optimizely/i');
    await expect(optimizelyOption).toBeVisible();
    
    // Click on Optimizely provider
    await optimizelyOption.click();
    
    // Verify selection is reflected
    const selectedProvider = page.locator('.selected-provider');
    await expect(selectedProvider).toContainText(/Optimizely/i);
  });

  test('should configure Optimizely connection settings', async () => {
    // Select Optimizely provider
    await page.locator('text=/Optimizely/i').click();
    
    // Look for configuration fields
    const apiUrlField = page.locator('input[name="apiUrl"]');
    const clientIdField = page.locator('input[name="clientId"]');
    const clientSecretField = page.locator('input[name="clientSecret"]');
    
    // Verify fields are present
    await expect(apiUrlField).toBeVisible();
    await expect(clientIdField).toBeVisible();
    await expect(clientSecretField).toBeVisible();
    
    // Check if fields have default values from env
    const apiUrlValue = await apiUrlField.inputValue();
    expect(apiUrlValue).toContain('optimizely.com');
    
    // Test connection button should be available
    const testConnectionBtn = page.locator('button:has-text("Test Connection")');
    await expect(testConnectionBtn).toBeVisible();
  });

  test('should test Optimizely connection', async () => {
    // Select Optimizely provider
    await page.locator('text=/Optimizely/i').click();
    
    // Click test connection
    const testConnectionBtn = page.locator('button:has-text("Test Connection")');
    await testConnectionBtn.click();
    
    // Wait for connection test to complete
    await page.waitForSelector('.connection-status', { timeout: 30000 });
    
    // Check connection status
    const connectionStatus = page.locator('.connection-status');
    const statusText = await connectionStatus.textContent();
    
    // Connection should either succeed or show meaningful error
    expect(statusText).toMatch(/Connected|Connection failed/i);
  });

  test('should select content types for deployment', async () => {
    // Select Optimizely provider first
    await page.locator('text=/Optimizely/i').click();
    
    // Move to content selection step
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();
    
    // Wait for content type selector
    await page.waitForSelector('[data-testid="content-type-selector"]', { timeout: 10000 });
    
    // Check for content type options
    const pagesCheckbox = page.locator('input[type="checkbox"][value="pages"]');
    const blocksCheckbox = page.locator('input[type="checkbox"][value="blocks"]');
    const mediaCheckbox = page.locator('input[type="checkbox"][value="media"]');
    
    // Select all content types
    await pagesCheckbox.check();
    await blocksCheckbox.check();
    await mediaCheckbox.check();
    
    // Verify selections
    await expect(pagesCheckbox).toBeChecked();
    await expect(blocksCheckbox).toBeChecked();
    await expect(mediaCheckbox).toBeChecked();
  });

  test('should preview deployment mapping', async () => {
    // Navigate through wizard to mapping preview
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    
    // Select content types
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    
    // Wait for mapping preview
    await page.waitForSelector('[data-testid="content-mapping-preview"]', { timeout: 10000 });
    
    // Verify mapping shows block classification
    const mappingPreview = page.locator('[data-testid="content-mapping-preview"]');
    await expect(mappingPreview).toContainText(/Global Blocks/i);
    await expect(mappingPreview).toContainText(/Local Blocks/i);
    
    // Check for folder structure preview
    await expect(mappingPreview).toContainText(/For All Sites/i);
  });

  test('should start deployment process', async () => {
    // Complete wizard steps
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    
    // Start deployment
    const deployButton = page.locator('button:has-text("Start Deployment")');
    await expect(deployButton).toBeVisible();
    await deployButton.click();
    
    // Wait for deployment to start
    await page.waitForSelector('[data-testid="deployment-progress"]', { timeout: 10000 });
    
    // Verify progress indicators
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();
    
    // Check for status messages
    const statusMessage = page.locator('[data-testid="deployment-status"]');
    await expect(statusMessage).toBeVisible();
  });

  test('should display deployment logs', async () => {
    // Start a deployment
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Wait for logs container
    await page.waitForSelector('[data-testid="deployment-logs"]', { timeout: 10000 });
    
    // Verify logs are being generated
    const logsContainer = page.locator('[data-testid="deployment-logs"]');
    await expect(logsContainer).toBeVisible();
    
    // Check for log entries
    await page.waitForSelector('.log-entry', { timeout: 30000 });
    const logEntries = page.locator('.log-entry');
    const logCount = await logEntries.count();
    expect(logCount).toBeGreaterThan(0);
  });

  test('should handle deployment errors gracefully', async () => {
    // Intentionally trigger an error by using invalid settings
    await page.locator('text=/Optimizely/i').click();
    
    // Clear and set invalid API URL
    const apiUrlField = page.locator('input[name="apiUrl"]');
    await apiUrlField.clear();
    await apiUrlField.fill('http://invalid-url');
    
    // Try to proceed
    await page.locator('button:has-text("Next")').click();
    
    // Should show validation error
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText(/Invalid|Error/i);
  });

  test('should display deployment history', async () => {
    // Navigate to History tab
    const historyTab = page.locator('button[role="tab"]:has-text("History")');
    await historyTab.click();
    
    // Wait for history section
    await page.waitForSelector('[data-testid="deployment-history"]', { timeout: 10000 });
    
    // Check for history table or list
    const historyContainer = page.locator('[data-testid="deployment-history"]');
    await expect(historyContainer).toBeVisible();
    
    // If there are previous deployments, they should be listed
    const deploymentEntries = page.locator('.deployment-entry');
    const entryCount = await deploymentEntries.count();
    
    if (entryCount > 0) {
      // Verify deployment entry has required information
      const firstEntry = deploymentEntries.first();
      await expect(firstEntry).toContainText(/Optimizely|Completed|Failed|Running/i);
    }
  });

  test('should verify block classification logic', async () => {
    // This test verifies the block classification decision matrix
    // Start deployment with blocks
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    
    // Check mapping preview shows correct classification
    const mappingPreview = page.locator('[data-testid="content-mapping-preview"]');
    
    // Verify classification categories are present
    await expect(mappingPreview).toContainText(/Global Blocks.*For All Sites/i);
    await expect(mappingPreview).toContainText(/Local Blocks.*Page-specific/i);
    await expect(mappingPreview).toContainText(/Inline Blocks.*ContentArea/i);
  });

  test('should handle API rate limiting', async () => {
    // Start a large deployment to test rate limiting
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    
    // Select all content types for maximum load
    await page.locator('input[type="checkbox"][value="pages"]').check();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('input[type="checkbox"][value="media"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Monitor logs for rate limiting handling
    await page.waitForSelector('[data-testid="deployment-logs"]', { timeout: 10000 });
    
    // Check if rate limiting is mentioned in logs
    const logs = page.locator('[data-testid="deployment-logs"]');
    const logText = await logs.textContent();
    
    // Should handle rate limiting gracefully with delays
    if (logText?.includes('429') || logText?.includes('rate')) {
      expect(logText).toContain(/retry|delay|waiting/i);
    }
  });

  test('should export deployment results', async () => {
    // Complete a deployment first
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Wait for deployment to complete
    await page.waitForSelector('[data-testid="deployment-complete"]', { timeout: 60000 });
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Export Results")');
    await expect(exportButton).toBeVisible();
    
    // Click export - should trigger download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportButton.click()
    ]);
    
    // Verify download
    expect(download).toBeTruthy();
    const fileName = download.suggestedFilename();
    expect(fileName).toContain('deployment');
  });
});

/**
 * Integration tests for Optimizely Provider functionality
 */
test.describe('Optimizely Provider Integration', () => {
  test('should verify content transformation pipeline', async ({ page }) => {
    // This test verifies the content transformation works correctly
    await page.goto('http://localhost:3000/studio/deployment?websiteId=test-website');
    
    // Start deployment
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Monitor console for transformation logs
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('transform')) {
        // Verify transformation includes required fields
        expect(msg.text()).toMatch(/contentTypeGuid|parentLink|language/);
      }
    });
    
    // Wait for some processing
    await page.waitForTimeout(5000);
  });

  test('should verify folder structure creation', async ({ page }) => {
    await page.goto('http://localhost:3000/studio/deployment?websiteId=test-website');
    
    // Start deployment
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Check logs for folder creation
    await page.waitForSelector('[data-testid="deployment-logs"]', { timeout: 10000 });
    const logs = page.locator('[data-testid="deployment-logs"]');
    
    // Wait for folder creation logs
    await page.waitForFunction(
      () => {
        const logsEl = document.querySelector('[data-testid="deployment-logs"]');
        return logsEl?.textContent?.includes('folder') || logsEl?.textContent?.includes('For All Sites');
      },
      { timeout: 30000 }
    );
    
    const logText = await logs.textContent();
    expect(logText).toContain(/Creating folder|Folder created|For All Sites/i);
  });

  test('should verify 30-second visibility target', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:3000/studio/deployment?websiteId=test-website');
    
    // Start small deployment for timing test
    await page.locator('text=/Optimizely/i').click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[type="checkbox"][value="blocks"]').check();
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Start Deployment")').click();
    
    // Wait for first content creation log
    await page.waitForFunction(
      () => {
        const logsEl = document.querySelector('[data-testid="deployment-logs"]');
        return logsEl?.textContent?.includes('Content created') || logsEl?.textContent?.includes('Published');
      },
      { timeout: 30000 }
    );
    
    const elapsedTime = Date.now() - startTime;
    
    // Verify content creation happens within 30 seconds
    expect(elapsedTime).toBeLessThan(30000);
  });
});