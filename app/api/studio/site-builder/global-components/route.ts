import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@/lib/studio/utils/api-error-handler';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import {
  MAX_CONTENT_SIZE_BYTES,
  MAX_JSON_DEPTH,
  checkJSONDepth,
  checkJSONSizeBytes,
} from '@/lib/studio/utils/json-constraints';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Note: content validation uses centralized constraints

const CreateGlobalComponentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(100),
  content: z.record(z.unknown()),
  category: z.enum(['header', 'footer', 'navigation', 'shared']),
  websiteId: z.string().min(1).max(100)
});

/**
 * POST /api/studio/site-builder/global-components
 * Create or update a global component
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = CreateGlobalComponentSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        new Error('Invalid request data'),
        'Invalid request data',
        validation.error.flatten()
      );
    }

    const { name, type, content, category, websiteId } = validation.data;

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    // Check if website exists (already verified in assertWebsiteOwnership)
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    });

    if (!website) {
      return createErrorResponse(
        new Error('Website not found'),
        'Website not found'
      );
    }

    // Check for duplicate names
    const existingComponent = await prisma.websiteSharedComponent.findFirst({
      where: {
        websiteId,
        name
      }
    });

    if (existingComponent) {
      return createErrorResponse(
        new Error('A global component with this name already exists'),
        'A global component with this name already exists'
      );
    }

    // Validate content size/depth using shared constraints
    if (!checkJSONSizeBytes(content, MAX_CONTENT_SIZE_BYTES) || !checkJSONDepth(content, 0, MAX_JSON_DEPTH)) {
      return createErrorResponse(
        new Error(`Content exceeds limits`),
        `Content exceeds size (${MAX_CONTENT_SIZE_BYTES} bytes) or depth (${MAX_JSON_DEPTH}) limits`
      );
    }

    // Create via Unified Content Repository with canonical shared content.
    const created = await ContentRepository.createSharedComponent({
      websiteId,
      websiteComponentTypeId: type,
      name,
      category,
      content,
      createdBy: auth.userId
    });

    const sharedComponent = await prisma.websiteSharedComponent.findUniqueOrThrow({ where: { id: created.id } });
    
    return createSuccessResponse(
      {
        id: sharedComponent.id,
        componentId: sharedComponent.websiteComponentTypeId,
        name: sharedComponent.name,
        type: category,
        properties: sharedComponent.content as Record<string, unknown>,
        usageCount: sharedComponent.usageCount,
        lastModified: sharedComponent.lastModified,
        createdBy: sharedComponent.createdBy
      },
      { id: sharedComponent.id } // Keep id field for backward compatibility
    );
    
  } catch (error) {
    return createErrorResponse(error, 'Failed to process global component');
  }
}

/**
 * GET /api/studio/site-builder/global-components
 * List all global components for a website
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');

    if (!websiteId) {
      return createErrorResponse(
        new Error('websiteId is required'),
        'websiteId is required'
      );
    }

    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);

    const sharedComponents = await prisma.websiteSharedComponent.findMany({
      where: {
        websiteId
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    const components = sharedComponents.flatMap(sc => {
      if (
        typeof sc.websiteComponentTypeId !== 'string' ||
        sc.websiteComponentTypeId.trim().length === 0 ||
        !sc.content ||
        typeof sc.content !== 'object' ||
        Array.isArray(sc.content)
      ) {
        return [];
      }

      return [{
        id: sc.id,
        componentId: sc.websiteComponentTypeId,
        name: sc.name,
        type: sc.websiteComponentTypeId,
        properties: sc.content as Record<string, unknown>,
        usageCount: sc.usageCount,
        lastModified: sc.lastModified,
        createdBy: sc.createdBy
      }];
    });
    
    return createSuccessResponse(
      components,
      { count: components.length, components }
    );
    
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch global components');
  }
}
