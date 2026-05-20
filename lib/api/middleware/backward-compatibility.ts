import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Set sunset date for deprecated endpoints (3 months from now)
const SUNSET_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

interface DeprecationConfig {
  newPath: string;
  message?: string;
}

/**
 * Add deprecation headers to response
 */
export function addDeprecationHeaders(
  response: NextResponse,
  newPath: string
): NextResponse {
  response.headers.set('X-Deprecated-Endpoint', 'true');
  response.headers.set('X-Sunset-Date', SUNSET_DATE);
  response.headers.set('Link', `<${newPath}>; rel="successor-version"`);
  response.headers.set('Warning', `299 - "This endpoint is deprecated. Use ${newPath} instead."`);
  
  return response;
}

/**
 * Log deprecation usage for monitoring
 */
export function logDeprecationUsage(
  method: string,
  oldPath: string,
  newPath: string,
  userId?: string
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    method,
    oldPath,
    newPath,
    userId: userId || 'anonymous',
    message: `[DEPRECATED] ${method} ${oldPath} - Use ${newPath} instead`
  };
  
  // Log to console (in production, this would go to a monitoring service)
  console.warn(JSON.stringify(logEntry));
}

/**
 * Create a deprecated endpoint handler that forwards to new endpoint
 */
export function createDeprecatedHandler(config: DeprecationConfig) {
  return async (request: NextRequest) => {
    const url = new URL(request.url);
    const newUrl = new URL(url);
    newUrl.pathname = config.newPath;
    
    // Log the deprecation usage
    logDeprecationUsage(
      request.method,
      url.pathname,
      config.newPath,
      request.headers.get('x-user-id') || undefined
    );
    
    // Forward the request to the new endpoint
    const response = await fetch(newUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body ? await request.arrayBuffer() : undefined,
    });
    
    // Create new response with deprecation headers
    const newResponse = new NextResponse(
      response.body,
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }
    );
    
    // Add deprecation headers
    return addDeprecationHeaders(newResponse, config.newPath);
  };
}

/**
 * Map old content-items endpoints to new endpoints based on content type
 */
export async function routeContentItemRequest(
  request: NextRequest,
  params?: { id?: string }
): Promise<NextResponse> {
  // Handle test scenarios where URL might not be set
  if (!request.url) {
    return NextResponse.json(
      { error: { message: 'Invalid request URL' } },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const method = request.method;

  // Import prisma for auth checks and lookups
  const { prisma } = await import('@/lib/prisma');

  // For operations on specific items, we need to determine the type
  if (params?.id && method === 'GET') {
    // Check if it's a WebsitePage or WebsiteCustomContentData

    // Try to find as WebsitePage first
    const page = await prisma.websitePage.findUnique({
      where: { id: params.id },
      select: { id: true, type: true, websiteId: true }
    });

    if (page) {
      // Auth check - always required
      try {
        const auth = await getAuthContext(request);
        await assertWebsiteOwnership(prisma as any, auth.accountId, page.websiteId);
      } catch {
        return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
      }
      // It's a page, redirect to pages endpoint
      const newPath = `/api/content/pages/${params.id}`;
      logDeprecationUsage(method, url.pathname, newPath);
      
      url.pathname = newPath;
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
      });
      
      const newResponse = new NextResponse(
        response.body,
        {
          status: response.status,
          headers: response.headers,
        }
      );
      
      return addDeprecationHeaders(newResponse, newPath);
    }
    
    // Try as WebsiteCustomContentData
    const customData = await prisma.websiteCustomContentData.findUnique({
      where: { id: params.id },
      select: { id: true, websiteId: true }
    });

    if (customData) {
      // Auth check - always required
      try {
        const auth = await getAuthContext(request);
        await assertWebsiteOwnership(prisma as any, auth.accountId, customData.websiteId);
      } catch {
        return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
      }
      // It's custom data, redirect to data endpoint
      const newPath = `/api/content/data/${params.id}`;
      logDeprecationUsage(method, url.pathname, newPath);
      
      url.pathname = newPath;
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
      });
      
      const newResponse = new NextResponse(
        response.body,
        {
          status: response.status,
          headers: response.headers,
        }
      );
      
      return addDeprecationHeaders(newResponse, newPath);
    }
    
    // Not found in either model
    return NextResponse.json(
      { error: { message: 'Content item not found' } },
      { status: 404 }
    );
  }
  
  // For list operations or creates, we need to handle both
  // This requires more complex logic to merge results from both endpoints
  // For now, default to pages endpoint with a warning
  const newPath = '/api/content/pages';
  logDeprecationUsage(method, url.pathname, newPath);
  
  const warningMessage = 'This endpoint is deprecated. Content is now split between /api/content/pages and /api/content/data';
  
  url.pathname = newPath;
  const response = await fetch(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body ? await request.arrayBuffer() : undefined,
  });
  
  const newResponse = new NextResponse(
    response.body,
    {
      status: response.status,
      headers: response.headers,
    }
  );
  
  newResponse.headers.set('X-Deprecation-Note', warningMessage);
  return addDeprecationHeaders(newResponse, newPath);
}