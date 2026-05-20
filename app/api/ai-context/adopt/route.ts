import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';
import { AIContextService } from '@/lib/services/ai-context-service';

const AdoptSessionSchema = z.object({
  sourceSessionId: z.string().min(1),
  targetSessionId: z.string().min(1),
  websiteId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    const validation = AdoptSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const { websiteId, sourceSessionId, targetSessionId } = validation.data;

    await assertWebsiteOwnership(prisma, auth.accountId, websiteId);

    const context = await AIContextService.adoptAccountSession(
      auth.accountId,
      sourceSessionId,
      websiteId,
      targetSessionId
    );

    return NextResponse.json({ data: context });
  } catch (error) {
    return handleApiError(error);
  }
}
