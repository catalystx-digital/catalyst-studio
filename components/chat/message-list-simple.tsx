'use client';

import React, { useRef, useEffect } from 'react';
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  error?: boolean;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onRetry?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  className?: string;
  showTimestamps?: boolean;
  showMetadata?: boolean;
}

export default function MessageList({
  messages,
  isLoading = false,
  onRetry,
  onCopy,
  className = '',
  showTimestamps = true,
  showMetadata = false
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleCopy = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      if (onCopy) onCopy(content);
      
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  return (
    <div 
      ref={scrollRef}
      className={`message-list overflow-y-auto scroll-smooth custom-scrollbar ${className}`}
    >
      <div className="space-y-4 p-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ask me anything about creating your website
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            showTimestamp={showTimestamps}
            showMetadata={showMetadata}
            onCopy={() => handleCopy(message.content, message.id)}
            onRetry={() => onRetry?.(message.id)}
            isCopied={copiedId === message.id}
            formatTime={formatTime}
          />
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start animate-fadeIn">
            <div className="flex gap-3 max-w-[70%]">
              <Avatar role="assistant" />
              <div className="rounded-lg px-4 py-2 bg-secondary">
                <LoadingDots />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual message component
function MessageItem({
  message,
  showTimestamp,
  showMetadata,
  onCopy,
  onRetry,
  isCopied,
  formatTime
}: {
  message: Message;
  showTimestamp: boolean;
  showMetadata: boolean;
  onCopy: () => void;
  onRetry?: () => void;
  isCopied: boolean;
  formatTime: (date?: Date) => string;
}) {
  const isUser = message.role === 'user';
  const isError = message.error;

  return (
    <div
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
    >
      <div
        className={`flex gap-3 max-w-[70%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <Avatar role={message.role} />
        
        <div className="flex-1">
          <div
            className={`rounded-lg px-4 py-3 ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : isError
                ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                : 'bg-secondary'
            } enhanced-message group relative`}
          >
            {/* Message content - simplified without markdown */}
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {/* Action buttons */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={onCopy}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Copy message"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-gray-500" />
                )}
              </button>
              
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  aria-label="Retry message"
                >
                  <RefreshCw className="h-3 w-3 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Timestamp and metadata */}
          <div className="flex items-center gap-2 mt-1 px-1">
            {showTimestamp && message.timestamp && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(message.timestamp)}
              </span>
            )}
            
            {showMetadata && message.metadata && (
              <>
                {message.metadata.model && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    • {message.metadata.model}
                  </span>
                )}
                {message.metadata.tokens && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    • {message.metadata.tokens} tokens
                  </span>
                )}
                {message.metadata.processingTime && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    • {(message.metadata.processingTime / 1000).toFixed(1)}s
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Avatar component
function Avatar({ role }: { role: 'user' | 'assistant' | 'system' }) {
  return (
    <div className="flex-shrink-0">
      {role === 'user' ? (
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      ) : (
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
          <Bot className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

// Loading dots component
function LoadingDots() {
  return (
    <div className="flex space-x-1">
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
      />
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
      />
      <div
        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
        style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
      />
    </div>
  );
}

// Export types for external use
export type { Message, MessageListProps };