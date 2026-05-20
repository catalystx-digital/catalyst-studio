import { NextRequest } from 'next/server';
import { UpdateContentTypeSchema } from '@/lib/api/validation/content-type';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/responses';
import * as contentTypeService from '@/lib/services/content-type-service';
import { ConfirmationRequiredError } from '@/lib/services/content-type-service';
import { getAuthorizedContext, assertPermission } from '@/lib/auth/authorization';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

// Helper to get content type's websiteId for ownership check
async function assertContentTypeOwnership(accountId: string, contentTypeId: string) {
  const contentType = await prisma.contentType.findUnique({
    where: { id: contentTypeId },
    select: { websiteId: true }
  });
  if (!contentType) {
    throw ErrorHandlers.notFound('Content type');
  }
  await assertWebsiteOwnership(prisma as any, accountId, contentType.websiteId);
  return contentType;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content_type:view');

    const { id } = await params;

    // 3. Verify ownership of the content type's website
    await assertContentTypeOwnership(context.accountId, id);

    // 4. Get content type
    const contentType = await contentTypeService.getContentType(id);

    if (!contentType) {
      throw ErrorHandlers.notFound('Content type');
    }

    return successResponse(contentType);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content_type:edit');

    const { id } = await params;

    // 3. Verify ownership of the content type's website
    await assertContentTypeOwnership(context.accountId, id);

    // 4. Parse and validate request
    const body = await request.json();

    const validationResult = UpdateContentTypeSchema.safeParse(body);
    if (!validationResult.success) {
      throw ErrorHandlers.badRequest('Invalid request data', validationResult.error.errors);
    }

    // 5. Update content type
    const contentType = await contentTypeService.updateContentType(id, validationResult.data);

    return successResponse(contentType);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Get authorized context (includes role)
    const context = await getAuthorizedContext(request);

    // 2. Check permission
    await assertPermission(context, 'content_type:delete');

    const { id } = await params;

    // 3. Verify ownership of the content type's website
    await assertContentTypeOwnership(context.accountId, id);

    // 4. Parse request body for confirmation options
    let options: { confirm?: boolean; acknowledgement?: string } = {};
    try {
      const body = await request.json();
      options = {
        confirm: body.confirm,
        acknowledgement: body.acknowledgement,
      };
    } catch {
      // Body is optional - no confirmation provided
    }

    // 5. Delete content type (with cascade if confirmed)
    const result = await contentTypeService.deleteContentType(id, {
      confirm: options.confirm ?? false,
      acknowledgement: options.acknowledgement ?? '',
    });

    return successResponse(result);
  } catch (error) {
    // Handle confirmation required error specially
    if (error instanceof ConfirmationRequiredError) {
      return Response.json(
        {
          error: error.code,
          message: error.message,
          requiresConfirmation: true,
          impact: error.impact,
        },
        { status: 409 }
      );
    }
    return handleApiError(error);
  }
}