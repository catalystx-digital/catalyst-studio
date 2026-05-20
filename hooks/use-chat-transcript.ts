'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { AIContext, AIMessage } from '@/types/ai-context';

type TranscriptScope = 'website' | 'account';

export type TranscriptMessage = AIMessage & { id: string };

interface TranscriptEntry {
  key: string;
  sessionId: string;
  scope: TranscriptScope;
  websiteId: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  hydrated: boolean;
  hasContext: boolean;
  context: AIContext | null;
  messages: TranscriptMessage[];
  error: Error | null;
  revision: string | null;
}

interface TranscriptStoreState {
  entries: Record<string, TranscriptEntry>;
  initializeEntry: (entry: TranscriptEntry) => void;
  updateEntry: (key: string, updater: (entry: TranscriptEntry) => TranscriptEntry) => void;
  setEntry: (key: string, next: Partial<TranscriptEntry>) => void;
}

const MAX_APPEND_ATTEMPTS = 2;

const createEmptyEntry = (
  key: string,
  sessionId: string,
  scope: TranscriptScope,
  websiteId: string | null
): TranscriptEntry => ({
  key,
  sessionId,
  scope,
  websiteId,
  status: 'idle',
  hydrated: false,
  hasContext: false,
  context: null,
  messages: [],
  error: null,
  revision: null,
});

const useTranscriptStore = create<TranscriptStoreState>((set) => ({
  entries: {},
  initializeEntry: (entry) =>
    set((state) => {
      if (state.entries[entry.key]) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [entry.key]: entry,
        },
      };
    }),
  updateEntry: (key, updater) =>
    set((state) => {
      const current = state.entries[key];
      if (!current) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: updater(current),
        },
      };
    }),
  setEntry: (key, next) =>
    set((state) => {
      const current = state.entries[key];
      if (!current) {
        return state;
      }
      return {
        entries: {
          ...state.entries,
          [key]: {
            ...current,
            ...next,
          },
        },
      };
    }),
}));

const hydrationPromises = new Map<string, Promise<void>>();

const getScopeKey = (scope: TranscriptScope, websiteId: string | null) =>
  scope === 'website' ? websiteId ?? 'website' : 'account';

const computeKey = (scope: TranscriptScope, websiteId: string | null, sessionId: string) =>
  `${scope}:${websiteId ?? 'none'}:${sessionId}`;

const normalizeTimestamp = (timestamp?: Date | string | number): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const hashSignature = (input: string): string => {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
};

const ensureMessageId = (
  message: AIMessage,
  fallbackSalt: string,
  position: number
): string => {
  if (message.id && typeof message.id === 'string') {
    return message.id;
  }

  const metadataId =
    message.metadata && typeof (message.metadata as Record<string, unknown>).id === 'string'
      ? ((message.metadata as Record<string, unknown>).id as string)
      : undefined;
  if (metadataId) {
    return metadataId;
  }

  const idempotencyKey =
    message.metadata && typeof (message.metadata as Record<string, unknown>).idempotencyKey === 'string'
      ? ((message.metadata as Record<string, unknown>).idempotencyKey as string)
      : undefined;
  if (idempotencyKey) {
    return idempotencyKey;
  }

  const timestamp = normalizeTimestamp(message.timestamp).toISOString();
  const signature = `${fallbackSalt}:${position}:${message.role}:${timestamp}:${message.content}`;
  return `msg_${hashSignature(signature)}`;
};

const normalizeMessages = (
  messages: AIMessage[] | undefined,
  fallbackSalt: string
): TranscriptMessage[] => {
  if (!messages || messages.length === 0) {
    return [];
  }

  return messages.map((message, index) => ({
    ...message,
    id: ensureMessageId(message, fallbackSalt, index),
    timestamp: normalizeTimestamp(message.timestamp),
  }));
};

const getEntryRevision = (entry?: TranscriptEntry | null): string | undefined =>
  entry?.context?.metadata?.revision ?? entry?.revision ?? undefined;

const buildContextUrl = (
  sessionId: string,
  scope: TranscriptScope,
  websiteId: string | null
) => {
  const params = new URLSearchParams();
  if (scope === 'website') {
    if (!websiteId) {
      throw new Error('websiteId is required for website scoped transcripts');
    }
    params.set('websiteId', websiteId);
  } else {
    params.set('scope', 'account');
  }
  return `/api/ai-context/${sessionId}?${params.toString()}`;
};

