import { NextRequest } from 'next/server';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/responses';
import * as contentTypeService from '@/lib/services/content-type-service';
import { getAuthorizedContext, assertPermission } from '@/lib/auth/authorization';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

// Helper to get content type's websiteId for ownership check
async function getContentTypeWebsiteId(contentTypeId: string): Promise<string> {
  const contentType = await prisma.contentType.findUnique({
    where: { id: contentTypeId },
    select: { websiteId: true },
  });
  if (!contentType) {
    throw ErrorHandlers.notFound('Content type');
  }
  return contentType.websiteId;
}

/**
 * GET /api/content-types/[id]/impact
 *
 * Get impact analysis for deleting a content type.
 * Shows what pages and custom content items will be affected.
 *
 * Authorization: Requires `content_type:delete` permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Get authorized context (includes role)
    console.log('[Impact API] Step 1: Getting authorized context...');
    const context = await getAuthorizedContext(request);
    console.log('[Impact API] Step 1 complete:', { userId: context.userId, accountId: context.accountId, role: context.role });

    // 2. Check permission
    console.log('[Impact API] Step 2: Checking permission...');
    await assertPermission(context, 'content_type:delete');
    console.log('[Impact API] Step 2 complete: Permission granted');

    const { id } = await params;
    console.log('[Impact API] Content type ID:', id);

    // 3. Verify ownership of the content type's website
    console.log('[Impact API] Step 3: Getting content type websiteId...');
    const websiteId = await getContentTypeWebsiteId(id);
    console.log('[Impact API] Step 3a: websiteId =', websiteId);
    await assertWebsiteOwnership(prisma as any, context.accountId, websiteId);
    console.log('[Impact API] Step 3 complete: Ownership verified');

    // 4. Get impact analysis
    console.log('[Impact API] Step 4: Getting delete impact...');
    const impact = await contentTypeService.getDeleteImpact(id);
    console.log('[Impact API] Step 4 complete:', { totalAffectedItems: impact.impact.totalAffectedItems });

    return successResponse(impact);
  } catch (error) {
    console.error('[Impact API] ERROR:', error);
    return handleApiError(error);
  }
}
