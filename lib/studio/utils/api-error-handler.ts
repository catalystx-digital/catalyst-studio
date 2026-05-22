/**
 * API Error Handler Utility
 * 
 * Provides consistent error handling and response formatting for API endpoints
 */

import { NextResponse } from 'next/server';

export type ErrorCode = 
  | 'INVALID_DATA'
  | 'NOT_FOUND'
  | 'DUPLICATE_NAME'
  | 'IN_USE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED';

export interface ApiError {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: any;
  statusCode: number;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  [key: string]: any; // Allow additional fields like 'count', 'id', etc.
}

/**
 * Determine error code from error object
 */
export function determineErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    // Prisma errors
    if ('code' in error) {
      const code = (error as any).code;
      if (code === 'P2002') return 'DUPLICATE_NAME';
      if (code === 'P2025') return 'NOT_FOUND';
      if (code === 'P2003') return 'INVALID_DATA';
    }
    
    // Check error message for hints
    const message = error.message.toLowerCase();
    if (message.includes('not found')) return 'NOT_FOUND';
    if (message.includes('duplicate') || message.includes('already exists')) return 'DUPLICATE_NAME';
    if (message.includes('invalid') || message.includes('required')) return 'INVALID_DATA';
    if (message.includes('conflict')) return 'CONFLICT';
    if (message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (message.includes('forbidden')) return 'FORBIDDEN';
    if (message.includes('in use')) return 'IN_USE';
    if (message.includes('too large')) return 'PAYLOAD_TOO_LARGE';
  }
  
  return 'INTERNAL_ERROR';
}

/**
 * Determine HTTP status code from error
 */
export function determineStatusCode(error: unknown): number {
  const errorCode = determineErrorCode(error);
  
  switch (errorCode) {
    case 'INVALID_DATA':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE_NAME':
    case 'IN_USE':
      return 409;
    case 'CONFLICT':
      return 409;
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'RATE_LIMITED':
      return 429;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  userMessage?: string,
  details?: any
): NextResponse {
  console.error('API Error:', error);
  
  const errorCode = determineErrorCode(error);
  const statusCode = determineStatusCode(error);
  const errorMessage = userMessage || 
    (error instanceof Error ? error.message : 'An unexpected error occurred');
  
  const response: ApiError = {
    success: false,
    error: errorMessage,
    code: errorCode,
    statusCode: statusCode
  };
  
  if (details) {
    response.details = details;
  }
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T = any>(
  data: T,
  additionalFields?: Record<string, any>,
  statusCode = 200
): NextResponse {
  const response: ApiSuccess<T> = {
    success: true,
    data,
    ...additionalFields
  };
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      return `Missing required field: ${field}`;
    }
    
    // Check for empty strings on string fields
    if (typeof body[field] === 'string' && body[field].trim() === '') {
      return `Field cannot be empty: ${field}`;
    }
  }
  
  return null;
}

/**
 * Safely parse JSON from request
 */
export async function safeParseJson(request: Request): Promise<any> {
  try {
    const text = await request.text();
    if (!text) {
      throw new Error('Empty request body');
    }
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
