'use client';

import dynamic from 'next/dynamic';

// Export the base chat as the default
export const Chat = dynamic(
  () => import('./base-chat'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-400">Loading chat...</div>
      </div>
    ),
  }
);

// Export individual components for flexibility
export { default as BaseChat } from './base-chat';
export { AIContextChat } from './ai-context-chat';
export { default as EnhancedChatPanel } from './enhanced-chat-panel';
export { ChatPersistence } from './chat-persistence';
export { ChatWithPersistence } from './chat-with-persistence';
export { ToolExecutionDisplay, MultiStepToolExecution } from './tool-execution-display';
export type { ToolInvocation, ToolExecutionState } from './tool-execution-display';