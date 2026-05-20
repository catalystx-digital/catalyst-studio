import { NextRequest } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { resolveAccountParam } from '@/lib/auth/account-param';
import { ApiKeyService } from '@/lib/services/api-key-service';
import { prisma } from '@/lib/prisma';
import { handleApiError, ErrorHandlers } from '@/lib/api/errors';
import { AccountApiKeyScope } from '@/lib/generated/prisma';

const service = new ApiKeyService(prisma);

const listQuerySchema = z.object({
  websiteId: z
    .string()
    .optional()
    .transform(value => (value?.trim() ? value.trim() : undefined)),
});

const createSchema = z.object({
  label: z.string().min(1).max(120),
  websiteId: z
    .string()
    .optional()
    .transform(value => (value?.trim() ? value.trim() : undefined)),
  scopes: z
    .array(z.nativeEnum(AccountApiKeyScope))
    .optional()
    .refine(value => !value || value.length > 0, 'Scopes cannot be empty'),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const { accountId: accountParam } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);
    const parsedQuery = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const keys = await service.list(accountId, parsedQuery.websiteId ?? null);
    return Response.json({ data: keys });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      throw ErrorHandlers.badRequest('Invalid payload', parsed.error.flatten());
    }

    const { accountId: accountParam } = await params;
    const accountId = resolveAccountParam(accountParam, auth.accountId);

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;

    const result = await service.create(accountId, {
      label: parsed.data.label,
      websiteId: parsed.data.websiteId,
      scopes: parsed.data.scopes,
      expiresAt,
      actorId: auth.userId,
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
