import { NextRequest } from 'next/server';
import { CreateContentTypeSchema } from '@/lib/api/validation/content-type';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { successResponse, parseQueryParams } from '@/lib/api/responses';
import * as contentTypeService from '@/lib/services/content-type-service';
import { getAuthorizedContext, assertPermission } from '@/lib/auth/authorization';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content_type:list');

    const searchParams = parseQueryParams(request.url);
    const websiteId = searchParams.get('websiteId') || undefined;

    // 3. If websiteId is provided, verify ownership
    if (websiteId) {
      await assertWebsiteOwnership(prisma as any, context.accountId, websiteId);
    }

    // 4. Filter content types to only those the user has access to
    const contentTypes = await contentTypeService.getContentTypes(websiteId);

    // If no websiteId filter, filter results to user's websites
    if (!websiteId) {
      const userWebsites = await prisma.website.findMany({
        where: { accountId: context.accountId },
        select: { id: true }
      });
      const userWebsiteIds = new Set(userWebsites.map(w => w.id));
      const filteredContentTypes = contentTypes.filter(ct => userWebsiteIds.has(ct.websiteId));
      return successResponse(filteredContentTypes);
    }

    return successResponse(contentTypes);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content_type:create');

    // 3. Handle empty body
    const requestContentType = request.headers.get('content-type');
    if (!requestContentType || !requestContentType.includes('application/json')) {
      throw ErrorHandlers.badRequest('Content-Type must be application/json');
    }

    let body;
    try {
      const text = await request.text();
      if (!text) {
        throw ErrorHandlers.badRequest('Request body is required');
      }
      body = JSON.parse(text);
    } catch {
      throw ErrorHandlers.badRequest('Invalid JSON in request body');
    }

    // 4. Parse and validate request
    const validationResult = CreateContentTypeSchema.safeParse(body);
    if (!validationResult.success) {
      throw ErrorHandlers.badRequest('Invalid request data', validationResult.error.errors);
    }

    // 5. Verify ownership of the website where content type will be created
    if (validationResult.data.websiteId) {
      await assertWebsiteOwnership(prisma as any, context.accountId, validationResult.data.websiteId);
    }

    // 6. Create content type
    const contentType = await contentTypeService.createContentType(validationResult.data);

    return successResponse(contentType, 201);
  } catch (error) {
    return handleApiError(error);
  }
}