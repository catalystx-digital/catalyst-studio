// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import dotenv from 'dotenv'
import { toHaveNoViolations } from 'jest-axe'
import { TextEncoder, TextDecoder } from 'util'

// Add jest-axe matchers for accessibility testing
expect.extend(toHaveNoViolations)

// Mock next/image to handle priority prop correctly
jest.mock('next/image', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: function Image(props) {
      // Filter out Next.js specific props that shouldn't go to img element
      const { priority, placeholder, blurDataURL, loader, quality, ...imgProps } = props
      // eslint-disable-next-line jsx-a11y/alt-text
      return React.createElement('img', imgProps)
    },
  }
})

// Load test environment variables from .env.test
dotenv.config({ path: '.env.test' })

// Ensure test environment is set
process.env.NODE_ENV = 'test'

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
}

// Add setImmediate polyfill for Prisma compatibility
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

// Mock window.matchMedia when the DOM is available
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock URL.createObjectURL and URL.revokeObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = jest.fn();
}

// Mock Next.js server components for tests
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }

    static json(data, init) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init?.headers || {})
        }
      });
    }
  };
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, init) {
      // Use Object.defineProperty for readonly properties
      Object.defineProperty(this, 'url', {
        value: url,
        writable: false,
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(this, 'method', {
        value: init?.method || 'GET',
        writable: false,
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(this, 'headers', {
        value: new Map(Object.entries(init?.headers || {})),
        writable: false,
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(this, 'body', {
        value: init?.body,
        writable: false,
        enumerable: true,
        configurable: true
      });
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }
  };
}
