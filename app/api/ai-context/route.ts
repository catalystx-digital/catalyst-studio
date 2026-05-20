import { NextRequest, NextResponse } from 'next/server';
import { AIContextService } from '@/lib/services/ai-context-service';
import { CreateAIContextSchema, GetAIContextsSchema } from '@/lib/api/validation/ai-context';
import { handleApiError } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/prisma';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/ai-context - List contexts by websiteId
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Validate query parameters
    const validation = GetAIContextsSchema.safeParse({
      websiteId: searchParams.get('websiteId'),
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
    });
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid query parameters', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const { websiteId, limit, offset, isActive } = validation.data;

    // Ownership check if websiteId provided
    const auth = await getAuthContext(request);
    if (websiteId) {
      await assertWebsiteOwnership(prisma, auth.accountId, websiteId);
    }

    const result = await AIContextService.getAIContexts(websiteId, {
      limit,
      offset,
      isActive
    });
    
    return NextResponse.json({ data: result });
    
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/ai-context - Create new context session
export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: 'Invalid JSON in request body' } },
        { status: 400 }
      );
    }

    const validation = CreateAIContextSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const auth = await getAuthContext(request);
    const body = validation.data;
    let context;

    if ('scope' in body && body.scope === 'account') {
      context = await AIContextService.createAIContext(
        null,
        body.initialMessage,
        body.sessionId,
        auth.accountId
      );
    } else {
      // TypeScript narrowing: body is the website scope variant
      const websiteBody = body as { websiteId: string; sessionId?: string; initialMessage?: { role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date; metadata?: Record<string, unknown>; id?: string } };
      const { websiteId, sessionId, initialMessage } = websiteBody;
      await assertWebsiteOwnership(prisma, auth.accountId, websiteId);
      context = await AIContextService.createAIContext(
        websiteId,
        initialMessage,
        sessionId,
        auth.accountId
      );
    }
    
    return NextResponse.json({ data: context }, { status: 201 });
    
  } catch (error) {
    return handleApiError(error);
  }
}
