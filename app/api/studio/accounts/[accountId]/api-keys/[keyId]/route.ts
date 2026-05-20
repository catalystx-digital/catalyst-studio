import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { resolveAccountParam } from '@/lib/auth/account-param';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';

const service = new ApiKeyService(prisma);

const updateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .or(z.literal(null))
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ accountId: string; keyId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const { accountId: accountParam, keyId } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid payload', parsed.error.flatten());
    }

    const result = await service.update(accountId, keyId, {
      label: parsed.data.label,
      expiresAt: parsed.data.expiresAt === undefined ? undefined : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      actorId: auth.userId,
    });

    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
