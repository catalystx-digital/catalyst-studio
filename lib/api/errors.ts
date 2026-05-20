/**
 * Custom API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle API errors and return consistent error responses
 */
export function handleApiError(error: unknown): Response {
  // Handle our custom ApiError
  if (error instanceof ApiError) {
    return Response.json(
      { 
        error: { 
          message: error.message, 
          code: error.code, 
          details: error.details 
        } 
      },
      { status: error.statusCode }
    );
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: any; message?: string };
    
    // Handle unique constraint violations
    if (prismaError.code === 'P2002') {
      return Response.json(
        { 
          error: { 
            message: 'A record with this value already exists', 
            code: 'DUPLICATE_ENTRY',
            details: prismaError.meta 
          } 
        },
        { status: 409 }
      );
    }
    
    // Handle foreign key constraint violations
    if (prismaError.code === 'P2003') {
      return Response.json(
        { 
          error: { 
            message: 'Referenced record not found', 
            code: 'FOREIGN_KEY_ERROR',
            details: prismaError.meta 
          } 
        },
        { status: 400 }
      );
    }
    
    // Handle record not found
    if (prismaError.code === 'P2025') {
      return Response.json(
        { 
          error: { 
            message: 'Record not found', 
            code: 'NOT_FOUND' 
          } 
        },
        { status: 404 }
      );
    }
  }
  
  // Log unexpected errors for debugging
  console.error('Unexpected error:', error);
  
  // Return generic error for unexpected cases
  return Response.json(
    { 
      error: { 
        message: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      } 
    },
    { status: 500 }
  );
}

/**
 * Common error handlers
 */
export const ErrorHandlers = {
  notFound: (resource: string = 'Resource') => {
    return new ApiError(404, `${resource} not found`, 'NOT_FOUND');
  },
  
  badRequest: (message: string, details?: any) => {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  },
  
  unauthorized: (message: string = 'Unauthorized') => {
    return new ApiError(401, message, 'UNAUTHORIZED');
  },
  
  forbidden: (message: string = 'Forbidden') => {
    return new ApiError(403, message, 'FORBIDDEN');
  },
  
  conflict: (message: string, details?: any) => {
    return new ApiError(409, message, 'CONFLICT', details);
  },
  
  internalError: (message: string = 'Internal server error') => {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
};