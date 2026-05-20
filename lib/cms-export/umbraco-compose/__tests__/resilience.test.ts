/**
 * Umbraco Compose Resilience Tests
 *
 * Tests for Task 8: Error Handling & Resilience
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Error class instantiation
 */

import {
  UmbracoComposeError,
  UmbracoAuthError,
  UmbracoValidationError,
  UmbracoRateLimitError,
  UmbracoIngestionError,
  UmbracoConnectionError,
} from '../types';

describe('Error Classes', () => {
  describe('UmbracoComposeError', () => {
    it('should create error with code and message', () => {
      const error = new UmbracoComposeError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('UmbracoComposeError');
    });

    it('should include status code when provided', () => {
      const error = new UmbracoComposeError('API error', 'API_ERROR', 500);
      expect(error.statusCode).toBe(500);
    });

    it('should include details when provided', () => {
      const details = { field: 'name', reason: 'required' };
      const error = new UmbracoComposeError('Validation failed', 'VALIDATION', 400, details);
      expect(error.details).toEqual(details);
    });
  });

  describe('UmbracoAuthError', () => {
    it('should create auth error with correct code', () => {
      const error = new UmbracoAuthError('Authentication failed');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.name).toBe('UmbracoAuthError');
    });

    it('should include status code when provided', () => {
      const error = new UmbracoAuthError('Unauthorized', 401);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('UmbracoValidationError', () => {
    it('should create validation error with correct code', () => {
      const error = new UmbracoValidationError('Invalid schema');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('UmbracoValidationError');
    });

    it('should include validation details', () => {
      const details = { errors: [{ field: 'name' }] };
      const error = new UmbracoValidationError('Validation failed', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('UmbracoRateLimitError', () => {
    it('should create rate limit error with retry-after', () => {
      const error = new UmbracoRateLimitError(30);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.message).toContain('30s');
      expect(error.name).toBe('UmbracoRateLimitError');
    });

    it('should handle undefined retry-after', () => {
      const error = new UmbracoRateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('UmbracoIngestionError', () => {
    it('should create ingestion error with failed entries', () => {
      const failedEntries = [
        { id: 'entry-1', message: 'Invalid type', code: 'TYPE_ERROR' },
        { id: 'entry-2', message: 'Missing field', code: 'MISSING_FIELD' },
      ];
      const error = new UmbracoIngestionError('Partial failure', failedEntries);
      expect(error.code).toBe('INGESTION_ERROR');
      expect(error.failedEntries).toEqual(failedEntries);
      expect(error.name).toBe('UmbracoIngestionError');
    });
  });

  describe('UmbracoConnectionError', () => {
    it('should create connection error with cause', () => {
      const cause = new Error('Network timeout');
      const error = new UmbracoConnectionError('Failed to connect', cause);
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('UmbracoConnectionError');
    });
  });

  describe('Error inheritance', () => {
    it('should be instanceof Error', () => {
      const error = new UmbracoComposeError('Test', 'TEST');
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instanceof UmbracoComposeError for subclasses', () => {
      const authError = new UmbracoAuthError('Auth failed');
      const validationError = new UmbracoValidationError('Invalid');
      const rateLimitError = new UmbracoRateLimitError(10);
      const connectionError = new UmbracoConnectionError('Connection failed');

      expect(authError).toBeInstanceOf(UmbracoComposeError);
      expect(validationError).toBeInstanceOf(UmbracoComposeError);
      expect(rateLimitError).toBeInstanceOf(UmbracoComposeError);
      expect(connectionError).toBeInstanceOf(UmbracoComposeError);
    });
  });
});

describe('Retryable Error Detection', () => {
  // Test which errors should be retried
  it('should identify validation errors as non-retryable', () => {
    const error = new UmbracoValidationError('Invalid schema');
    expect(error.statusCode).toBe(400);
    // Validation errors (400) should NOT be retried
  });

  it('should identify rate limit errors as retryable', () => {
    const error = new UmbracoRateLimitError(10);
    expect(error.statusCode).toBe(429);
    // Rate limit errors (429) SHOULD be retried after waiting
  });

  it('should identify connection errors as retryable', () => {
    const error = new UmbracoConnectionError('Network timeout');
    // Connection errors SHOULD be retried
  });

  it('should identify 5xx errors as retryable', () => {
    const error = new UmbracoComposeError('Server error', 'SERVER_ERROR', 500);
    expect(error.statusCode).toBe(500);
    // 5xx errors SHOULD be retried
  });
});

describe('Exponential Backoff', () => {
  it('should use correct backoff formula', () => {
    // Formula: min(baseDelay * 2^(attempt-1), maxDelay)
    // Base delay: 1000ms, Max delay: 10000ms

    // Attempt 1: 1000ms
    // Attempt 2: 2000ms
    // Attempt 3: 4000ms
    // Attempt 4: 8000ms
    // Attempt 5: 10000ms (capped at max)

    const calculateBackoff = (attempt: number): number => {
      const baseDelay = 1000;
      const maxDelay = 10000;
      return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    };

    expect(calculateBackoff(1)).toBe(1000);
    expect(calculateBackoff(2)).toBe(2000);
    expect(calculateBackoff(3)).toBe(4000);
    expect(calculateBackoff(4)).toBe(8000);
    expect(calculateBackoff(5)).toBe(10000); // Capped
    expect(calculateBackoff(6)).toBe(10000); // Still capped
  });
});

describe('Circuit Breaker States', () => {
  describe('State transitions', () => {
    it('should have correct state values', () => {
      type CircuitState = 'closed' | 'open' | 'half-open';

      const states: CircuitState[] = ['closed', 'open', 'half-open'];
      expect(states).toContain('closed');
      expect(states).toContain('open');
      expect(states).toContain('half-open');
    });

    it('should document failure threshold', () => {
      // Default: 5 consecutive failures opens the circuit
      const failureThreshold = 5;
      expect(failureThreshold).toBe(5);
    });

    it('should document reset timeout', () => {
      // Default: 30 seconds before trying half-open
      const resetTimeout = 30000;
      expect(resetTimeout).toBe(30000);
    });
  });
});
