import { NextRequest, NextResponse } from 'next/server';
import { AIContextService } from '@/lib/services/ai-context-service';
import { UpdateAIContextSchema } from '@/lib/api/validation/ai-context';
import { handleApiError } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/prisma';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// GET /api/ai-context/[sessionId] - Retrieve specific session context
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await getAuthContext(request);
    const scope = request.nextUrl.searchParams.get('scope');
    const isAccountScope = scope === 'account';

    if (!isAccountScope) {
      const websiteId = request.nextUrl.searchParams.get('websiteId');
      if (!websiteId) {
        return NextResponse.json(
          { error: { message: 'websiteId is required' } },
          { status: 400 }
        );
      }

      await assertWebsiteOwnership(prisma, auth.accountId, websiteId);

      const context = await AIContextService.getAIContext(websiteId, sessionId, auth.accountId);
      
      if (!context) {
        return NextResponse.json(
          { error: { message: 'AI context not found' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ data: context });
    }

    const context = await AIContextService.getAIContext(null, sessionId, auth.accountId);

    if (!context) {
      return NextResponse.json(
        { error: { message: 'AI context not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: context });
    
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/ai-context/[sessionId] - Update context (append messages)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const scope = request.nextUrl.searchParams.get('scope');
    const isAccountScope = scope === 'account';
    
    const body = await request.json();
    
    // Validate request body
    const validation = UpdateAIContextSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }
    const { metadata, summary, isActive } = validation.data;

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

    const updated = await AIContextService.updateMetadata(
      websiteId,
      sessionId,
      { metadata, summary, isActive },
      auth.accountId
    );

    return NextResponse.json({ data: updated });
    
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/ai-context/[sessionId] - Soft delete context session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await getAuthContext(request);
    const scope = request.nextUrl.searchParams.get('scope');
    const isAccountScope = scope === 'account';
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

    await AIContextService.deleteContext(websiteId, sessionId, auth.accountId);
    
    return NextResponse.json({ data: { success: true } });
    
  } catch (error) {
    return handleApiError(error);
  }
}
