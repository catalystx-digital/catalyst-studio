import { test, expect } from '@playwright/test';

test.describe('Debug Routing', () => {
  test('check what happens on root page', async ({ page }) => {
    // Enable console logging with more detail
    page.on('console', msg => console.log(`Console [${msg.type()}]:`, msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    page.on('requestfailed', request => console.log('Request failed:', request.url(), request.failure()?.errorText));
    
    // Navigate to root with extended timeout
    const response = await page.goto('/', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    console.log('Response status:', response?.status());
    console.log('Response headers:', await response?.allHeaders());
    
    // Wait for any async operations to complete
    await page.waitForTimeout(3000);
    
    // Get current URL
    const currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);
    
    // Get page content
    const content = await page.content();
    console.log('Page content length:', content.length);
    console.log('Page title:', await page.title());
    
    // Check if there's any visible text with error handling
    try {
      const bodyText = await page.locator('body').innerText({ timeout: 5000 });
      console.log('Body text length:', bodyText.length);
      console.log('Body text preview:', bodyText.substring(0, 200));
    } catch (error) {
      console.log('Error getting body text:', error);
    }
    
    // Check for specific elements
    const hasHeader = await page.locator('h1, h2, header').first().isVisible().catch(() => false);
    const hasMain = await page.locator('main').isVisible().catch(() => false);
    const hasNav = await page.locator('nav').isVisible().catch(() => false);
    console.log('Has header:', hasHeader, 'Has main:', hasMain, 'Has nav:', hasNav);
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'debug-root-page.png',
      fullPage: true 
    });
    
    // Check that the page actually loaded something useful
    expect(content.length).toBeGreaterThan(100);
    expect(currentUrl).toMatch(/\/(dashboard|studio)/);
  });
  
  test('check network requests and loading states', async ({ page }) => {
    const requests: string[] = [];
    const responses: { url: string; status: number }[] = [];
    
    // Track network activity
    page.on('request', request => {
      requests.push(request.url());
      console.log('Request:', request.method(), request.url());
    });
    
    page.on('response', response => {
      responses.push({ url: response.url(), status: response.status() });
      console.log('Response:', response.status(), response.url());
    });
    
    // Navigate and track
    await page.goto('/', { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    
    // Log summary
    console.log('Total requests:', requests.length);
    console.log('Failed responses:', responses.filter(r => r.status >= 400).length);
    
    // Basic assertions
    expect(requests.length).toBeGreaterThan(0);
    expect(responses.filter(r => r.status < 400).length).toBeGreaterThan(0);
  });
});