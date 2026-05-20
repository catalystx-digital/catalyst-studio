'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/error-boundary';
import { ChatErrorBoundary } from './chat-error-boundary';
import { ProjectContextProvider } from '@/lib/context/project-context';

// Dynamically import the base chat component
const BaseChat = dynamic(() => import('@/components/chat/base-chat'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="text-lg">Loading chat...</div>
    </div>
  ),
});

// Import our enhanced components with graceful fallbacks
// These components enhance the chat experience
const SuggestionChips = dynamic(() => import('./suggestion-chips').catch(() => ({
  default: () => null // Graceful fallback if component doesn't exist yet
})), { ssr: false });

const TypingIndicator = dynamic(() => import('./typing-indicator').catch(() => ({
  default: () => null // Graceful fallback if component doesn't exist yet
})), { ssr: false });

// Commented out for now - will be used in future enhancement
// const MessageList = dynamic(() => import('./message-list-simple').catch(() => ({
//   default: () => null // Graceful fallback if component doesn't exist yet
// })), { ssr: false });

interface EnhancedChatPanelProps {
  className?: string;
}

/**
 * Enhanced Chat Panel Wrapper
 * 
 * This component wraps the existing chat functionality and adds
 * enhanced features including suggestion chips, typing indicators,
 * and improved context awareness.
 */
export default function EnhancedChatPanel({ className }: EnhancedChatPanelProps) {
  // Enhanced chat is now always enabled
  return (
    <ErrorBoundary fallback={<div>Chat temporarily unavailable</div>}>
      <ProjectContextProvider>
        <ChatErrorBoundary>
          <EnhancedChatProvider>
            <div className={`enhanced-chat-panel h-full ${className || ''}`}>
              {/* Original chat remains the core */}
              <BaseChat />
              
              {/* Enhanced features will be composed here */}
              {/* These components will overlay/integrate with the original chat */}
              {/* For now, they're placeholders that will be implemented in subsequent tasks */}
              
              {/* Suggestion chips will be positioned below the input */}
              <SuggestionChips />
              
              {/* Typing indicator will be integrated into the message list */}
              <TypingIndicator />
              
              {/* Enhanced message list will replace the default rendering if needed */}
              {/* This will be handled via React Context in Task 6 */}
            </div>
          </EnhancedChatProvider>
        </ChatErrorBoundary>
      </ProjectContextProvider>
    </ErrorBoundary>
  );
}

// Create a context for the enhanced chat features
const EnhancedChatContext = React.createContext<{
  isEnhanced: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredPrompts: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationContext: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contextAwareChat: any;
} | undefined>(undefined);

// Provider component that properly manages hooks
export function EnhancedChatProvider({ children }: { children: React.ReactNode }) {
  // Enhanced features are now always enabled
  const isEnhanced = true;
  
  // These will hold the actual hook values, not the hooks themselves
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [structuredPrompts, setStructuredPrompts] = React.useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conversationContext] = React.useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contextAwareChat, setContextAwareChat] = React.useState<any>(null);
  
  React.useEffect(() => {
    // Load the modules and store their exports, not hook results
    import('@/hooks/use-structured-prompts').then(module => {
      setStructuredPrompts(module);
    }).catch(() => {
      console.warn('use-structured-prompts module not found');
    });
    
    import('@/hooks/use-context-aware-chat').then(module => {
      setContextAwareChat(module);
    }).catch(() => {
      console.warn('use-context-aware-chat module not found');
    });
  }, []);
  
  return (
    <EnhancedChatContext.Provider value={{
      isEnhanced,
      structuredPrompts,
      conversationContext,
      contextAwareChat
    }}>
      {children}
    </EnhancedChatContext.Provider>
  );
}

// Export hook for accessing enhanced chat features
export function useEnhancedChat() {
  const context = React.useContext(EnhancedChatContext);
  
  // Return a default value if not within provider
  if (!context) {
    return {
      isEnhanced: true, // Always enabled now
      structuredPrompts: null,
      conversationContext: null,
      contextAwareChat: null
    };
  }
  
  return context;
}