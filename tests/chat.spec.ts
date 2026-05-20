import { test, expect } from '@playwright/test';

/**
 * Snapshot test for existing chat functionality
 * Created as protection before brownfield enhancement
 * This test documents and verifies the current working behavior
 */

test.describe('Existing Chat Functionality Protection Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with fresh page for each test
    await page.goto('http://localhost:3000/chat');
  });

  test('chat page loads successfully', async ({ page }) => {
    // Verify the chat page loads
    await expect(page).toHaveTitle(/Catalyst Studio/);
    
    // Check for main chat elements
    const chatContainer = page.locator('.max-w-4xl');
    await expect(chatContainer).toBeVisible();
    
    // Verify AI Assistant header
    const header = page.locator('text=AI Assistant');
    await expect(header).toBeVisible();
  });

  test('chat interface has all required elements', async ({ page }) => {
    // Check for input field
    const input = page.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
    
    // Check for send button
    const sendButton = page.locator('button[type="submit"]');
    await expect(sendButton).toBeVisible();
    
    // Check for message area
    const scrollArea = page.locator('[class*="ScrollArea"]');
    await expect(scrollArea).toBeVisible();
    
    // Check for initial message
    const initialMessage = page.locator('text=Start a conversation');
    await expect(initialMessage).toBeVisible();
  });

  test('can send a message', async ({ page }) => {
    // Type a test message
    const input = page.locator('input[type="text"]');
    await input.fill('Hello, this is a test message');
    
    // Send the message
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();
    
    // Verify message appears in chat
    const userMessage = page.locator('text=Hello, this is a test message');
    await expect(userMessage).toBeVisible();
    
    // Verify user icon appears
    const userIcon = page.locator('[class*="User"]').first();
    await expect(userIcon).toBeVisible();
  });

  test('shows loading state while AI responds', async ({ page }) => {
    // Send a message
    const input = page.locator('input[type="text"]');
    await input.fill('Test message for loading state');
    
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();
    
    // Check that input is disabled during response
    await expect(input).toBeDisabled();
    
    // Note: Actual API response testing would require mocking
    // This test documents the expected loading behavior
  });

  test('preserves chat history in session', async ({ page }) => {
    // Send first message
    const input = page.locator('input[type="text"]');
    await input.fill('First message');
    await page.locator('button[type="submit"]').click();
    
    // Wait for message to appear
    await expect(page.locator('text=First message')).toBeVisible();
    
    // Send second message
    await input.fill('Second message');
    await page.locator('button[type="submit"]').click();
    
    // Both messages should be visible
    await expect(page.locator('text=First message')).toBeVisible();
    await expect(page.locator('text=Second message')).toBeVisible();
  });

  test('responsive design works', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const chatContainer = page.locator('.max-w-4xl');
    await expect(chatContainer).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(chatContainer).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(chatContainer).toBeVisible();
  });
});

/**
 * Performance Baseline Tests
 * Document current performance for comparison after changes
 */
test.describe('Performance Baselines', () => {
  test('page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:3001/chat');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Document current load time (should be under 2000ms)
    console.log(`Current page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000); // Allow some margin
  });

  test('chat interaction performance', async ({ page }) => {
    await page.goto('http://localhost:3001/chat');
    
    const input = page.locator('input[type="text"]');
    const sendButton = page.locator('button[type="submit"]');
    
    // Measure input responsiveness
    const typeStartTime = Date.now();
    await input.fill('Performance test message');
    const typeEndTime = Date.now();
    
    const typeTime = typeEndTime - typeStartTime;
    console.log(`Input typing time: ${typeTime}ms`);
    expect(typeTime).toBeLessThan(500);
  });
});