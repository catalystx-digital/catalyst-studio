import { test, expect } from '@playwright/test';

test.describe('Check JavaScript Execution', () => {
  test('verify app loads and redirects correctly', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log('Browser console:', text);
    });
    
    // Navigate to root
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for potential JavaScript execution
    await page.waitForTimeout(3000);
    
    // Check if React is loaded
    const hasReact = await page.evaluate(() => {
      return typeof (window as any).React !== 'undefined' || 
             typeof (window as any).__NEXT_DATA__ !== 'undefined';
    });
    console.log('React/Next.js detected:', hasReact);
    
    // Check current URL - should redirect to dashboard
    console.log('Final URL:', page.url());
    expect(page.url()).toContain('/dashboard');
  });
});