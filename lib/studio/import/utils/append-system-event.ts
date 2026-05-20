import { AIContextService } from '@/lib/services/ai-context-service';
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session';
import type { AIMessage } from '@/types/ai-context';

interface AppendSystemEventOptions {
  websiteId: string;
  accountId: string;
  content: string;
  metadata: Record<string, unknown>;
  sessionId?: string;
  id?: string;
}

const generateEventId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export async function appendSystemEvent({
  websiteId,
  accountId,
  content,
  metadata,
  sessionId,
  id,
}: AppendSystemEventOptions): Promise<void> {
  const resolvedSessionId = sessionId ?? getBuilderAssistantSessionId(websiteId);
  const message: AIMessage = {
    id: id ?? generateEventId(metadata.type ? String(metadata.type) : 'system-event'),
    role: 'system',
    content,
    timestamp: new Date(),
    metadata,
  };

  try {
    // Retry on revision conflicts to avoid dropping system events when concurrent writes occur
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const existing = await AIContextService.getAIContext(websiteId, resolvedSessionId, accountId);
      const revision = existing?.metadata?.revision;

      if (!existing) {
        await AIContextService.createAIContext(websiteId, message, resolvedSessionId, accountId);
        return;
      }

      try {
        await AIContextService.appendMessage(
          websiteId,
          resolvedSessionId,
          message,
          true,
          accountId,
          revision
        );
        return;
      } catch (error: any) {
        const isConflict = error?.statusCode === 409 || error?.code === 409;
        const shouldRetry = isConflict && attempt < maxAttempts - 1;
        if (!shouldRetry) {
          throw error;
        }
        // Small backoff before retrying with the latest revision
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
    }
  } catch (error) {
    // Non-blocking; log for observability in development
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[appendSystemEvent] Failed to append system event', {
        websiteId,
        sessionId: resolvedSessionId,
        error,
      });
    }
  }
}
