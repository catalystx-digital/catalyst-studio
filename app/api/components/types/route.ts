import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ComponentService } from '@/lib/services/component-service';
import { Prisma } from '@/lib/generated/prisma';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Schema for WebsiteComponentType
const ComponentTypeSchema = z.object({
  type: z.string(),
  category: z.string(),
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
  isLocked: z.boolean().optional(),
});

// GET /api/components/types - List component types
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const categories = searchParams.get('categories');
    const aiTag = searchParams.get('aiTag');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build where clause
    const where: Prisma.WebsiteComponentTypeWhereInput = {};
    
    if (category) {
      where.category = category;
    } else if (categories) {
      where.category = { in: categories.split(',') };
    }

    if (aiTag) {
      where.aiMetadata = {
        path: ['tags'],
        array_contains: aiTag
      };
    }

    // isActive field removed from model - skip this filter

    // Get total count scoped by account via Website relation
    const auth = await getAuthContext(request);
    (where as any).website = { accountId: auth.accountId };

    const total = await prisma.websiteComponentType.count({ where });

    // Get paginated results
    const skip = (page - 1) * limit;
    const componentTypes = await prisma.websiteComponentType.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { category: 'asc' },
        { type: 'asc' }
      ],
      include: {
        sharedComponents: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: componentTypes,
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
    console.error('[API Error] GET /api/components/types:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/components/types - Create component type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = ComponentTypeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const componentService = new ComponentService(prisma);
    
    // Check if component type already exists
    const existing = await componentService.getComponentTypeByType(
      validation.data.type,
      validation.data.category
    );
    
    if (existing) {
      return NextResponse.json(
        { error: { message: 'Component type already exists' } },
        { status: 409 }
      );
    }

    const websiteId = request.headers.get('x-website-id');
    if (!websiteId) {
      return NextResponse.json(
        { error: { message: 'Website ID is required in x-website-id header' } },
        { status: 400 }
      );
    }

    const auth = await getAuthContext(request);
    await assertWebsiteOwnership(prisma, auth.accountId, websiteId);

    // Create component type using service
    const componentType = await componentService.createComponentType({
      ...validation.data,
      websiteId
    });
    
    return NextResponse.json(componentType, { status: 201 });
  } catch (error) {
    console.error('[API Error] POST /api/components/types:', error);
    
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
