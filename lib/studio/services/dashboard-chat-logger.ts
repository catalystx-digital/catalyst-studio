const DASHBOARD_SESSION_PREFIX = 'dashboard';

function hashPrompt(content: string): number {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDashboardSessionId(accountId: string): string {
  return `${DASHBOARD_SESSION_PREFIX}-${accountId}`;
}

export function createPromptIdempotencyKey(sessionId: string, prompt: string): string {
  const normalized = prompt.trim().slice(0, 256);
  const hash = hashPrompt(`${sessionId}:${normalized}`);
  const nonce = Date.now().toString(36);
  return `${sessionId}:${hash.toString(36)}:${nonce}`;
}

const DEFAULT_TIMEOUT_MS = 4000;

type LogDashboardPromptInput = {
  sessionId: string;
  prompt: string;
  idempotencyKey: string;
  websiteId?: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
};

export async function logDashboardPrompt({
  sessionId,
  prompt,
  idempotencyKey,
  websiteId,
  metadata,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LogDashboardPromptInput): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api/chat/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        sessionId,
        websiteId,
        idempotencyKey,
        message: {
          content: prompt,
          timestamp: new Date().toISOString(),
        },
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message ?? 'Failed to record prompt');
    }
  } finally {
    clearTimeout(timeout);
  }
}

type AdoptChatSessionInput = {
  sourceSessionId: string;
  websiteId: string;
  targetSessionId: string;
};

export async function adoptDashboardChatSession({
  sourceSessionId,
  websiteId,
  targetSessionId,
}: AdoptChatSessionInput): Promise<void> {
  const response = await fetch('/api/ai-context/adopt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceSessionId,
      websiteId,
      targetSessionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message ?? 'Failed to adopt chat session');
  }
}
