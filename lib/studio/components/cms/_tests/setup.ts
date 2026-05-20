import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import React from 'react';

// ============================================================================
// Global Test Setup
// ============================================================================

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement('img', props);
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => {
  cb(0);
  return 0;
});

// Mock cancelAnimationFrame
global.cancelAnimationFrame = jest.fn();

// ============================================================================
// Performance Testing Utilities
// ============================================================================

export const measureRenderTime = async (
  renderFn: () => void
): Promise<number> => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};

export const measureComponentMemory = (): number => {
  if ('memory' in performance && (performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

// ============================================================================
// Test Data Generators
// ============================================================================

export const generateComponentProps = (overrides = {}) => {
  return {
    id: 'test-component-1',
    type: 'navbar' as any,
    category: 'navigation' as any,
    content: {
      heading: 'Test Heading',
      subheading: 'Test Subheading',
      body: 'Test body content',
    },
    ...overrides,
  };
};

export const generateAIMetadata = (overrides = {}) => {
  return {
    keywords: ['test', 'component'],
    patterns: ['test pattern'],
    commonNames: ['Test Component'],
    pageLocation: ['main'] as any[],
    confidence: 0.9,
    ...overrides,
  };
};

// ============================================================================
// Accessibility Testing Utilities
// ============================================================================

export const checkA11y = async (container: HTMLElement): Promise<string[]> => {
  const violations: string[] = [];
  
  // Check for alt text on images
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    if (!img.getAttribute('alt')) {
      violations.push('Image missing alt text');
    }
  });
  
  // Check for proper heading hierarchy
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let lastLevel = 0;
  headings.forEach(heading => {
    const level = parseInt(heading.tagName[1]);
    if (lastLevel > 0 && level > lastLevel + 1) {
      violations.push(`Heading hierarchy broken: h${lastLevel} to h${level}`);
    }
    lastLevel = level;
  });
  
  // Check for form labels
  const inputs = container.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    if (!id || !container.querySelector(`label[for="${id}"]`)) {
      if (!input.getAttribute('aria-label')) {
        violations.push('Form input missing label');
      }
    }
  });
  
  // Check for button text
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
      violations.push('Button missing accessible text');
    }
  });
  
  return violations;
};

// ============================================================================
// Mock Component Factory
// ============================================================================

export const mockComponentFactory = {
  registerComponent: jest.fn(),
  registerComponents: jest.fn(),
  unregisterComponent: jest.fn(),
  getComponent: jest.fn(),
  loadComponent: jest.fn(),
  preloadComponents: jest.fn(),
  preloadCategory: jest.fn(),
  hasComponent: jest.fn(),
  getComponentMetadata: jest.fn(),
  getRegisteredTypes: jest.fn(),
  getComponentsByCategory: jest.fn(),
  clearCache: jest.fn(),
  clearComponentCache: jest.fn(),
  getCacheStats: jest.fn(),
  createFallbackComponent: jest.fn(),
};

// ============================================================================
// Mock Performance Monitor
// ============================================================================

export const mockPerformanceMonitor = {
  trackComponentRender: jest.fn(),
  trackComponentUpdate: jest.fn(),
  trackBundleSize: jest.fn(),
  trackMemoryUsage: jest.fn(),
  setThresholds: jest.fn(),
  getThresholds: jest.fn(),
  onAlert: jest.fn(),
  setAnalyticsCallback: jest.fn(),
  getMetrics: jest.fn(),
  getAverageMetrics: jest.fn(),
  clearMetrics: jest.fn(),
  generateReport: jest.fn(),
};

// ============================================================================
// Testing Helpers
// ============================================================================

export const waitForAsync = (ms = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createMockEvent = (type: string, options = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true, ...options });
  return event;
};

export const expectToHaveBeenCalledWithPartial = (
  mockFn: jest.Mock,
  partial: Record<string, any>
) => {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining(partial)
  );
};

// ============================================================================
// Component Testing Wrapper
// ============================================================================

export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  );
};

// ============================================================================
// Coverage Utilities
// ============================================================================

export const collectCoverageFrom = [
  'lib/studio/components/cms/**/*.{ts,tsx}',
  '!lib/studio/components/cms/**/*.test.{ts,tsx}',
  '!lib/studio/components/cms/**/*.stories.tsx',
  '!lib/studio/components/cms/_tests/**',
  '!lib/studio/components/cms/_docs/**',
];

export const coverageThreshold = {
  global: {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85,
  },
  'lib/studio/components/cms/_core/': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
};