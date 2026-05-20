import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext } from '@/lib/auth/context';
import { ErrorHandlers, handleApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { IntegrationService } from '@/lib/studio/services/integration-service';

function getService() {
  return new IntegrationService(prisma);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      throw ErrorHandlers.badRequest('Integration id is required');
    }

    const auth = await getAuthContext(request);
    const service = getService();
    const result = await service.test(auth.accountId, id, { actorId: auth.userId });

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
