import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ComponentService } from '@/lib/services/component-service';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Schema for updating WebsiteComponentType
const UpdateComponentTypeSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  icon: z.string().optional(),
  defaultProperties: z.any().optional(),
  defaultContent: z.any().optional(),
  defaultStyles: z.any().optional(),
  aiMetadata: z.any().optional(),
  schema: z.any().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/components/types/[id] - Get single component type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Component type ID is required' } },
        { status: 400 }
      );
    }
    
    const componentService = new ComponentService(prisma);
    const componentType = await componentService.getComponentType(id);
    
    if (!componentType) {
      return NextResponse.json(
        { error: { message: 'Component type not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check
    const auth = await getAuthContext(request);
    const site: any = await prisma.website.findUnique({ where: { id: componentType.websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }

    // Include shared components using this type
    const sharedComponents = await prisma.websiteSharedComponent.findMany({
      where: { websiteComponentTypeId: id },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({
      ...componentType,
      sharedComponents
    });
  } catch (error) {
    console.error('[API Error] GET /api/components/types/[id]:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/components/types/[id] - Update component type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Component type ID is required' } },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    const validation = UpdateComponentTypeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const componentService = new ComponentService(prisma);
    
    // Check if component type exists
    const existing = await componentService.getComponentType(id);
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Component type not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check
    const auth = await getAuthContext(request);
    const site: any = await prisma.website.findUnique({ where: { id: (existing as any).websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }
    // Component type can be updated
    
    // Update component type using service
    const updated = await componentService.updateComponentType(id, validation.data);
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API Error] PUT /api/components/types/[id]:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/components/types/[id] - Delete component type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Component type ID is required' } },
        { status: 400 }
      );
    }
    
    const componentService = new ComponentService(prisma);
    
    // Check if component type exists
    const existing = await componentService.getComponentType(id);
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Component type not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check
    const auth = await getAuthContext(request);
    const site: any = await prisma.website.findUnique({ where: { id: (existing as any).websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }
    // Component type can be deleted if not in use
    
    // Check if any shared components use this type
    const sharedCount = await prisma.websiteSharedComponent.count({
      where: { websiteComponentTypeId: id }
    });
    
    if (sharedCount > 0) {
      return NextResponse.json(
        { error: { message: `Cannot delete component type. ${sharedCount} shared components depend on it.` } },
        { status: 409 }
      );
    }
    
    // Delete component type using service
    await componentService.deleteComponentType(id);
    
    return NextResponse.json(
      { message: 'Component type deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API Error] DELETE /api/components/types/[id]:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
