import { NextRequest } from 'next/server';
import { getClient } from '@/lib/db/client';
import { UpdateWebsiteSchema } from '@/lib/api/validation/website';
import { handleApiError, ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { deleteWebsiteWithDependencies } from '@/lib/services/website-delete-service';

// Ensure this dynamic route is never statically generated
export const dynamic = 'force-dynamic'

/**
 * GET /api/websites/[id]
 * Retrieve a single website by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = getClient();
    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, id);
    const website = await prisma.website.findUnique({
      where: { id }
    });
    
    if (!website) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }
    
    // JSON fields are already parsed by Prisma
    const formattedWebsite = {
      ...website,
      metadata: website.metadata || null,
      settings: website.settings || null
    };
    
    return Response.json({ data: formattedWebsite });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/websites/[id]
 * Update a website
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateWebsiteSchema.parse(body);
    
    const prisma = getClient();
    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, id);
    
    // Check if website exists
    const existing = await prisma.website.findUnique({
      where: { id }
    });
    
    if (!existing) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }
    
    // Build update object, excluding undefined fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataToUpdate: any = {};
    
    // Only include fields that are explicitly provided
    if (validated.name !== undefined) dataToUpdate.name = validated.name;
    if (validated.description !== undefined) dataToUpdate.description = validated.description;
    if (validated.category !== undefined) dataToUpdate.category = validated.category;
    if (validated.icon !== undefined) dataToUpdate.icon = validated.icon;
    if (validated.isActive !== undefined) dataToUpdate.isActive = validated.isActive;
    if (validated.metadata !== undefined) dataToUpdate.metadata = validated.metadata;
    if (validated.settings !== undefined) dataToUpdate.settings = validated.settings;
    
    // Update website
    const website = await prisma.website.update({
      where: { id },
      data: dataToUpdate
    });
    
    // JSON fields are already parsed by Prisma
    const formattedWebsite = {
      ...website,
      metadata: website.metadata || null,
      settings: website.settings || null
    };
    
    return Response.json({ data: formattedWebsite });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', error.errors));
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/websites/[id]
 * Permanently delete a website after removing dependent data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = getClient();
    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, id);

    await deleteWebsiteWithDependencies(prisma, id);

    return Response.json({ data: { message: 'Website deleted successfully' } });
  } catch (error) {
    // Prisma throws P2025 when trying to update non-existent record
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string };
      if (prismaError.code === 'P2025') {
        return handleApiError(new ApiError(404, 'Website not found', 'NOT_FOUND'));
      }
    }
    return handleApiError(error);
  }
}
