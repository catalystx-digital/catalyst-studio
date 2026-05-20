import { NextRequest, NextResponse } from 'next/server';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { CreatePageDto } from '@/lib/types/page-orchestrator.types';
import {
  DuplicateSlugError,
  InvalidSlugError,
  OrphanedNodeError
} from '@/lib/services/site-structure/errors';
import { getAuthorizedContext, assertPermission } from '@/lib/auth/authorization';
import { prisma } from '@/lib/prisma';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { checkAndRecordUsage, checkPerWebsitePageLimit, PER_WEBSITE_PAGE_LIMIT } from '@/lib/usage/limits';

export async function POST(request: NextRequest) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content:create');

    const websiteId = request.headers.get('x-website-id');
    if (!websiteId) {
      throw new ApiError(400, 'Website ID is required in x-website-id header', 'VALIDATION_ERROR');
    }

    // 3. Verify website ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId, accountId: context.accountId },
      select: { id: true },
    });
    if (!website) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }

    const body: CreatePageDto = await request.json();

    if (!body.title || !body.contentTypeId) {
      throw new ApiError(400, 'Title and contentTypeId are required', 'VALIDATION_ERROR');
    }

    // Task 4: Check per-website page limit (20 pages max per website)
    const perWebsiteCheck = await checkPerWebsitePageLimit(prisma, context.accountId, websiteId);
    if (!perWebsiteCheck.allowed) {
      return NextResponse.json({
        error: `Per-website page limit exceeded. Maximum ${PER_WEBSITE_PAGE_LIMIT} pages allowed per website per month.`,
        code: 'PER_WEBSITE_LIMIT_EXCEEDED',
        details: {
          websiteId,
          currentCount: perWebsiteCheck.count,
          limit: PER_WEBSITE_PAGE_LIMIT,
        },
      }, { status: 429 });
    }

    // Check global page_create quota (with userId for admin bypass)
    await checkAndRecordUsage(prisma, context.accountId, 'page_create', 1, {
      metadata: {
        websiteId,
        contentTypeId: body.contentTypeId,
      },
      userId: context.userId,
    });

    const result = await pageOrchestrator.createPage(body, websiteId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating page:', error);

    if (error instanceof DuplicateSlugError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof InvalidSlugError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ApiError) {
      return handleApiError(error);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }

    return NextResponse.json(
      { error: errorMessage || 'Failed to create page' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content:list');

    const websiteId = request.headers.get('x-website-id');
    if (!websiteId) {
      throw new ApiError(400, 'Website ID is required in x-website-id header', 'VALIDATION_ERROR');
    }

    // 3. Verify website ownership
    const website = await prisma.website.findUnique({
      where: { id: websiteId, accountId: context.accountId },
      select: { id: true },
    });
    if (!website) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }

    const url = new URL(request.url);
    const parentId = url.searchParams.get('parentId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeContent = url.searchParams.get('includeContent') !== 'false';

    const result = await pageOrchestrator.listPages(websiteId, {
      parentId: parentId === 'null' ? null : parentId,
      limit: Math.min(limit, 100),
      offset,
      includeContent,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing pages:', error);

    if (error instanceof OrphanedNodeError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof ApiError) {
      return handleApiError(error);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list pages' },
      { status: 500 }
    );
  }
}
