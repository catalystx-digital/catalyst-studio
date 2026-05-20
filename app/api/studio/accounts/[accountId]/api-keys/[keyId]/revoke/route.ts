import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { resolveAccountParam } from '@/lib/auth/account-param';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';

const service = new ApiKeyService(prisma);

const revokeSchema = z.object({
  reason: z.string().max(280).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string; keyId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const { accountId: accountParam, keyId } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);

    const body = await request.json().catch(() => ({}));
    const parsed = revokeSchema.safeParse(body ?? {});

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid payload', parsed.error.flatten());
    }

    const result = await service.revoke(accountId, keyId, {
      actorId: auth.userId,
      reason: parsed.data.reason,
    });

    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
