import { NextResponse } from 'next/server';

/**
 * HTTP Status codes constants
 */
export const StatusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Format a successful API response
 */
export function successResponse<T>(
  data: T, 
  status: number = StatusCodes.OK,
  headers?: HeadersInit
): Response {
  return Response.json({ data }, { status, headers });
}

/**
 * Format a paginated API response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  status: number = StatusCodes.OK
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return Response.json({
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1
    }
  }, { status });
}

/**
 * Format a no content response
 */
export function noContentResponse(): Response {
  return new Response(null, { status: StatusCodes.NO_CONTENT });
}

/**
 * Helper to build pagination parameters
 */
export function buildPaginationParams(
  page: number = 1,
  limit: number = 10
): {
  skip: number;
  take: number;
} {
  const skip = (page - 1) * limit;
  const take = limit;
  
  return { skip, take };
}

/**
 * Helper to parse query parameters
 */
export function parseQueryParams(url: string): URLSearchParams {
  const { searchParams } = new URL(url);
  return searchParams;
}

/**
 * Helper to add cache headers
 */
export function withCacheHeaders(
  response: Response,
  maxAge: number = 60
): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Helper to add CORS headers
 */
export function withCorsHeaders(
  response: Response,
  origin: string = '*'
): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}