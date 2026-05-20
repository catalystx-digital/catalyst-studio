'use client';

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { UIMessage as Message, JSONValue } from 'ai';
import { useChatPersistence } from '@/hooks/use-chat-persistence';
import { useChatTranscript } from '@/hooks/use-chat-transcript';
import { useWebsiteId } from '@/lib/hooks/use-website-id';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/lib/auth/hooks';

interface ChatWithPersistenceProps {
  children: ReactNode;
  messages: Message[];
  setMessages?: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
  sessionId?: string;
  enabled?: boolean;
  onMessagesLoaded?: (messages: Message[]) => void;
  websiteIdOverride?: string;
}

const metadataToAnnotations = (metadata?: unknown): JSONValue[] | undefined => {
  if (!metadata) {
    return undefined;
  }
  if (Array.isArray(metadata)) {
    return metadata as JSONValue[];
  }
  return [metadata as JSONValue];
};

export function ChatWithPersistence({
  children,
  messages,
  setMessages,
  sessionId = 'default',
  enabled = true,
  onMessagesLoaded,
  websiteIdOverride,
}: ChatWithPersistenceProps) {
  const fallbackWebsiteId = useWebsiteId();
  const resolvedWebsiteId = websiteIdOverride ?? fallbackWebsiteId;
  const user = useUser();
  const hasWebsiteScope = !!resolvedWebsiteId && resolvedWebsiteId !== 'default';
  const hasAccountScope = !!user?.id;
  const effectiveEnabled = enabled && (hasWebsiteScope || hasAccountScope);

  const initialSyncRef = useRef(false);
  const [hasHydratedOnce, setHasHydratedOnce] = useState(false);

  const transcript = useChatTranscript({
    sessionId,
    websiteId: effectiveEnabled && hasWebsiteScope ? resolvedWebsiteId : null,
    scope: hasWebsiteScope ? 'website' : 'account',
    enabled: effectiveEnabled,
  });

  useEffect(() => {
    initialSyncRef.current = false;
    setHasHydratedOnce(false);
  }, [effectiveEnabled, resolvedWebsiteId, sessionId]);

  useEffect(() => {
    if (transcript.hydrated) {
      setHasHydratedOnce(true);
    }
  }, [transcript.hydrated]);

  useEffect(() => {
    if (!effectiveEnabled || !transcript.hydrated || !setMessages) {
      return;
    }

    const existingIds = new Set(messages.map((message) => message.id));
    const missing = transcript.messages.filter((message) => !existingIds.has(message.id));

    if (missing.length === 0) {
      if (!initialSyncRef.current && transcript.messages.length === 0) {
        initialSyncRef.current = true;
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const synthesized = missing.map((message): any => ({
      id: message.id,
      role: message.role,
      content: message.content,
      parts: [{ type: 'text', text: message.content }],
      createdAt: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
      annotations: metadataToAnnotations(message.metadata),
      metadata: (message.metadata as Record<string, unknown>) ?? undefined,
    }));

    setMessages((prev) => [...prev, ...synthesized]);
    if (!initialSyncRef.current) {
      onMessagesLoaded?.([...messages, ...synthesized]);
      initialSyncRef.current = true;
    }
  }, [
    effectiveEnabled,
    messages,
    onMessagesLoaded,
    setMessages,
    transcript.hydrated,
    transcript.messages,
  ]);

  const { saveMessages } = useChatPersistence({
    websiteId: effectiveEnabled && hasWebsiteScope ? resolvedWebsiteId : null,
    accountId: hasAccountScope ? user?.id ?? null : null,
    sessionId,
    enabled: effectiveEnabled,
    autoSaveDelay: 500,
  });

  // Auto-save messages when they change
  useEffect(() => {
    if (!effectiveEnabled || !transcript.hydrated || messages.length === 0) {
      return;
    }
    saveMessages(messages);
  }, [effectiveEnabled, messages, saveMessages, transcript.hydrated]);

  const shouldShowInitialSkeleton = effectiveEnabled && !transcript.hydrated && !hasHydratedOnce;
  const showBackgroundSyncIndicator = effectiveEnabled && hasHydratedOnce && !transcript.hydrated;

  // Show loading state while recovering messages
  if (shouldShowInitialSkeleton) {
    return (
      <div className="flex flex-col h-full" data-testid="chat-transcript-loading">
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <Skeleton className="h-4 w-48 mx-auto" />
              <Skeleton className="h-3 w-32 mx-auto" />
              <div className="flex items-center justify-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse delay-100" />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse delay-200" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Recovering conversation...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render children with persistence active in background
  return (
    <>
      {children}

      {showBackgroundSyncIndicator && (
        <div
          data-testid="chat-sync-indicator"
          className="fixed top-4 right-4 z-40 rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow backdrop-blur"
        >
          Refreshing conversation...
        </div>
      )}
      
    </>
  );
}

// HOC to wrap existing chat components with persistence
export function withChatPersistence<P extends { messages: Message[]; setMessages?: (messages: Message[] | ((messages: Message[]) => Message[])) => void }>(
  Component: React.ComponentType<P>,
  options?: {
    sessionId?: string;
    enabled?: boolean;
    getWebsiteId?: (props: P) => string | undefined;
  }
) {
  return function ChatWithPersistenceWrapper(props: P) {
    const enabled = options?.enabled ?? true;
    const sessionId = options?.sessionId ?? 'default';
    const websiteIdOverride = options?.getWebsiteId?.(props);

    if (!enabled) {
      return <Component {...props} />;
    }

    return (
      <ChatWithPersistence
        messages={props.messages}
        setMessages={props.setMessages}
        sessionId={sessionId}
        enabled={enabled}
        websiteIdOverride={websiteIdOverride}
      >
        <Component {...props} />
      </ChatWithPersistence>
    );
  };
}
