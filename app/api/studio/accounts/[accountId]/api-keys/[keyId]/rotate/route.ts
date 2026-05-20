import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { resolveAccountParam } from '@/lib/auth/account-param';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';

const service = new ApiKeyService(prisma);

const rotateSchema = z.object({
  note: z.string().max(280).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string; keyId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const { accountId: accountParam, keyId } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);

    const body = await request.json().catch(() => ({}));
    const parsed = rotateSchema.safeParse(body ?? {});

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid payload', parsed.error.flatten());
    }

    const result = await service.rotate(accountId, keyId, {
      actorId: auth.userId,
      note: parsed.data.note,
    });

    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
