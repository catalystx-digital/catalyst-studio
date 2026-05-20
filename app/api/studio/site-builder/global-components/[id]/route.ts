import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@/lib/studio/utils/api-error-handler';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { MAX_CONTENT_SIZE_BYTES, MAX_JSON_DEPTH, checkJSONDepth, checkJSONSizeBytes } from '@/lib/studio/utils/json-constraints';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

/**
 * Helper to verify component ownership via website
 */
async function assertComponentOwnership(request: NextRequest, componentId: string) {
  const auth = await getAuthContext(request);
  const component = await prisma.websiteSharedComponent.findUnique({
    where: { id: componentId },
    select: { websiteId: true }
  });
  if (!component) {
    throw new Error('NOT_FOUND');
  }
  await assertWebsiteOwnership(prisma as any, auth.accountId, component.websiteId);
}

// Validation schema for updates
const UpdateGlobalComponentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.any().optional() // Canonical props/content
});

/**
 * GET /api/studio/site-builder/global-components/[id]
 * Get details of a specific global component
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check - always required
    try {
      await assertComponentOwnership(request, id);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return createErrorResponse(new Error('Shared component not found'), 'Shared component not found');
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sharedComponent = await prisma.websiteSharedComponent.findUnique({
      where: {
        id: id
      }
    });

    if (!sharedComponent) {
      return createErrorResponse(
        new Error('Shared component not found'),
        'Shared component not found'
      );
    }

    return createSuccessResponse({
      id: sharedComponent.id,
      componentId: sharedComponent.websiteComponentTypeId,
      name: sharedComponent.name,
      type: 'shared',
      properties: (sharedComponent.content as Record<string, unknown>) || {},
      usageCount: sharedComponent.usageCount,
      lastModified: sharedComponent.lastModified,
      createdBy: sharedComponent.createdBy,
      usages: [] // TODO: Implement usage tracking post-MVP
    });
    
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch global component details');
  }
}

/**
 * PUT /api/studio/site-builder/global-components/[id]
 * Update a global component
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check - always required
    try {
      await assertComponentOwnership(request, id);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return createErrorResponse(new Error('Global component not found'), 'Global component not found');
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const validation = UpdateGlobalComponentSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        new Error('Invalid request data'),
        'Invalid request data',
        validation.error.flatten()
      );
    }

    const { name, content } = validation.data;

    // Parse optimistic concurrency header if provided
    const ifUnmodifiedSinceHeader = request.headers.get('If-Unmodified-Since') || request.headers.get('if-unmodified-since');
    const ifBody = (body?.ifUnchangedSince as string | undefined) ?? undefined;
    const ifUnchangedSince = ifUnmodifiedSinceHeader ? new Date(ifUnmodifiedSinceHeader) : (ifBody ? new Date(ifBody) : undefined);

    // Check if component exists (already verified in assertComponentOwnership)
    const existingComponent = await prisma.websiteSharedComponent.findUnique({
      where: { id: id }
    });

    if (!existingComponent) {
      return createErrorResponse(
        new Error('Global component not found'),
        'Global component not found'
      );
    }

    // Check for duplicate names if name is being updated
    if (name && name !== existingComponent.name) {
      const duplicateName = await prisma.websiteSharedComponent.findFirst({
        where: {
          websiteId: existingComponent.websiteId,
          name: name,
          id: { not: id } // Exclude current component
        }
      });

      if (duplicateName) {
        return createErrorResponse(
          new Error('A global component with this name already exists'),
          'A global component with this name already exists'
        );
      }
    }

    // Perform updates
    if (name) {
      await prisma.websiteSharedComponent.update({ where: { id }, data: { name } });
    }
    if (content !== undefined) {
      // Validate content size/depth
      if (!checkJSONSizeBytes(content, MAX_CONTENT_SIZE_BYTES) || !checkJSONDepth(content, 0, MAX_JSON_DEPTH)) {
        return createErrorResponse(
          new Error('Content exceeds limits'),
          `Content exceeds size (${MAX_CONTENT_SIZE_BYTES} bytes) or depth (${MAX_JSON_DEPTH}) limits`
        );
      }
      await ContentRepository.saveSharedComponentContent(id, content as Record<string, unknown>, {
        mirrorDefaultProps: true,
        ifUnchangedSince,
      });
    }

    const updatedComponent = await prisma.websiteSharedComponent.findUniqueOrThrow({ where: { id } });

    return createSuccessResponse({
      id: updatedComponent.id,
      componentId: updatedComponent.websiteComponentTypeId,
      name: updatedComponent.name,
      type: 'shared',
      properties: (updatedComponent.content as Record<string, unknown>) || {},
      usageCount: updatedComponent.usageCount,
      lastModified: updatedComponent.lastModified,
      createdBy: updatedComponent.createdBy
    });
    
  } catch (error) {
    return createErrorResponse(error, 'Failed to update global component');
  }
}

/**
 * DELETE /api/studio/site-builder/global-components/[id]
 * Delete a global component
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check - always required
    try {
      await assertComponentOwnership(request, id);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return createErrorResponse(new Error('Global component not found'), 'Global component not found');
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if component exists (already verified in assertComponentOwnership)
    const component = await prisma.websiteSharedComponent.findUnique({
      where: { id: id }
    });

    if (!component) {
      return createErrorResponse(
        new Error('Global component not found'),
        'Global component not found'
      );
    }
    
    if (component.usageCount > 0) {
      return createErrorResponse(
        new Error(`Cannot delete: Component is used in ${component.usageCount} pages`),
        `Cannot delete: Component is used in ${component.usageCount} pages`,
        { usageCount: component.usageCount }
      );
    }
    
    // Delete the component
    await prisma.websiteSharedComponent.delete({
      where: { id: id }
    });
    
    return createSuccessResponse(null, { message: 'Component deleted successfully' });
    
  } catch (error) {
    return createErrorResponse(error, 'Failed to delete global component');
  }
}