async function fetchContext(
  sessionId: string,
  scope: TranscriptScope,
  websiteId: string | null
): Promise<{ context: AIContext | null; hasContext: boolean }> {
  try {
    const response = await fetch(buildContextUrl(sessionId, scope, websiteId), {
      cache: 'no-store',
    });

    if (response.status === 404) {
      return { context: null, hasContext: false };
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error?.message ?? 'Failed to load transcript');
    }

    const payload = await response.json();
    return { context: payload.data as AIContext, hasContext: true };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to load transcript');
  }
}

interface HydrateOptions {
  preserveHydration?: boolean;
}

async function hydrateTranscript(
  entry: TranscriptEntry,
  options?: HydrateOptions
): Promise<void> {
  const key = entry.key;
  const shouldPreserveHydration = options?.preserveHydration ?? entry.hydrated;
  const promise = (async () => {
    try {
      useTranscriptStore.getState().setEntry(key, {
        status: 'loading',
        error: null,
        ...(shouldPreserveHydration ? {} : { hydrated: false }),
      });

      const { context, hasContext } = await fetchContext(entry.sessionId, entry.scope, entry.websiteId);
      const normalizedMessages = normalizeMessages(
        context?.messages,
        `${entry.sessionId}:${getScopeKey(entry.scope, entry.websiteId)}`
      );

      useTranscriptStore.getState().setEntry(key, {
        status: 'success',
        hydrated: true,
        hasContext,
        context: context
          ? {
              ...context,
              messages: normalizedMessages,
            }
          : null,
        messages: normalizedMessages,
        error: null,
        revision: context?.metadata?.revision ?? null,
      });
    } catch (error) {
      useTranscriptStore.getState().setEntry(key, {
        status: 'error',
        hydrated: shouldPreserveHydration ? entry.hydrated : true,
        hasContext: false,
        error: error instanceof Error ? error : new Error('Failed to load transcript'),
      });
    }
  })().finally(() => {
    hydrationPromises.delete(key);
  });

  hydrationPromises.set(key, promise);
  await promise;
}

export interface TranscriptAppendMessage extends Partial<AIMessage> {
  id?: string;
  role: AIMessage['role'];
  content: string;
  timestamp?: Date | string;
}

export interface UseChatTranscriptOptions {
  sessionId: string;
  websiteId?: string | null;
  scope?: TranscriptScope;
  enabled?: boolean;
}

export interface UseChatTranscriptResult {
  key: string;
  status: TranscriptEntry['status'];
  hydrated: boolean;
  error: Error | null;
  messages: TranscriptMessage[];
  context: AIContext | null;
  hasContext: boolean;
  revision: string | null;
  append: (messages: TranscriptAppendMessage[]) => Promise<void>;
  refresh: () => Promise<void>;
  syncContext: (context: AIContext | null, hasContext?: boolean) => void;
}

