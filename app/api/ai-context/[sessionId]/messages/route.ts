import { NextRequest, NextResponse } from 'next/server';
import { AIContextService } from '@/lib/services/ai-context-service';
import { AppendMessageSchema } from '@/lib/api/validation/ai-context';
import { handleApiError } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';

// POST /api/ai-context/[sessionId]/messages - Append new message to context
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const scope = request.nextUrl.searchParams.get('scope');
    const isAccountScope = scope === 'account';

    const auth = await getAuthContext(request);

    let websiteId: string | null = null;
    if (!isAccountScope) {
      websiteId = request.nextUrl.searchParams.get('websiteId');

      if (!websiteId) {
        return NextResponse.json(
          { error: { message: 'websiteId is required' } },
          { status: 400 }
        );
      }

      await assertWebsiteOwnership(prisma, auth.accountId, websiteId);
    }
    
    const body = await request.json();
    
    // Validate request body
    const validation = AppendMessageSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    
    const { message, pruneIfNeeded, revision } = validation.data;
    
    const context = await AIContextService.appendMessage(
      websiteId,
      sessionId,
      message,
      pruneIfNeeded,
      auth.accountId,
      revision
    );
    
    return NextResponse.json({ data: context });
    
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/ai-context/[sessionId]/messages - Clear messages (keep session)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const scope = request.nextUrl.searchParams.get('scope');
    const isAccountScope = scope === 'account';
    const auth = await getAuthContext(request);

    let websiteId: string | null = null;
    if (!isAccountScope) {
      websiteId = request.nextUrl.searchParams.get('websiteId');
      if (!websiteId) {
        return NextResponse.json(
          { error: { message: 'websiteId is required' } },
          { status: 400 }
        );
      }

      await assertWebsiteOwnership(prisma, auth.accountId, websiteId);
    }
    
    const context = await AIContextService.clearContext(websiteId, sessionId, auth.accountId);
    
    return NextResponse.json({ data: context });
    
  } catch (error) {
    return handleApiError(error);
  }
}
