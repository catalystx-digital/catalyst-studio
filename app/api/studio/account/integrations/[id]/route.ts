import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { ErrorHandlers, handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { IntegrationStatus } from '@/lib/generated/prisma';
import { IntegrationService } from '@/lib/studio/services/integration-service';
import { enumToSlug } from '@/lib/studio/integrations/definitions';

const updateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  status: z.nativeEnum(IntegrationStatus).optional(),
  config: z.record(z.any()).optional(),
});

const deleteSchema = z.object({
  hardDelete: z
    .string()
    .optional()
    .transform(value => value === 'true'),
});

function getService() {
  return new IntegrationService(prisma);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      throw ErrorHandlers.badRequest('Integration id is required');
    }

    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsedResult = updateSchema.safeParse(body);

    if (!parsedResult.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsedResult.error.flatten());
    }

    const parsed = parsedResult.data;
    const service = getService();
    const result = await service.update(auth.accountId, id, {
      displayName: parsed.displayName,
      status: parsed.status,
      config: parsed.config,
      actorId: auth.userId,
    });

    const provider = enumToSlug(result.provider);

    return NextResponse.json({
      data: {
        ...result,
        provider,
        providerDisabled: result.providerDisabled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      throw ErrorHandlers.badRequest('Integration id is required');
    }

    const auth = await getAuthContext(request);
    const parsedQuery = deleteSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

    if (!parsedQuery.success) {
      throw ErrorHandlers.badRequest('Invalid request query', parsedQuery.error.flatten());
    }

    const service = getService();
    await service.delete(auth.accountId, id, {
      actorId: auth.userId,
      hardDelete: parsedQuery.data.hardDelete,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