export function useChatTranscript({
  sessionId,
  websiteId = null,
  scope = 'website',
  enabled = true,
}: UseChatTranscriptOptions): UseChatTranscriptResult {
  const key = useMemo(() => computeKey(scope, websiteId, sessionId), [scope, websiteId, sessionId]);

  useEffect(() => {
    const entry = createEmptyEntry(key, sessionId, scope, websiteId);
    useTranscriptStore.getState().initializeEntry(entry);
  }, [key, sessionId, scope, websiteId]);

  const entry = useTranscriptStore((state) => state.entries[key]) ?? createEmptyEntry(key, sessionId, scope, websiteId);

  useEffect(() => {
    if (!enabled) {
      useTranscriptStore.getState().setEntry(key, {
        hydrated: true,
        status: 'success',
        hasContext: false,
        context: null,
        revision: null,
      });
      return;
    }

    if (entry.hydrated || hydrationPromises.has(key) || entry.status === 'loading') {
      return;
    }

    void hydrateTranscript(entry);
  }, [enabled, entry, key]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const latestEntry = useTranscriptStore.getState().entries[key] ?? entry;
    await hydrateTranscript(
      {
        ...latestEntry,
      },
      { preserveHydration: Boolean(latestEntry?.hydrated) }
    );
  }, [enabled, entry, key]);

  const append = useCallback(
    async (messages: TranscriptAppendMessage[]) => {
      if (!enabled || messages.length === 0) {
        return;
      }

      const store = useTranscriptStore.getState();
      const getEntrySnapshot = () => useTranscriptStore.getState().entries[key];
      let currentEntry = getEntrySnapshot();
      if (!currentEntry) {
        return;
      }

      const salt = `${currentEntry.sessionId}:${getScopeKey(currentEntry.scope, currentEntry.websiteId)}`;
      const normalizedMessages = normalizeMessages(
        messages.map((message) => ({
          ...message,
          timestamp: normalizeTimestamp(message.timestamp),
        })) as AIMessage[],
        salt
      );

      const existingById = new Map(currentEntry.messages.map((message) => [message.id, message]));
      const pending = normalizedMessages.filter((message) => {
        const existing = existingById.get(message.id);
        if (!existing) {
          return true;
        }
        return !areMessagesEqual(existing, message);
      });

      if (pending.length === 0) {
        return;
      }

      let currentRevision = getEntryRevision(currentEntry);

      for (const payload of pending) {
        // Skip if the latest entry already includes this message.
        currentEntry = getEntrySnapshot() ?? currentEntry;
        const existing = currentEntry.messages.find((message) => message.id === payload.id);
        if (existing && areMessagesEqual(existing, payload)) {
          currentRevision = getEntryRevision(currentEntry) ?? currentRevision;
          continue;
        }

        let attempt = 0;
        while (attempt < MAX_APPEND_ATTEMPTS) {
          attempt += 1;
          currentEntry = getEntrySnapshot() ?? currentEntry;

          const params = new URLSearchParams();
          if (currentEntry.scope === 'website') {
            if (!currentEntry.websiteId) {
              throw new Error('websiteId is required for website scoped transcripts');
            }
            params.set('websiteId', currentEntry.websiteId);
          } else {
            params.set('scope', 'account');
          }

          const body = {
            message: {
              ...payload,
              timestamp: normalizeTimestamp(payload.timestamp).toISOString(),
            },
            revision: currentRevision,
          };

          const response = await fetch(
            `/api/ai-context/${currentEntry.sessionId}/messages?${params.toString()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          );

          if (response.status === 409) {
            if (attempt >= MAX_APPEND_ATTEMPTS) {
              await refresh();
              throw new Error('Transcript is out of date. Please retry.');
            }
            console.warn('[useChatTranscript] Transcript revision mismatch, retrying append', {
              messageId: payload.id,
              attempt,
              maxAttempts: MAX_APPEND_ATTEMPTS,
            });
            await refresh();
            currentEntry = getEntrySnapshot() ?? currentEntry;
            currentRevision = getEntryRevision(currentEntry) ?? currentRevision;
            continue;
          }

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload?.error?.message ?? 'Failed to append message');
          }

          const payloadContext = (await response.json()).data as AIContext;
          const nextMessages = normalizeMessages(
            payloadContext.messages,
            `${payloadContext.sessionId}:${getScopeKey(currentEntry.scope, currentEntry.websiteId)}`
          );

          store.setEntry(key, {
            context: {
              ...payloadContext,
              messages: nextMessages,
            },
            messages: nextMessages,
            hasContext: true,
            status: 'success',
            hydrated: true,
            error: null,
            revision: payloadContext.metadata?.revision ?? currentRevision ?? null,
          });

          currentRevision = payloadContext.metadata?.revision ?? currentRevision;
          break;
        }
      }
    },
    [enabled, key, refresh]
  );

  const syncContext = useCallback(
    (context: AIContext | null, hasContext = context !== null) => {
      const normalizedMessages = normalizeMessages(
        context?.messages,
        `${sessionId}:${getScopeKey(scope, websiteId)}`
      );
      useTranscriptStore.getState().setEntry(key, {
        context: context
          ? {
              ...context,
              messages: normalizedMessages,
            }
          : null,
        messages: normalizedMessages,
        hasContext,
        hydrated: true,
        status: hasContext ? 'success' : 'idle',
        revision: context?.metadata?.revision ?? null,
      });
    },
    [key, scope, sessionId, websiteId]
  );

  return {
    key,
    status: entry.status,
    hydrated: entry.hydrated || !enabled,
    error: entry.error,
    messages: entry.messages,
    context: entry.context,
    hasContext: entry.hasContext,
    revision: entry.context?.metadata?.revision ?? entry.revision,
    append,
    refresh,
    syncContext,
  };
}
const serializeMetadata = (metadata?: unknown): string => {
  if (metadata === undefined) {
    return '';
  }
  try {
    return JSON.stringify(metadata);
  } catch {
    return '';
  }
};

const areMessagesEqual = (a: TranscriptMessage, b: TranscriptMessage): boolean => {
  if (a.role !== b.role || a.content !== b.content) {
    return false;
  }
  const aTimestamp = normalizeTimestamp(a.timestamp).toISOString();
  const bTimestamp = normalizeTimestamp(b.timestamp).toISOString();
  if (aTimestamp !== bTimestamp) {
    return false;
  }
  return serializeMetadata(a.metadata) === serializeMetadata(b.metadata);
};
