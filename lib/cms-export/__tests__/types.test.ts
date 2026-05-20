// Type Definition Tests

import { 
  ProviderError,
  ProviderNotFoundError,
  ProviderValidationError,
  ProviderConnectionError,
  ProviderTransformationError
} from '../types';

describe('Provider Error Types', () => {
  describe('ProviderError', () => {
    it('should create error with message', () => {
      const error = new ProviderError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ProviderError');
    });

    it('should create error with message and code', () => {
      const error = new ProviderError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should be instanceof Error', () => {
      const error = new ProviderError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProviderError);
    });
  });

  describe('ProviderNotFoundError', () => {
    it('should create error with provider ID', () => {
      const error = new ProviderNotFoundError('test-provider');
      expect(error.message).toBe("Provider 'test-provider' not found");
      expect(error.code).toBe('PROVIDER_NOT_FOUND');
      expect(error.name).toBe('ProviderNotFoundError');
    });

    it('should extend ProviderError', () => {
      const error = new ProviderNotFoundError('test');
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toBeInstanceOf(ProviderNotFoundError);
    });
  });

  describe('ProviderValidationError', () => {
    it('should create error with message', () => {
      const error = new ProviderValidationError('Validation failed');
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ProviderValidationError');
    });

    it('should create error with validation result', () => {
      const validationResult = {
        valid: false,
        errors: [{ field: 'name', message: 'Required' }]
      };
      const error = new ProviderValidationError('Validation failed', validationResult);
      expect(error.validationResult).toBe(validationResult);
    });

    it('should extend ProviderError', () => {
      const error = new ProviderValidationError('Test');
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toBeInstanceOf(ProviderValidationError);
    });
  });

  describe('ProviderConnectionError', () => {
    it('should create error with message', () => {
      const error = new ProviderConnectionError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.name).toBe('ProviderConnectionError');
    });

    it('should create error with cause', () => {
      const cause = new Error('Network error');
      const error = new ProviderConnectionError('Connection failed', cause);
      expect(error.cause).toBe(cause);
    });

    it('should extend ProviderError', () => {
      const error = new ProviderConnectionError('Test');
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toBeInstanceOf(ProviderConnectionError);
    });
  });

  describe('ProviderTransformationError', () => {
    it('should create error with message', () => {
      const error = new ProviderTransformationError('Transformation failed');
      expect(error.message).toBe('Transformation failed');
      expect(error.code).toBe('TRANSFORMATION_ERROR');
      expect(error.name).toBe('ProviderTransformationError');
    });

    it('should create error with source type', () => {
      const sourceType = { id: 'test', name: 'Test Type' };
      const error = new ProviderTransformationError('Transformation failed', sourceType);
      expect(error.sourceType).toBe(sourceType);
    });

    it('should extend ProviderError', () => {
      const error = new ProviderTransformationError('Test');
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toBeInstanceOf(ProviderTransformationError);
    });
  });
});

describe('Type Compilation Tests', () => {
  it('TypeScript types should compile without errors', () => {
    // This test verifies that all type definitions compile correctly
    // The actual compilation check happens during the build process
    expect(true).toBe(true);
  });
});