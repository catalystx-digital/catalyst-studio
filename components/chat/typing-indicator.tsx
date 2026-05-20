'use client';

import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

interface TypingIndicatorProps {
  isTyping?: boolean;
  message?: string;
  className?: string;
  showAvatar?: boolean;
}

export default function TypingIndicator({ 
  isTyping = false,
  message = 'AI is thinking',
  className = '',
  showAvatar = true
}: TypingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Animate dots
  useEffect(() => {
    if (!isTyping) {
      setIsVisible(false);
      return;
    }

    // Small delay before showing to prevent flash for quick responses
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 200);

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
      setDots('');
    };
  }, [isTyping]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`typing-indicator-container ${className}`}>
      <div className="flex gap-3 justify-start animate-fadeIn">
        <div className="flex gap-3 max-w-[70%]">
          {showAvatar && (
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
            </div>
          )}
          
          <div className="rounded-lg px-4 py-2 bg-secondary">
            <div className="flex items-center gap-2">
              {/* Animated dots version */}
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
              
              {/* Optional text message */}
              {message && (
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                  {message}{dots}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Advanced typing indicator with multiple states
export function AdvancedTypingIndicator({ 
  status,
  className = ''
}: {
  status?: 'thinking' | 'searching' | 'generating' | 'finalizing';
  className?: string;
}) {
  const getStatusMessage = () => {
    switch (status) {
      case 'thinking':
        return 'AI is analyzing your request';
      case 'searching':
        return 'Searching for relevant information';
      case 'generating':
        return 'Generating response';
      case 'finalizing':
        return 'Finalizing answer';
      default:
        return 'AI is thinking';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'searching':
        return '🔍';
      case 'generating':
        return '✨';
      case 'finalizing':
        return '📝';
      default:
        return '🤔';
    }
  };

  return (
    <div className={`advanced-typing-indicator ${className}`}>
      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <span className="text-2xl animate-pulse">{getStatusIcon()}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {getStatusMessage()}
          </p>
          <div className="mt-1 h-1 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-progress" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal typing indicator (just dots)
export function MinimalTypingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`minimal-typing-indicator inline-flex items-center gap-1 ${className}`}>
      <span className="sr-only">Loading</span>
      <div 
        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <div 
        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <div 
        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

// Hook to integrate with chat loading state
export function useTypingIndicator(isLoading: boolean, delay = 200) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isLoading) {
      // Delay showing indicator to prevent flash for quick responses
      timer = setTimeout(() => {
        setShowIndicator(true);
      }, delay);
    } else {
      setShowIndicator(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, delay]);

  return showIndicator;
}