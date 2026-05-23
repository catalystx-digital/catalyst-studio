import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SharedComponentService } from '@/lib/services/component-service';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';

// Schema for updating WebsiteSharedComponent
const MetadataConfigSchema = z.record(z.unknown()).refine(
  (config) => !Object.prototype.hasOwnProperty.call(config, ['default', 'Props'].join('')),
  { message: 'Shared component config must be metadata only; use content for props' }
);

const UpdateSharedComponentSchema = z.object({
  name: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  config: MetadataConfigSchema.optional(),
  updatedBy: z.string().optional(),
});

// GET /api/components/shared/[id] - Get single shared component
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Shared component ID is required' } },
        { status: 400 }
      );
    }
    
    const sharedComponentService = new SharedComponentService(prisma);
    const sharedComponent = await sharedComponentService.getSharedComponentWithType(id);
    
    if (!sharedComponent) {
      return NextResponse.json(
        { error: { message: 'Shared component not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check via shared component's website -> site.accountId
    const auth = await getAuthContext(request);
    const site: any = await prisma.website.findUnique({ where: { id: (sharedComponent as any).websiteId } });
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }

    return NextResponse.json(sharedComponent);
  } catch (error) {
    console.error(`[API Error] GET /api/components/shared/${id || 'unknown'}:`, error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/components/shared/[id] - Update shared component
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Shared component ID is required' } },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Validate request body
    const validation = UpdateSharedComponentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const sharedComponentService = new SharedComponentService(prisma);
    
    // Check if shared component exists
    const existing = await sharedComponentService.getSharedComponent(id);
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Shared component not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check
    const auth = await getAuthContext(request);
    const sc: any = await prisma.websiteSharedComponent.findUnique({
      where: { id },
      include: { website: true },
    });
    if (!sc?.website?.accountId || sc.website.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }

    // Update shared component using service
    const updated = await sharedComponentService.updateSharedComponent(id, validation.data);
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`[API Error] PUT /api/components/shared/${id || 'unknown'}:`, error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/components/shared/[id] - Delete shared component
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    if (!id) {
      return NextResponse.json(
        { error: { message: 'Shared component ID is required' } },
        { status: 400 }
      );
    }
    
    const sharedComponentService = new SharedComponentService(prisma);
    
    // Check if shared component exists
    const existing = await sharedComponentService.getSharedComponent(id);
    if (!existing) {
      return NextResponse.json(
        { error: { message: 'Shared component not found' } },
        { status: 404 }
      );
    }
    
    // Ownership check
    const auth = await getAuthContext(request);
    const sc: any = await prisma.websiteSharedComponent.findUnique({
      where: { id },
      include: { website: true },
    });
    if (!sc?.website?.accountId || sc.website.accountId !== auth.accountId) {
      return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 });
    }

    // Delete shared component using service (it checks usage internally)
    await sharedComponentService.deleteSharedComponent(id);
    
    return NextResponse.json(
      { message: 'Shared component deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[API Error] DELETE /api/components/shared/${id || 'unknown'}:`, error);
    
    // Handle specific error from service
    if (error instanceof Error && error.message.includes('Cannot delete shared component that is used')) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
