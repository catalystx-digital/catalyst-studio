import { NextRequest, NextResponse } from 'next/server';
// import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator'; // Temporarily disabled until updated to new models
import { ErrorCode, StandardResponse } from '@/lib/services/types';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Note: pageOrchestrator is temporarily disabled until it's updated to use new models
// This API now directly queries websiteStructure and websitePage tables

interface ResolveOptions {
  includeContent?: boolean;
  includeStructure?: boolean;
  includeChildren?: boolean;
  includeMeta?: boolean;
}

function validatePath(path: string): { valid: boolean; error?: string } {
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('./') || path.includes('/.')) {
    return { valid: false, error: 'Path traversal detected' };
  }

  // Check for encoded path traversal
  try {
    const decodedPath = decodeURIComponent(path);
    if (decodedPath !== path && (decodedPath.includes('..') || decodedPath.includes('./'))) {
      return { valid: false, error: 'Encoded path traversal detected' };
    }
  } catch {
    return { valid: false, error: 'Invalid path encoding' };
  }

  // Check path length
  if (path.length > 2000) {
    return { valid: false, error: 'Path exceeds maximum length of 2000 characters' };
  }

  // Check for valid characters
  const pathRegex = /^[a-zA-Z0-9\-\/\?\#\&\=\%\+\_\.\,\;\:]*$/;
  if (!pathRegex.test(path)) {
    return { valid: false, error: 'Path contains invalid characters' };
  }

  // Check for null bytes
  if (path.includes('\0')) {
    return { valid: false, error: 'Path contains null bytes' };
  }

  return { valid: true };
}

function parseIncludeParams(searchParams: URLSearchParams): ResolveOptions {
  const include = searchParams.get('include');
  
  if (!include) {
    // Default: include content and structure
    return {
      includeContent: true,
      includeStructure: true,
      includeChildren: false,
      includeMeta: false
    };
  }

  const parts = include.split(',').map(p => p.trim().toLowerCase());
  
  return {
    includeContent: parts.includes('content'),
    includeStructure: parts.includes('structure'),
    includeChildren: parts.includes('children'),
    includeMeta: parts.includes('meta') || parts.includes('metadata')
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Authentication required'
        }
      } as StandardResponse<null>, { status: 401 });
    }

    // Get website ID from header or query param
    const url = new URL(request.url);
    const websiteId = request.headers.get('x-website-id') ||
                     url.searchParams.get('websiteId');

    if (!websiteId) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Website ID is required',
          details: {
            hint: 'Provide websiteId in x-website-id header or as query parameter'
          }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Verify website ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Get and validate path
    const path = url.searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Path parameter is required',
          details: { example: '/api/pages/resolve?path=/about' }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Validate path for security
    const pathValidation = validatePath(path);
    if (!pathValidation.valid) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: pathValidation.error || 'Invalid path',
          details: { path }
        }
      } as StandardResponse<null>, { status: 400 });
    }

    // Parse include parameters
    const options = parseIncludeParams(url.searchParams);
    
    // Temporarily bypass pageOrchestrator since it hasn't been updated to use new models
    // This is a workaround until pageOrchestrator is properly updated
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    const structure = await prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        fullPath: normalizedPath
      }
    });

    if (!structure) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Page not found',
          details: { 
            path,
            websiteId,
            suggestion: 'Check if the page exists and is published'
          }
        }
      } as StandardResponse<null>, { status: 404 });
    }

    // Note: 'result' variable was used with pageOrchestrator but is no longer needed
    // We now use 'structure' directly throughout the code

    // Build response based on include options
    const responseData: Record<string, unknown> = {};

    // Always include basic page info
    responseData.pageId = structure.id;
    responseData.path = structure.fullPath;
    responseData.slug = structure.slug;

    // Include content if requested
    if (options.includeContent && structure.websitePageId) {
      const websitePage = await prisma.websitePage.findUnique({
        where: { id: structure.websitePageId }
      });
      
      if (websitePage) {
        responseData.content = {
          id: websitePage.id,
          title: websitePage.title,
          slug: structure.slug,  // slug now comes from websiteStructure
          content: websitePage.content,
          publishedAt: websitePage.publishedAt,
          status: websitePage.status
        };
      }
    }

    // Include structure if requested
    if (options.includeStructure) {
      responseData.structure = {
        id: structure.id,
        parentId: structure.parentId,
        fullPath: structure.fullPath,
        pathDepth: structure.pathDepth,
        position: structure.position,
        weight: structure.weight
      };
    }

    // Include children if requested
    if (options.includeChildren) {
      const children = await prisma.websiteStructure.findMany({
        where: {
          parentId: structure.id,
          websiteId: websiteId
        },
        select: {
          id: true,
          slug: true,
          fullPath: true,
          position: true,
          websitePageId: true  // renamed from contentItemId
        },
        orderBy: { position: 'asc' }
      });

      responseData.children = children;
    }

    // Include metadata if requested
    if (options.includeMeta) {
      responseData.meta = {
        createdAt: structure.createdAt,
        updatedAt: structure.updatedAt,
        websiteId: structure.websiteId,
        websitePageId: structure.websitePageId  // renamed field
      };
    }

    // Add performance metrics
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        duration: `${duration}ms`,
        options
      }
    } as StandardResponse<Record<string, unknown>>);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Error resolving URL:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to resolve URL',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: `${duration}ms`
        }
      }
    } as StandardResponse<null>, { status: 500 });
  }
}