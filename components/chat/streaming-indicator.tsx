'use client';

import React from 'react';
import { Loader2, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamingIndicatorProps {
  type?: 'typing' | 'thinking' | 'processing' | 'tool';
  message?: string;
  estimatedTime?: number;
  progress?: number;
  className?: string;
}

export function StreamingIndicator({
  type = 'typing',
  message,
  estimatedTime,
  progress,
  className
}: StreamingIndicatorProps) {
  const indicators = {
    typing: {
      icon: null,
      text: 'Typing',
      animation: 'dots'
    },
    thinking: {
      icon: <Activity className="h-4 w-4 text-blue-500" />,
      text: 'Thinking',
      animation: 'pulse'
    },
    processing: {
      icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
      text: 'Processing',
      animation: 'spin'
    },
    tool: {
      icon: <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />,
      text: 'Executing tool',
      animation: 'spin'
    }
  };

  const config = indicators[type];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {config.icon}
      
      {message ? (
        <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {config.text}
          </span>
          
          {config.animation === 'dots' && (
            <div className="flex space-x-1">
              <div 
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                style={{ animationDelay: '0ms' }}
              />
              <div 
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                style={{ animationDelay: '150ms' }}
              />
              <div 
                className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" 
                style={{ animationDelay: '300ms' }}
              />
            </div>
          )}
          
          {config.animation === 'pulse' && (
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
      )}
      
      {estimatedTime && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="h-3 w-3" />
          <span>~{estimatedTime}s</span>
        </div>
      )}
      
      {progress !== undefined && (
        <div className="flex-1 max-w-[100px]">
          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface MultiStepStreamingIndicatorProps {
  currentStep: number;
  totalSteps: number;
  currentStepName?: string;
  className?: string;
}

export function MultiStepStreamingIndicator({
  currentStep,
  totalSteps,
  currentStepName,
  className
}: MultiStepStreamingIndicatorProps) {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          Step {currentStep} of {totalSteps}
        </span>
        {currentStepName && (
          <span className="text-gray-500 dark:text-gray-500 text-xs">
            {currentStepName}
          </span>
        )}
      </div>
      
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Step indicators */}
      <div className="flex justify-between" data-testid="step-indicators">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isCompleted = i < currentStep - 1;
          const isCurrent = i === currentStep - 1;
          
          let classNames = 'w-2 h-2 rounded-full transition-all duration-300';
          if (isCompleted) {
            classNames += ' bg-blue-500';
          } else if (isCurrent) {
            classNames += ' bg-blue-500 animate-pulse';
          } else {
            classNames += ' bg-gray-300 dark:bg-gray-600';
          }
          
          return (
            <div
              key={i}
              className={classNames}
            />
          );
        })}
      </div>
    </div>
  );
}

interface StreamingTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function StreamingText({
  text,
  speed = 30,
  onComplete,
  className
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      
      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);
  
  React.useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);
  
  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </span>
  );
}