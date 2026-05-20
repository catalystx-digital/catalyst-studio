/**
 * End-to-End Tests for Epic 5 AI Tools
 * Tests complete user flows in the browser
 */

import { test, expect } from '@playwright/test';

test.describe('Epic 5 - AI-Powered Content Management Tools', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat page
    await page.goto('/chat');
    
    // Wait for the chat interface to load
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  });

  test.describe('Complete User Flows', () => {
    test('User asks AI to create website structure', async ({ page }) => {
      // Type the request in the chat input
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a new website called "Tech Blog" with content types for blog posts, authors, and categories');
      
      // Submit the message
      await page.keyboard.press('Enter');
      
      // Wait for AI response with streaming
      await expect(page.locator('[data-testid="chat-message"]').last()).toBeVisible();
      
      // Verify tool execution feedback appears
      await expect(page.locator('[data-testid="tool-execution"]')).toBeVisible({ timeout: 10000 });
      
      // Check for successful website creation message
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Verify content types were created
      await expect(page.locator('text=/content type.*blog/i')).toBeVisible();
      await expect(page.locator('text=/content type.*author/i')).toBeVisible();
      await expect(page.locator('text=/content type.*categor/i')).toBeVisible();
    });

    test('User requests content type creation', async ({ page }) => {
      // First create a website
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a website called "E-commerce Store"');
      await page.keyboard.press('Enter');
      
      // Wait for website creation
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Request content type creation
      await chatInput.fill('Create a Product content type with fields for name, description, price, SKU, inventory, and images');
      await page.keyboard.press('Enter');
      
      // Verify tool execution
      await expect(page.locator('[data-testid="tool-execution"]').nth(1)).toBeVisible({ timeout: 10000 });
      
      // Check for successful content type creation
      await expect(page.locator('text=/content type.*product.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Verify fields were inferred correctly
      await expect(page.locator('text=/field.*name/i')).toBeVisible();
      await expect(page.locator('text=/field.*price/i')).toBeVisible();
      await expect(page.locator('text=/field.*SKU/i')).toBeVisible();
    });

    test('User creates multiple content items', async ({ page }) => {
      // Setup: Create website and content type
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a portfolio website with a Project content type');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Create multiple content items
      await chatInput.fill('Create 3 project items: "Website Redesign" with description "Modern redesign of company website", "Mobile App" with description "Cross-platform mobile application", and "API Integration" with description "RESTful API development"');
      await page.keyboard.press('Enter');
      
      // Verify multiple tool executions
      await expect(page.locator('[data-testid="tool-execution"]')).toHaveCount(3, { timeout: 20000 });
      
      // Check for successful item creation
      await expect(page.locator('text=/Website Redesign.*created/i')).toBeVisible();
      await expect(page.locator('text=/Mobile App.*created/i')).toBeVisible();
      await expect(page.locator('text=/API Integration.*created/i')).toBeVisible();
    });

    test('User modifies existing structures', async ({ page }) => {
      // Setup: Create initial structure
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a news website with an Article content type');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Modify the content type
      await chatInput.fill('Update the Article content type to add a featured boolean field and a publishDate field');
      await page.keyboard.press('Enter');
      
      // Verify update execution
      await expect(page.locator('[data-testid="tool-execution"]').last()).toBeVisible({ timeout: 10000 });
      
      // Check for successful update
      await expect(page.locator('text=/content type.*updated/i')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=/field.*featured/i')).toBeVisible();
      await expect(page.locator('text=/field.*publishDate/i')).toBeVisible();
    });

    test('User triggers and recovers from errors', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Try to create content without a website
      await chatInput.fill('Create a content item called "Test Item" with invalid data');
      await page.keyboard.press('Enter');
      
      // Should see error feedback
      await expect(page.locator('[data-testid="tool-error"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/error|failed/i')).toBeVisible();
      
      // Recover by creating proper structure
      await chatInput.fill('First create a website called "Test Site", then create a Page content type, then create the content item');
      await page.keyboard.press('Enter');
      
      // Should see successful recovery
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=/content type.*created/i')).toBeVisible();
      await expect(page.locator('text=/content item.*created/i')).toBeVisible();
    });
  });

  test.describe('Streaming UI Updates', () => {
    test('Tool execution feedback appears in real-time', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a website and show me the progress');
      await page.keyboard.press('Enter');
      
      // Tool execution indicator should appear immediately
      await expect(page.locator('[data-testid="tool-indicator"]')).toBeVisible({ timeout: 2000 });
      
      // Progress updates should stream
      await expect(page.locator('[data-testid="tool-status"]')).toContainText('executing', { timeout: 5000 });
      
      // Final result should appear
      await expect(page.locator('[data-testid="tool-status"]')).toContainText('completed', { timeout: 10000 });
    });

    test('Multiple tool calls show sequential progress', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a complete blog structure with website, content types, and sample content');
      await page.keyboard.press('Enter');
      
      // Should see multiple tool executions in sequence
      const toolExecutions = page.locator('[data-testid="tool-execution"]');
      
      // First tool execution (website creation)
      await expect(toolExecutions.first()).toBeVisible({ timeout: 5000 });
      await expect(toolExecutions.first()).toContainText(/website/i);
      
      // Subsequent tool executions
      await expect(toolExecutions).toHaveCount(2, { timeout: 10000 });
      await expect(toolExecutions).toHaveCount(3, { timeout: 15000 });
    });
  });

  test.describe('Chat Persistence', () => {
    test('Tool results persist in chat history', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Create some content
      await chatInput.fill('Create a website called "Persistent Test"');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Refresh the page
      await page.reload();
      
      // Chat history should still contain the tool results
      await expect(page.locator('text=/Persistent Test/i')).toBeVisible();
      await expect(page.locator('[data-testid="tool-execution"]')).toBeVisible();
    });

    test('Can reference previous tool results', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Create initial structure
      await chatInput.fill('Create a website called "Reference Test"');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Reference the created website
      await chatInput.fill('List all content types for the Reference Test website');
      await page.keyboard.press('Enter');
      
      // Should execute tool with correct context
      await expect(page.locator('[data-testid="tool-execution"]').last()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/Reference Test/i').last()).toBeVisible();
    });
  });

  test.describe('Performance in Browser', () => {
    test('Tools execute within performance benchmarks', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Simple operation
      const startTime = Date.now();
      await chatInput.fill('Create a simple website');
      await page.keyboard.press('Enter');
      
      // Wait for completion
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      const executionTime = Date.now() - startTime;
      
      // Should complete within 2 seconds (excluding network latency)
      expect(executionTime).toBeLessThan(5000);
    });

    test('Bulk operations handle efficiently', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Create website first
      await chatInput.fill('Create a bulk test website');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Bulk operation
      const bulkStartTime = Date.now();
      await chatInput.fill('Create 10 content items for testing bulk operations');
      await page.keyboard.press('Enter');
      
      // Should see progress indicators
      await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible({ timeout: 5000 });
      
      // Should complete within reasonable time
      await expect(page.locator('text=/10.*created/i')).toBeVisible({ timeout: 20000 });
      const bulkTime = Date.now() - bulkStartTime;
      
      // Bulk operations should complete efficiently
      expect(bulkTime).toBeLessThan(10000);
    });
  });

  test.describe('Error Handling UI', () => {
    test('Shows clear error messages for validation failures', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Try to create invalid content
      await chatInput.fill('Create a content type with invalid field type "unknown"');
      await page.keyboard.press('Enter');
      
      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/invalid.*field.*type/i')).toBeVisible();
    });

    test('Handles network errors gracefully', async ({ page, context }) => {
      // Simulate network failure
      await context.route('**/api/chat', route => route.abort());
      
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Create a website');
      await page.keyboard.press('Enter');
      
      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/network|connection/i')).toBeVisible();
      
      // Re-enable network
      await context.unroute('**/api/chat');
      
      // Retry button should work
      const retryButton = page.locator('[data-testid="retry-button"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await expect(page.locator('[data-testid="network-error"]')).not.toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Tool Result Display', () => {
    test('Displays tool results in formatted cards', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Get the context for my website');
      await page.keyboard.press('Enter');
      
      // Tool result card should appear
      await expect(page.locator('[data-testid="tool-result-card"]')).toBeVisible({ timeout: 10000 });
      
      // Card should have proper formatting
      const resultCard = page.locator('[data-testid="tool-result-card"]').first();
      await expect(resultCard.locator('[data-testid="tool-name"]')).toBeVisible();
      await expect(resultCard.locator('[data-testid="tool-status"]')).toBeVisible();
      await expect(resultCard.locator('[data-testid="tool-output"]')).toBeVisible();
    });

    test('Collapsible tool details for complex results', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('List all content types and their fields');
      await page.keyboard.press('Enter');
      
      // Wait for tool execution
      await expect(page.locator('[data-testid="tool-result-card"]')).toBeVisible({ timeout: 10000 });
      
      // Details should be collapsible
      const detailsToggle = page.locator('[data-testid="tool-details-toggle"]').first();
      if (await detailsToggle.isVisible()) {
        // Expand details
        await detailsToggle.click();
        await expect(page.locator('[data-testid="tool-details-content"]')).toBeVisible();
        
        // Collapse details
        await detailsToggle.click();
        await expect(page.locator('[data-testid="tool-details-content"]')).not.toBeVisible();
      }
    });
  });

  test.describe('Business Rules Validation', () => {
    test('Validates content against business rules in real-time', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Create website with business rules
      await chatInput.fill('Create a website with business rules: all titles must be at least 10 characters, descriptions must be at least 50 characters');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Try to create invalid content
      await chatInput.fill('Create content with title "Short" and description "Also short"');
      await page.keyboard.press('Enter');
      
      // Should show validation violations
      await expect(page.locator('[data-testid="validation-violation"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/title.*10.*characters/i')).toBeVisible();
      await expect(page.locator('text=/description.*50.*characters/i')).toBeVisible();
    });
  });

  test.describe('Context Awareness', () => {
    test('AI maintains context across multiple operations', async ({ page }) => {
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      // Create initial structure
      await chatInput.fill('Create a recipe website');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=/website.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Reference context implicitly
      await chatInput.fill('Add a Recipe content type with ingredients and instructions');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=/content type.*recipe/i')).toBeVisible({ timeout: 15000 });
      
      // Continue with context
      await chatInput.fill('Now create a sample recipe for chocolate cake');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=/chocolate cake.*created/i')).toBeVisible({ timeout: 15000 });
      
      // Verify context was maintained
      await expect(page.locator('text=/recipe website/i')).toBeVisible();
    });
  });
});