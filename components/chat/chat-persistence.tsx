'use client';

import React from 'react';
import { UIMessage as Message } from 'ai';
import { ChatWithPersistence } from './chat-with-persistence';

interface ChatPersistenceProps {
  children: React.ReactNode;
  messages: Message[];
  setMessages?: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
  sessionId?: string;
  onMessagesLoaded?: (messages: Message[]) => void;
  websiteIdOverride?: string;
}

/**
 * Component that enables chat persistence functionality
 */
export function ChatPersistence({
  children,
  messages,
  setMessages,
  sessionId = 'default',
  onMessagesLoaded,
  websiteIdOverride
}: ChatPersistenceProps) {
  // Persistence is always enabled now
  return (
    <ChatWithPersistence
      messages={messages}
      setMessages={setMessages}
      sessionId={sessionId}
      enabled={true}
      onMessagesLoaded={onMessagesLoaded}
      websiteIdOverride={websiteIdOverride}
    >
      {children}
    </ChatWithPersistence>
  );
}

/**
 * HOC to add persistence to any chat component
 */
export function withChatPersistence<P extends {
  messages: Message[];
  setMessages?: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
}>(
  Component: React.ComponentType<P>,
  options?: {
    sessionId?: string;
    enabled?: boolean;
    getWebsiteId?: (props: P) => string | undefined;
  }
) {
  return function ChatPersistenceWrapper(props: P) {
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

/**
 * Hook to check if persistence is enabled (always true now)
 */
export function usePersistence() {
  return true;
}
