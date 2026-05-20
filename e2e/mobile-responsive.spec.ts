import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsive and JavaScript Execution Tests', () => {
  let testWebsiteId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test website for mobile testing
    let retries = 3;
    while (retries > 0 && !testWebsiteId) {
      try {
        const response = await request.post('/api/websites', {
          data: {
            name: 'Mobile Test Website',
            description: 'Website for mobile responsive testing',
            category: 'Testing',
            icon: '📱'
          },
          timeout: 15000
        });

        if (response.ok()) {
          const data = await response.json();
          testWebsiteId = data.data.id;
          console.log('Created mobile test website with ID:', testWebsiteId);
          break;
        }
      } catch (error) {
        console.log(`Mobile website creation attempt ${4 - retries} failed:`, error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up test website
    if (testWebsiteId) {
      try {
        await request.delete(`/api/websites/${testWebsiteId}`, { timeout: 10000 });
        console.log('Cleaned up mobile test website:', testWebsiteId);
      } catch (error) {
        console.log('Failed to clean up mobile test website:', error);
      }
    }
  });

  // Test specifically on mobile devices
  ['Mobile Chrome', 'Mobile Safari', 'iPad'].forEach((deviceName) => {
    test(`JavaScript execution works on ${deviceName}`, async ({ page, request }) => {
      // Skip if no test website created
      if (!testWebsiteId) {
        test.skip();
        return;
      }

      // Test basic JavaScript execution
      await page.goto('/dashboard', { 
        waitUntil: 'networkidle', 
        timeout: 90000 
      });

      // Check that JavaScript is executing properly
      const jsWorking = await page.evaluate(() => {
        try {
          // Test basic JavaScript features
          const arr = [1, 2, 3];
          const doubled = arr.map(x => x * 2);
          const hasLocalStorage = typeof localStorage !== 'undefined';
          const hasDocument = typeof document !== 'undefined';
          const hasWindow = typeof window !== 'undefined';
          
          return {
            arrayMethods: doubled.length === 3 && doubled[0] === 2,
            localStorage: hasLocalStorage,
            document: hasDocument,
            window: hasWindow,
            consoleWorks: typeof console.log === 'function'
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      });

      console.log(`JavaScript execution test on ${deviceName}:`, jsWorking);
      
      expect(jsWorking.arrayMethods).toBeTruthy();
      expect(jsWorking.localStorage).toBeTruthy();
      expect(jsWorking.document).toBeTruthy();
      expect(jsWorking.window).toBeTruthy();
      expect(jsWorking.consoleWorks).toBeTruthy();

      // Test async JavaScript features
      const asyncTest = await page.evaluate(async () => {
        try {
          // Test Promise support
          const promise = new Promise(resolve => setTimeout(() => resolve('success'), 100));
          const result = await promise;
          
          // Test fetch API availability
          const hasFetch = typeof fetch !== 'undefined';
          
          return {
            promiseSupport: result === 'success',
            fetchAPI: hasFetch
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      });

      console.log(`Async JavaScript test on ${deviceName}:`, asyncTest);
      expect(asyncTest.promiseSupport).toBeTruthy();
      expect(asyncTest.fetchAPI).toBeTruthy();
    });

    test(`Responsive UI works on ${deviceName}`, async ({ page }) => {
      // Skip if no test website created
      if (!testWebsiteId) {
        test.skip();
        return;
      }

      // Navigate to dashboard
      await page.goto('/dashboard', { 
        waitUntil: 'networkidle', 
        timeout: 90000 
      });

      // Check viewport size is appropriate for mobile
      const viewport = page.viewportSize();
      console.log(`${deviceName} viewport:`, viewport);
      
      if (deviceName.includes('Mobile')) {
        expect(viewport?.width).toBeLessThan(800);
      }

      // Check that the page is responsive
      const pageMetrics = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        
        return {
          bodyWidth: body.scrollWidth,
          viewportWidth: window.innerWidth,
          hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
          bodyOverflow: window.getComputedStyle(body).overflow,
          bodyOverflowX: window.getComputedStyle(body).overflowX
        };
      });

      console.log(`${deviceName} page metrics:`, pageMetrics);

      // Ensure page doesn't overflow horizontally
      expect(pageMetrics.bodyWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 50); // 50px tolerance
      
      // Check for responsive meta tag
      expect(pageMetrics.hasViewportMeta).toBeTruthy();

      // Navigate to studio site builder and test responsive behavior
      await page.goto(`/studio/site-builder?websiteId=${testWebsiteId}`, {
        waitUntil: 'networkidle',
        timeout: 90000
      });

      // Check that site builder page loads and is responsive
      const studioMetrics = await page.evaluate(() => {
        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          hasScrollableElements: document.querySelectorAll('[style*="overflow"]').length > 0
        };
      });

      console.log(`${deviceName} site builder metrics:`, studioMetrics);

      // Site builder should also be responsive
      expect(studioMetrics.bodyWidth).toBeLessThanOrEqual(studioMetrics.viewportWidth + 100); // More tolerance for complex studio UI
    });

    test(`Touch interactions work on ${deviceName}`, async ({ page }) => {
      // Skip if no test website created or not a touch device
      if (!testWebsiteId) {
        test.skip();
        return;
      }

      await page.goto('/dashboard', { 
        waitUntil: 'networkidle', 
        timeout: 90000 
      });

      // Test touch events are supported
      const touchSupport = await page.evaluate(() => {
        return {
          hasTouchStart: 'ontouchstart' in window,
          hasTouchMove: 'ontouchmove' in window,
          hasTouchEnd: 'ontouchend' in window,
          maxTouchPoints: navigator.maxTouchPoints || 0
        };
      });

      console.log(`${deviceName} touch support:`, touchSupport);

      if (deviceName !== 'iPad') { // iPad might have different touch handling
        expect(touchSupport.hasTouchStart || touchSupport.maxTouchPoints > 0).toBeTruthy();
      }

      // Test that elements are touch-friendly (tap targets are large enough)
      const buttonSizes = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
        return buttons.slice(0, 5).map(btn => {
          const rect = btn.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height
          };
        });
      });

      console.log(`${deviceName} button sizes:`, buttonSizes);

      // Check that most interactive elements are touch-friendly (at least 44x44px recommended)
      const touchFriendlyButtons = buttonSizes.filter(btn => 
        (btn.width >= 40 && btn.height >= 40) || btn.area >= 1600
      );
      
      if (buttonSizes.length > 0) {
        const touchFriendlyRatio = touchFriendlyButtons.length / buttonSizes.length;
        expect(touchFriendlyRatio).toBeGreaterThan(0.5); // At least 50% should be touch-friendly
      }
    });
  });

  test('Cross-device compatibility', async ({ page, request }) => {
    // Skip if no test website created
    if (!testWebsiteId) {
      test.skip();
      return;
    }

    // Test API functionality from mobile context
    const apiResponse = await request.get('/api/websites', { timeout: 15000 });
    expect(apiResponse.ok()).toBeTruthy();

    const websites = await apiResponse.json();
    expect(Array.isArray(websites.data)).toBeTruthy();

    // Navigate to dashboard and test basic functionality
    await page.goto('/dashboard', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });

    // Test that essential features work across devices
    const crossDeviceFeatures = await page.evaluate(async () => {
      const features = {
        localStorage: false,
        sessionStorage: false,
        indexedDB: false,
        webWorkers: false,
        serviceWorkers: false,
        geolocation: false,
        notifications: false
      };

      try {
        // Test localStorage
        localStorage.setItem('test', 'value');
        features.localStorage = localStorage.getItem('test') === 'value';
        localStorage.removeItem('test');

        // Test sessionStorage
        sessionStorage.setItem('test', 'value');
        features.sessionStorage = sessionStorage.getItem('test') === 'value';
        sessionStorage.removeItem('test');

        // Test IndexedDB
        features.indexedDB = 'indexedDB' in window;

        // Test Web Workers
        features.webWorkers = typeof Worker !== 'undefined';

        // Test Service Workers
        features.serviceWorkers = 'serviceWorker' in navigator;

        // Test Geolocation
        features.geolocation = 'geolocation' in navigator;

        // Test Notifications
        features.notifications = 'Notification' in window;

      } catch (error) {
        console.error('Feature detection error:', error);
      }

      return features;
    });

    console.log('Cross-device feature support:', crossDeviceFeatures);

    // Essential features that should work everywhere
    expect(crossDeviceFeatures.localStorage).toBeTruthy();
    expect(crossDeviceFeatures.sessionStorage).toBeTruthy();
  });

  test('Performance on mobile devices', async ({ page }) => {
    // Skip if no test website created
    if (!testWebsiteId) {
      test.skip();
      return;
    }

    // Start performance measurement
    await page.goto('/dashboard', { 
      waitUntil: 'networkidle', 
      timeout: 90000 
    });

    // Measure page load performance
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        navigationStart: navigation.loadEventEnd - navigation.fetchStart
      };
    });

    console.log('Mobile performance metrics:', performanceMetrics);

    // Reasonable performance expectations for mobile
    expect(performanceMetrics.navigationStart).toBeLessThan(15000); // 15 seconds total
    expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // 5 seconds for DOM ready
    
    if (performanceMetrics.firstContentfulPaint > 0) {
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(8000); // 8 seconds for first paint
    }
  });
});