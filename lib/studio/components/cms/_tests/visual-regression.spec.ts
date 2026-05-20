import { test, expect } from '@playwright/test';
import path from 'path';

// ============================================================================
// Visual Regression Test Configuration
// ============================================================================

// Component categories to test
const COMPONENT_CATEGORIES = [
  'navigation',
  'heroes',
  'content',
  'features',
  'cta',
  'social-proof',
  'contact',
  'about',
  'blog',
  'pricing',
  'data'
];

// Viewport configurations
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 }
];

// Theme configurations
const THEMES = ['light', 'dark'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Storybook URL for a component
 */
function getStorybookUrl(category: string, component: string, story: string = 'default'): string {
  const baseUrl = process.env.STORYBOOK_URL || 'http://localhost:6006';
  const storyPath = `iframe.html?id=studio-cms-${category}-${component}--${story}&viewMode=story`;
  return `${baseUrl}/${storyPath}`;
}

/**
 * Wait for component to be fully loaded
 */
async function waitForComponentLoad(page: any): Promise<void> {
  // Wait for any animations to complete
  await page.waitForTimeout(500);
  
  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  
  // Wait for images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        }))
    );
  });
}

/**
 * Setup page for visual testing
 */
async function setupPage(page: any): Promise<void> {
  // Disable animations
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
  
  // Hide scrollbars
  await page.addStyleTag({
    content: `
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
      }
    `
  });
  
  // Ensure consistent font rendering
  await page.addStyleTag({
    content: `
      * {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
    `
  });
}

// ============================================================================
// Visual Regression Tests
// ============================================================================

test.describe('CMS Component Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Setup page for consistent visual testing
    await setupPage(page);
  });

  // Test each component category
  COMPONENT_CATEGORIES.forEach(category => {
    test.describe(`${category} components`, () => {
      // Test across different viewports
      VIEWPORTS.forEach(viewport => {
        test(`${category} - ${viewport.name} viewport`, async ({ page }) => {
          // Set viewport
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height
          });

          // Navigate to component story
          const url = getStorybookUrl(category, 'example', 'default');
          await page.goto(url);

          // Wait for component to load
          await waitForComponentLoad(page);

          // Take screenshot
          const screenshot = await page.screenshot({
            fullPage: false,
            animations: 'disabled'
          });

          // Compare with baseline
          expect(screenshot).toMatchSnapshot([
            'cms-components',
            category,
            viewport.name,
            'default.png'
          ]);
        });
      });

      // Test across different themes
      THEMES.forEach(theme => {
        test(`${category} - ${theme} theme`, async ({ page }) => {
          // Set desktop viewport for theme testing
          await page.setViewportSize({
            width: 1920,
            height: 1080
          });

          // Navigate to component story with theme
          const url = getStorybookUrl(category, 'example', theme + '-theme');
          await page.goto(url);

          // Apply theme
          await page.evaluate((theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            }
          }, theme);

          // Wait for component to load
          await waitForComponentLoad(page);

          // Take screenshot
          const screenshot = await page.screenshot({
            fullPage: false,
            animations: 'disabled'
          });

          // Compare with baseline
          expect(screenshot).toMatchSnapshot([
            'cms-components',
            category,
            'theme',
            `${theme}.png`
          ]);
        });
      });
    });
  });

  // Test component interactions
  test.describe('Interactive Components', () => {
    test('navigation menu - hover states', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('navigation', 'navbar', 'interactive');
      await page.goto(url);
      await waitForComponentLoad(page);

      // Hover over menu item
      const menuItem = page.locator('.cms-nav-item').first();
      await menuItem.hover();
      await page.waitForTimeout(100);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'navigation',
        'interactions',
        'hover.png'
      ]);
    });

    test('cta button - click states', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('cta', 'cta-simple', 'interactive');
      await page.goto(url);
      await waitForComponentLoad(page);

      // Click button
      const button = page.locator('.cms-cta-button').first();
      await button.click();
      await page.waitForTimeout(100);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'cta',
        'interactions',
        'clicked.png'
      ]);
    });

    test('accordion - expanded state', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('content', 'accordion', 'interactive');
      await page.goto(url);
      await waitForComponentLoad(page);

      // Expand accordion item
      const accordionTrigger = page.locator('.cms-accordion-trigger').first();
      await accordionTrigger.click();
      await page.waitForTimeout(100);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'content',
        'interactions',
        'expanded.png'
      ]);
    });
  });

  // Test accessibility states
  test.describe('Accessibility States', () => {
    test('focus states', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('contact', 'contact-form', 'default');
      await page.goto(url);
      await waitForComponentLoad(page);

      // Focus on input field
      const input = page.locator('input[type="text"]').first();
      await input.focus();
      await page.waitForTimeout(100);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'accessibility',
        'focus',
        'input-focused.png'
      ]);
    });

    test('error states', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('contact', 'contact-form', 'error-state');
      await page.goto(url);
      await waitForComponentLoad(page);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'accessibility',
        'states',
        'error.png'
      ]);
    });

    test('loading states', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('data', 'data-table', 'loading');
      await page.goto(url);
      await waitForComponentLoad(page);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'accessibility',
        'states',
        'loading.png'
      ]);
    });
  });
});

// ============================================================================
// Performance Visual Tests
// ============================================================================

test.describe('Performance Visual Tests', () => {
  test('component render performance', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to performance test page
    const url = getStorybookUrl('features', 'feature-grid', 'performance-test');
    await page.goto(url);

    // Measure render time
    const renderTime = await page.evaluate(() => {
      const start = performance.now();
      // Force re-render
      const root = document.querySelector('#storybook-root');
      if (root) {
        root.innerHTML = '';
        // Trigger React re-render
        window.dispatchEvent(new Event('resize'));
      }
      return performance.now() - start;
    });

    // Assert render time is within threshold
    expect(renderTime).toBeLessThan(50);

    // Take screenshot after performance test
    await waitForComponentLoad(page);
    const screenshot = await page.screenshot({
      fullPage: false,
      animations: 'disabled'
    });

    expect(screenshot).toMatchSnapshot([
      'cms-components',
      'performance',
      'render-test.png'
    ]);
  });
});

// ============================================================================
// Cross-browser Visual Tests
// ============================================================================

['chromium', 'firefox', 'webkit'].forEach(browserName => {
  test.describe(`Cross-browser: ${browserName}`, () => {
    test.use({ browserName: browserName as any });

    test(`hero component - ${browserName}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const url = getStorybookUrl('heroes', 'hero-simple', 'default');
      await page.goto(url);
      await waitForComponentLoad(page);

      const screenshot = await page.screenshot({
        fullPage: false,
        animations: 'disabled'
      });

      expect(screenshot).toMatchSnapshot([
        'cms-components',
        'cross-browser',
        browserName,
        'hero.png'
      ]);
    });
  });
});