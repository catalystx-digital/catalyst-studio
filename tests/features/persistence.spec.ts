import { test, expect } from '@playwright/test';

test.describe('Chat Persistence', () => {
  // Features are now permanently enabled, no flags needed

  test('should persist messages across page refresh', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/chat');
    
    // Wait for chat to load
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]', { 
      timeout: 10000 
    });
    
    // Send a test message
    const testMessage = 'Test persistence message ' + Date.now();
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');
    
    // Wait for message to appear
    await page.waitForSelector(`text="${testMessage}"`, { timeout: 5000 });
    
    // Wait for auto-save (debounced 500ms)
    await page.waitForTimeout(1000);
    
    // Refresh the page
    await page.reload();
    
    // Wait for chat to load again
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]', { 
      timeout: 10000 
    });
    
    // Check if message is still present
    await expect(page.locator(`text="${testMessage}"`)).toBeVisible();
  });

  test('should clear storage when requested', async ({ page }) => {
    // Navigate to chat and send a message
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    const testMessage = 'Message to be cleared';
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');
    
    // Wait for message and auto-save
    await page.waitForSelector(`text="${testMessage}"`);
    await page.waitForTimeout(1000);
    
    // Navigate to settings
    await page.goto('/settings');
    
    // Click clear chat history button
    const clearButton = await page.locator('button:has-text("Clear Chat History")');
    await clearButton.click();
    
    // Confirm in dialog
    const confirmButton = await page.locator('button:has-text("Clear History")').last();
    await confirmButton.click();
    
    // Wait for clear to complete
    await page.waitForTimeout(500);
    
    // Navigate back to chat
    await page.goto('/chat');
    
    // Verify message is gone
    await expect(page.locator(`text="${testMessage}"`)).not.toBeVisible();
  });

  // Test removed - persistence is now permanently enabled, cannot be disabled

  test('should handle storage quota exceeded gracefully', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    // Fill storage to simulate quota exceeded
    await page.evaluate(() => {
      try {
        // Try to fill localStorage
        const largeData = 'x'.repeat(1024 * 1024); // 1MB string
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`test-fill-${i}`, largeData);
        }
      } catch (e) {
        // Expected to fail when quota exceeded
      }
    });
    
    // Try to send a message
    const testMessage = 'Message during quota exceeded';
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    await chatInput.fill(testMessage);
    await chatInput.press('Enter');
    
    // Should still work (fallback to memory storage)
    await page.waitForSelector(`text="${testMessage}"`);
    
    // Clean up
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        localStorage.removeItem(`test-fill-${i}`);
      }
    });
  });

  test('should export and import chat history', async ({ page }) => {
    // Navigate to chat and send messages
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    const messages = ['Export test 1', 'Export test 2', 'Export test 3'];
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    
    for (const msg of messages) {
      await chatInput.fill(msg);
      await chatInput.press('Enter');
      await page.waitForSelector(`text="${msg}"`);
    }
    
    // Wait for auto-save
    await page.waitForTimeout(1000);
    
    // Navigate to settings
    await page.goto('/settings');
    
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    const exportButton = await page.locator('button:has-text("Export Chat History")');
    await exportButton.click();
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify download filename contains 'catalyst-chat'
    expect(download.suggestedFilename()).toContain('catalyst-chat');
    
    // Save the file to read it back
    const path = await download.path();
    expect(path).toBeTruthy();
    
    // Clear chat history
    const clearButton = await page.locator('button:has-text("Clear Chat History")');
    await clearButton.click();
    const confirmButton = await page.locator('button:has-text("Clear History")').last();
    await confirmButton.click();
    await page.waitForTimeout(500);
    
    // Import the file back
    const fileInput = await page.locator('input[type="file"]');
    if (path) {
      await fileInput.setInputFiles(path);
    }
    
    // Navigate back to chat
    await page.goto('/chat');
    
    // Verify messages are restored
    for (const msg of messages) {
      await expect(page.locator(`text="${msg}"`)).toBeVisible();
    }
  });
});

// Performance tests
test.describe('Persistence Performance', () => {
  test('should save messages within 100ms', async ({ page }) => {
    // Features are permanently enabled, no flags needed
    
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    // Monitor console for performance warnings
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && msg.text().includes('Storage Performance')) {
        warnings.push(msg.text());
      }
    });
    
    // Send multiple messages
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    for (let i = 0; i < 5; i++) {
      await chatInput.fill(`Performance test message ${i}`);
      await chatInput.press('Enter');
      await page.waitForTimeout(200); // Small delay between messages
    }
    
    // Wait for all saves to complete
    await page.waitForTimeout(1000);
    
    // Check if any performance warnings were logged
    expect(warnings.length).toBe(0);
  });

  test('should handle rapid message sending', async ({ page }) => {
    // Features are permanently enabled, no flags needed
    
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    // Send messages rapidly
    const chatInput = await page.locator('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    const rapidMessages = Array.from({ length: 10 }, (_, i) => `Rapid message ${i}`);
    
    for (const msg of rapidMessages) {
      await chatInput.fill(msg);
      await chatInput.press('Enter');
      // No delay - rapid sending
    }
    
    // Wait for debounced save
    await page.waitForTimeout(1500);
    
    // Refresh and verify all messages persisted
    await page.reload();
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Message"], input[placeholder*="Message"]');
    
    // Check last few messages are present
    for (let i = 7; i < 10; i++) {
      await expect(page.locator(`text="Rapid message ${i}"`)).toBeVisible();
    }
  });
});