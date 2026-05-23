import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SharedComponentService } from '@/lib/services/component-service';
import { Prisma } from '@/lib/generated/prisma';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Schema for WebsiteSharedComponent
const MetadataConfigSchema = z.record(z.unknown()).refine(
  (config) => !Object.prototype.hasOwnProperty.call(config, ['default', 'Props'].join('')),
  { message: 'Shared component config must be metadata only; use content for props' }
);

const SharedComponentSchema = z.object({
  websiteId: z.string(),
  websiteComponentTypeId: z.string(),
  name: z.string(),
  content: z.record(z.unknown()),
  config: MetadataConfigSchema.optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

// GET /api/components/shared - List shared components
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('websiteId');
    const componentTypeId = searchParams.get('componentTypeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause
    const where: Prisma.WebsiteSharedComponentWhereInput = {};
    
    if (websiteId) {
      where.websiteId = websiteId;
    }
    
    if (componentTypeId) {
      where.websiteComponentTypeId = componentTypeId;
    }

    // Note: isActive filtering would need to be added to the schema
    // For now, we'll skip this filter as the field doesn't exist on WebsiteSharedComponent

    // Get total count scoped by account via Website relation
    const auth = await getAuthContext(request);
    (where as any).website = { accountId: auth.accountId };

    const total = await prisma.websiteSharedComponent.count({ where });

    // Get paginated results
    const skip = (page - 1) * limit;
    const sharedComponents = await prisma.websiteSharedComponent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        websiteComponentType: true,
        website: true
      }
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: sharedComponents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('[API Error] GET /api/components/shared:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/components/shared - Create shared component
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = SharedComponentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const sharedComponentService = new SharedComponentService(prisma);
    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, validation.data.websiteId);
    
    // Create shared component using service
    const sharedComponent = await sharedComponentService.createSharedComponent({
      websiteId: validation.data.websiteId,
      websiteComponentTypeId: validation.data.websiteComponentTypeId,
      name: validation.data.name,
      content: validation.data.content,
      config: validation.data.config || {},
    });
    
    return NextResponse.json(sharedComponent, { status: 201 });
  } catch (error) {
    console.error('[API Error] POST /api/components/shared:', error);
    
    if (error instanceof Error && error.message === 'Component type not found') {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
