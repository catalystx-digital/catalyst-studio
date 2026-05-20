import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { resolveAccountParam } from '@/lib/auth/account-param';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';

const service = new ApiKeyService(prisma);

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(value => {
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ accountId: string; keyId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const { accountId: accountParam, keyId } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);

    const parsedQuery = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

    if (!parsedQuery.success) {
      throw ErrorHandlers.badRequest('Invalid query params', parsedQuery.error.flatten());
    }

    const limit = parsedQuery.data.limit;

    const events = await service.getEvents(accountId, keyId, { limit });
    return Response.json({ data: events });
  } catch (error) {
    return handleApiError(error);
  }
}
