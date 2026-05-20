import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { ChatLogPayloadSchema } from '@/lib/api/validation/chat-log';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { prisma } from '@/lib/prisma';
import { AIContextService } from '@/lib/services/ai-context-service';
import { checkAndRecordUsage, QuotaExceededError } from '@/lib/usage/limits';
import { estimateTokenCount } from '@/lib/utils/ai-context-pruning';
import type { AIMessage } from '@/types/ai-context';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const rawBody = await request.json();
    const validation = ChatLogPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request body', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const payload = validation.data;
    const scope: 'website' | 'account' = payload.scope ?? (payload.websiteId ? 'website' : 'account');

    if (scope === 'website' && !payload.websiteId) {
      return NextResponse.json(
        { error: { message: 'websiteId is required when logging against a website' } },
        { status: 400 }
      );
    }

    if (payload.websiteId) {
      await assertWebsiteOwnership(prisma, auth.accountId, payload.websiteId);
    }

    const metadata = {
      ...(payload.metadata ?? {}),
      scope: payload.metadata?.scope ?? { type: 'site', label: 'Dashboard Prompt' },
      idempotencyKey: payload.idempotencyKey,
      source: payload.metadata?.source ?? 'dashboard',
      scopeLabel: payload.metadata?.scopeLabel ?? 'Dashboard Prompt',
    } satisfies Record<string, unknown>;

    const normalizedMessage: AIMessage = {
      id: payload.message.id ?? payload.idempotencyKey ?? undefined,
      role: 'user',
      content: payload.message.content,
      timestamp: payload.message.timestamp ? new Date(payload.message.timestamp) : new Date(),
      metadata,
    };

    const targetWebsiteId = scope === 'website' ? payload.websiteId ?? null : null;

    const estimatedTokens = estimateTokenCount([
      { role: 'user', content: payload.message.content, timestamp: new Date().toISOString() } as AIMessage,
    ]);

    try {
      await checkAndRecordUsage(prisma, auth.accountId, 'chat_sessions', 1, {
        metadata: {
          websiteId: targetWebsiteId,
          sessionId: payload.sessionId,
          scope,
          source: 'dashboard',
        },
      });
      await checkAndRecordUsage(prisma, auth.accountId, 'chat_tokens', Math.max(1, estimatedTokens), {
        metadata: {
          websiteId: targetWebsiteId,
          sessionId: payload.sessionId,
          scope,
          source: 'dashboard',
        },
      });
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          { error: { message: error.message, code: error.code, details: error.details } },
          { status: error.statusCode }
        );
      }
      return NextResponse.json({ error: { message: 'Chat logging limit reached' } }, { status: 429 });
    }
    const existingContext = await AIContextService.getAIContext(targetWebsiteId, payload.sessionId, auth.accountId);

    let wasDeduped = false;

    if (payload.idempotencyKey && existingContext) {
      wasDeduped = existingContext.messages.some(
        (message) => message.metadata?.idempotencyKey === payload.idempotencyKey
      );
    }

    if (!existingContext) {
      await AIContextService.createAIContext(targetWebsiteId, normalizedMessage, payload.sessionId, auth.accountId);
    } else if (!wasDeduped) {
      await AIContextService.appendMessage(targetWebsiteId, payload.sessionId, normalizedMessage, true, auth.accountId);
    }

    if (process.env.NODE_ENV !== 'test') {
      console.info('[chat-log] persisted prompt', {
        accountId: auth.accountId,
        websiteId: targetWebsiteId,
        sessionId: payload.sessionId,
        idempotencyKey: payload.idempotencyKey,
        scope,
        deduped: wasDeduped,
      });
    }

    return NextResponse.json({
      data: {
        scope,
        sessionId: payload.sessionId,
        websiteId: targetWebsiteId,
        deduped: wasDeduped,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
