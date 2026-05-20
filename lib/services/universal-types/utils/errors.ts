/**
 * Custom Error Types for Universal Type System
 * Provides specific error classes for better error handling
 */

/**
 * Base error class for Universal Type System
 */
export class UniversalTypeError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'UniversalTypeError';
    Object.setPrototypeOf(this, UniversalTypeError.prototype);
  }
}

/**
 * Error thrown when type loading fails
 */
export class TypeLoadingError extends UniversalTypeError {
  constructor(message: string, cause?: Error) {
    super(message, 'TYPE_LOADING_ERROR', cause);
    this.name = 'TypeLoadingError';
    Object.setPrototypeOf(this, TypeLoadingError.prototype);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends UniversalTypeError {
  constructor(
    message: string,
    public field: string,
    public severity: 'critical' | 'high' | 'medium' | 'low',
    cause?: Error
  ) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown for security violations
 */
export class SecurityError extends UniversalTypeError {
  constructor(message: string, cause?: Error) {
    super(message, 'SECURITY_ERROR', cause);
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

/**
 * Error thrown when duplicate type is detected
 */
export class DuplicateTypeError extends UniversalTypeError {
  constructor(
    public typeName: string,
    public existingType: string,
    message?: string
  ) {
    super(
      message || `Type "${typeName}" already exists as "${existingType}"`,
      'DUPLICATE_TYPE_ERROR'
    );
    this.name = 'DuplicateTypeError';
    Object.setPrototypeOf(this, DuplicateTypeError.prototype);
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends UniversalTypeError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Error thrown when input sanitization fails
 */
export class SanitizationError extends UniversalTypeError {
  constructor(
    message: string,
    public input: string,
    cause?: Error
  ) {
    super(message, 'SANITIZATION_ERROR', cause);
    this.name = 'SanitizationError';
    Object.setPrototypeOf(this, SanitizationError.prototype);
  }
}

/**
 * Error logger utility
 */
export class ErrorLogger {
  static log(error: Error, context?: Record<string, unknown>): void {
    // In production, this would integrate with a logging service
    const errorInfo: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    };
    
    if (error instanceof UniversalTypeError) {
      errorInfo.code = error.code;
      errorInfo.cause = error.cause?.message;
    }
    
    // For now, use console.error but in production use proper logging
    console.error('[UniversalType Error]', errorInfo);
  }
  
  static logAndThrow(error: Error, context?: Record<string, unknown>): never {
    ErrorLogger.log(error, context);
    throw error;
  }
}