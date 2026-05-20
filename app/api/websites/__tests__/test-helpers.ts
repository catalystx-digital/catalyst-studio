/**
 * Test setup for Next.js API routes
 * Provides mock implementations for Next.js server components
 */
import { NextRequest } from 'next/server';

// Suppress console.error during tests for expected errors
let originalConsoleError: typeof console.error;

export function suppressConsoleError() {
  originalConsoleError = console.error;
  console.error = (() => {});
}

export function restoreConsoleError() {
  if (originalConsoleError) {
    console.error = originalConsoleError;
  }
}

// Mock NextRequest for tests
export class MockNextRequest {
  private body: Record<string, unknown> | undefined;
  private _url: string;
  private _method: string;
  private headers: Headers;
  
  constructor(url: string, init?: { body?: Record<string, unknown>; method?: string; headers?: Record<string, string> }) {
    this._url = url;
    this._method = init?.method || 'GET';
    this.body = init?.body;
    this.headers = new Headers(init?.headers || {});
  }
  
  async json() {
    if (!this.body) {
      throw new Error('No body');
    }
    return this.body;
  }
  
  get url() {
    return this._url;
  }
  
  get method() {
    return this._method;
  }
  
  get nextUrl() {
    return new URL(this._url);
  }
}

// Create test request helper that returns a proper NextRequest-like object
export function createTestRequest(
  body?: Record<string, unknown>, 
  url = 'http://localhost:3000/api/websites',
  method = 'POST'
): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json'
  });
  
  const init: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };
  
  // Create a proper Request object and cast to NextRequest
  const request = new Request(url, init) as NextRequest;
  
  // Mock additional NextRequest properties if needed
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false
  });
  
  return request;
}

// Create test params helper for dynamic routes
export function createTestParams(params: Record<string, string>): Promise<Record<string, string>> {
  return Promise.resolve(params);
}

// Parse test response
export async function parseTestResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}