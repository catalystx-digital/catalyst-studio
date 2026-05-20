'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIMessage as AIMessage } from 'ai';
import {
  useCreateAIContext,
  useClearContext,
} from '@/lib/api/hooks/use-ai-context';
import type { AIContext, AIMessage as ContextAIMessage } from '@/types/ai-context';
import {
  TranscriptAppendMessage,
  useChatTranscript,
} from '@/hooks/use-chat-transcript';

/**
 * Extract text content from AI SDK v5 message parts array
 * AI SDK v5 uses `parts` array with { type: 'text', text: string } objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromParts(parts: any[]): string {
  return parts
    .filter((part): part is { type: 'text'; text: string } =>
      part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part
    )
    .map(part => part.text)
    .join('');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeContent(content: any, parts?: any[]): string {
  // AI SDK v5: Check for parts array first (new format)
  if (parts && Array.isArray(parts) && parts.length > 0) {
    const textFromParts = extractTextFromParts(parts);
    if (textFromParts) {
      return textFromParts;
    }
  }

  // Fallback to content field (old format or simple string)
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return (content as unknown[])
      .map((entry) =>
        typeof entry === 'string' ? entry : JSON.stringify(entry),
      )
      .join('\n')
      .trim();
  }

  if (content === null || content === undefined) {
    return '';
  }

  return JSON.stringify(content);
}

function extractMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotations: any,
): Record<string, unknown> | undefined {
  if (!annotations) {
    return undefined;
  }

  if (Array.isArray(annotations)) {
    return annotations.reduce<Record<string, unknown>>((acc, entry) => {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        Object.assign(acc, entry);
      }
      return acc;
    }, {});
  }

  if (typeof annotations === 'object') {
    return { ...(annotations as Record<string, unknown>) };
  }

  return undefined;
}

function convertAiMessages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiMessages: any[],
): TranscriptAppendMessage[] {
  const result: TranscriptAppendMessage[] = [];

  for (const message of aiMessages) {
    // AI SDK v5: Extract content from parts array if available, fallback to content field
    const content = normalizeContent(message.content, message.parts);
    if (!content.trim()) {
      continue;
    }

    result.push({
      id: message.id,
      role: message.role as TranscriptAppendMessage['role'],
      content,
      timestamp: message.createdAt ?? new Date(),
      metadata: extractMetadata(message.annotations),
    });
  }

  return result;
}

interface UseChatPersistenceOptions {
  websiteId: string | null;
  accountId?: string | null;
  sessionId: string;
  enabled?: boolean;
  autoSaveDelay?: number;
  onLoadStart?: () => void;
  onLoadComplete?: (messages: ContextAIMessage[]) => void;
  onLoadError?: (error: Error) => void;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

interface UseChatPersistenceReturn {
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveCount: number;
  storageStrategy: string;
  storageUsage: { usage: number; quota: number; percentage: number } | null;
  error: Error | null;
  saveMessages: (messages: AIMessage[]) => Promise<void>;
  saveMessagesImmediate: (messages: AIMessage[]) => Promise<void>;
  loadMessages: () => Promise<ContextAIMessage[]>;
  clearMessages: () => Promise<void>;
  exportMessages: () => Promise<string>;
  importMessages: (jsonData: string) => Promise<void>;
  contextData?: AIContext | null;
}

export function useChatPersistence({
  websiteId,
  accountId = null,
  sessionId,
  enabled = true,
  autoSaveDelay = 500,
  onLoadStart,
  onLoadComplete,
  onLoadError,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseChatPersistenceOptions): UseChatPersistenceReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const [localError, setLocalError] = useState<Error | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessagesRef = useRef<AIMessage[]>([]);
  const saveMessagesImmediateRef = useRef<(messages: AIMessage[]) => Promise<void>>(async () => {});
  const hasAnnouncedLoadRef = useRef(false);
  const isCreatingContextRef = useRef(false);
  const creationGiveUpRef = useRef(false);

  const hasWebsiteScope = !!websiteId && websiteId !== 'default';
  const hasAccountScope = !!accountId;
  const scope: 'website' | 'account' = hasWebsiteScope ? 'website' : 'account';
  const persistenceEnabled =
    enabled && (scope === 'website' ? hasWebsiteScope : hasAccountScope);

  const transcript = useChatTranscript({
    sessionId,
    websiteId: hasWebsiteScope ? websiteId : null,
    scope,
    enabled: persistenceEnabled,
  });

  const createContext = useCreateAIContext();
  const clearContextMutation = useClearContext(
    hasWebsiteScope ? websiteId : null,
    sessionId,
    scope,
  );

  const ensureContextExists = useCallback(async () => {
    if (!persistenceEnabled || creationGiveUpRef.current) {
      return;
    }
    if (transcript.hasContext) {
      return;
    }
    if (isCreatingContextRef.current) {
      return;
    }
    if (scope === 'website' && !websiteId) {
      return;
    }

    isCreatingContextRef.current = true;
    try {
      const context =
        scope === 'website'
          ? await createContext.mutateAsync({
              websiteId: websiteId as string,
              sessionId,
            })
          : await createContext.mutateAsync({
              scope: 'account',
              sessionId,
            });

      transcript.syncContext(context, true);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (
        message.includes('referenced record not found') ||
        message.includes('does not exist') ||
        message.includes('invalid request body') ||
        message.includes('websiteid is required')
      ) {
        creationGiveUpRef.current = true;
      }
      throw error;
    } finally {
      isCreatingContextRef.current = false;
    }
  }, [createContext, persistenceEnabled, scope, sessionId, transcript, websiteId]);

  useEffect(() => {
    saveMessagesImmediateRef.current = async (messages: AIMessage[]) => {
      if (!persistenceEnabled || !sessionId || messages.length === 0) {
        return;
      }

      const converted = convertAiMessages(messages);
      if (converted.length === 0) {
        return;
      }

      onSaveStart?.();
      setIsSaving(true);
      setLocalError(null);

      try {
        if (!transcript.hasContext) {
          await ensureContextExists();
        }
        await transcript.append(converted);
        setLastSaved(new Date());
        onSaveComplete?.();
      } catch (error) {
        console.error('[useChatPersistence] Save error:', error);
        const err = error instanceof Error ? error : new Error('Failed to save messages');
        setLocalError(err);
        onSaveError?.(err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    };
  }, [
    ensureContextExists,
    onSaveComplete,
    onSaveError,
    onSaveStart,
    persistenceEnabled,
    sessionId,
    transcript,
  ]);

  const scheduleSave = useCallback(
    async (messages: AIMessage[]) => {
      if (!persistenceEnabled || !sessionId) {
        return;
      }

      currentMessagesRef.current = messages;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveMessagesImmediateRef.current(messages).catch((error) => {
          const err =
            error instanceof Error
              ? error
              : new Error('Failed to save messages, retrying...');
          setLocalError(err);
        });
      }, autoSaveDelay);
    },
    [autoSaveDelay, persistenceEnabled, sessionId],
  );

  const loadMessages = useCallback(async () => {
    if (!persistenceEnabled) {
      return [];
    }

    setIsLoading(true);
    setLocalError(null);
    onLoadStart?.();
    try {
      if (!transcript.hydrated) {
        await transcript.refresh();
      }
      const loadedMessages = transcript.messages as ContextAIMessage[];
      onLoadComplete?.(loadedMessages);
      hasAnnouncedLoadRef.current = true;
      return loadedMessages;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load messages');
      setLocalError(err);
      onLoadError?.(err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [
    onLoadComplete,
    onLoadError,
    onLoadStart,
    persistenceEnabled,
    transcript,
  ]);

  useEffect(() => {
    if (!persistenceEnabled) {
      hasAnnouncedLoadRef.current = false;
      return;
    }

    if (transcript.hydrated && !hasAnnouncedLoadRef.current) {
      onLoadComplete?.(transcript.messages as ContextAIMessage[]);
      hasAnnouncedLoadRef.current = true;
    }
  }, [onLoadComplete, persistenceEnabled, transcript.hydrated, transcript.messages]);

  const clearMessages = useCallback(async () => {
    if (!persistenceEnabled || !sessionId) {
      return;
    }
    try {
      const updated = await clearContextMutation.mutateAsync();
      transcript.syncContext(updated, true);
      setSaveCount(0);
      setLastSaved(null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to clear messages');
      setLocalError(err);
      throw err;
    }
  }, [clearContextMutation, persistenceEnabled, sessionId, transcript]);

  const exportMessages = useCallback(async () => {
    if (!persistenceEnabled) {
      return '[]';
    }

    try {
      const payload = transcript.context;
      if (!payload) {
        return '[]';
      }
      return JSON.stringify(
        {
          sessionId: payload.sessionId,
          websiteId: payload.websiteId,
          messages: payload.messages,
          metadata: payload.metadata,
          summary: payload.summary,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt,
        },
        null,
        2,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to export messages');
      setLocalError(err);
      return '[]';
    }
  }, [persistenceEnabled, transcript.context]);

  const importMessages = useCallback(
    async (jsonData: string) => {
      if (!persistenceEnabled || !sessionId) {
        return;
      }
      try {
        const data = JSON.parse(jsonData);
        if (!Array.isArray(data.messages)) {
          throw new Error('Invalid chat data format: missing messages array');
        }

        await clearContextMutation.mutateAsync();

        if (data.messages.length > 0) {
          const first = data.messages[0] as TranscriptAppendMessage;
          const rest = data.messages.slice(1) as TranscriptAppendMessage[];

          await ensureContextExists();
          await transcript.append([first, ...rest]);
        }

        setSaveCount(data.messages.length);
        setLastSaved(new Date());
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to import messages');
        setLocalError(err);
        throw err;
      }
    },
    [clearContextMutation, ensureContextExists, persistenceEnabled, sessionId, transcript],
  );

  useEffect(() => {
    if (transcript.context?.updatedAt) {
      const updatedAt =
        transcript.context.updatedAt instanceof Date
          ? transcript.context.updatedAt
          : new Date(transcript.context.updatedAt);
      setLastSaved(updatedAt);
    }
    setSaveCount(transcript.messages.length);
  }, [transcript.context, transcript.messages.length]);

  useEffect(() => {
    currentMessagesRef.current = transcript.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.timestamp,
    })) as unknown as AIMessage[];
  }, [transcript.messages]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        if (currentMessagesRef.current.length > 0) {
          void saveMessagesImmediateRef.current(currentMessagesRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        if (currentMessagesRef.current.length > 0) {
          void saveMessagesImmediateRef.current(currentMessagesRef.current);
        }
      }
    };
  }, []);

  const storageUsage = useMemo(() => {
    if (!persistenceEnabled) {
      return null;
    }
    const usage = transcript.messages.length * 1000;
    const quota = 10 * 1024 * 1024;
    return {
      usage,
      quota,
      percentage: (usage / quota) * 100,
    };
  }, [persistenceEnabled, transcript.messages.length]);

  const combinedError = localError ?? transcript.error ?? null;
  const derivedLoading =
    isLoading || (persistenceEnabled && !transcript.hydrated && transcript.status === 'loading');

  return {
    isLoading: derivedLoading,
    isSaving,
    lastSaved,
    saveCount,
    storageStrategy: 'Database (AI Context API)',
    storageUsage,
    error: combinedError,
    saveMessages: scheduleSave,
    saveMessagesImmediate: saveMessagesImmediateRef.current,
    loadMessages,
    clearMessages,
    exportMessages,
    importMessages,
    contextData: transcript.context ?? null,
  };
}
