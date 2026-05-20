import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthContext } from '@/lib/auth/context';
import { ErrorHandlers, handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { IntegrationStatus } from '@/lib/generated/prisma';
import { IntegrationService } from '@/lib/studio/services/integration-service';
import { enumToSlug, slugToEnum } from '@/lib/studio/integrations/definitions';
import {
  getEnabledIntegrationProviderSlugs,
  IntegrationProviderSlug,
  isIntegrationProviderEnabled,
} from '@/lib/studio/integrations/provider-config';

const enabledProviders = getEnabledIntegrationProviderSlugs();
const providerChoices = (enabledProviders.length ? enabledProviders : (['mock'] as IntegrationProviderSlug[])) as [
  IntegrationProviderSlug,
  ...IntegrationProviderSlug[],
];

const providerSchema = z.enum(providerChoices);

const createSchema = z.object({
  provider: providerSchema,
  displayName: z.string().min(1, 'displayName is required').max(120),
  config: z.record(z.any()).default({}),
});

const listSchema = z.object({
  includeDisabled: z
    .string()
    .optional()
    .transform(value => value === 'true'),
});

function getService() {
  return new IntegrationService(prisma);
}

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request);
    const service = getService();
    const search = listSchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const data = await service.list(accountId);
    const filtered = search.includeDisabled ? data : data.filter(item => item.status !== IntegrationStatus.disabled);
    const serialised = filtered.map(item => {
      const provider = enumToSlug(item.provider);
      return {
        ...item,
        provider,
        providerDisabled: item.providerDisabled || !isIntegrationProviderEnabled(provider),
      };
    });

    return NextResponse.json({ data: serialised });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    const parsedResult = createSchema.safeParse(body);

    if (!parsedResult.success) {
      throw ErrorHandlers.badRequest('Invalid request body', parsedResult.error.flatten());
    }

    const parsed = parsedResult.data;
    const service = getService();
    const result = await service.create(auth.accountId, {
      provider: slugToEnum(parsed.provider),
      displayName: parsed.displayName,
      config: parsed.config,
      actorId: auth.userId,
    });
    const provider = enumToSlug(result.provider);

    return NextResponse.json({
      data: {
        ...result,
        provider,
        providerDisabled: result.providerDisabled || !isIntegrationProviderEnabled(provider),
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

