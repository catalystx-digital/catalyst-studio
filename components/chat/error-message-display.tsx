'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ErrorSeverity = 'warning' | 'error' | 'critical';

export interface ErrorAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: React.ReactNode;
}

export interface ChatError {
  id: string;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  technicalDetails?: string;
  fieldErrors?: Record<string, string[]>;
  suggestedActions?: ErrorAction[];
  timestamp: Date;
  retryable?: boolean;
  documentationUrl?: string;
}

interface ErrorMessageDisplayProps {
  error: ChatError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const severityConfig = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-200',
    icon: <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    title: 'Information'
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />,
    title: 'Warning'
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200',
    icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
    title: 'Error'
  },
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-500 dark:border-red-600',
    text: 'text-red-900 dark:text-red-100',
    icon: <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-300 animate-pulse" />,
    title: 'Critical Error'
  }
};

export function ErrorMessageDisplay({
  error,
  onRetry,
  onDismiss,
  className
}: ErrorMessageDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const config = severityConfig[error.severity] || severityConfig.error;

  const handleCopyErrorId = () => {
    navigator.clipboard.writeText(error.id);
    setCopiedId(error.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const defaultActions: ErrorAction[] = [
    ...(error.retryable && onRetry
      ? [{
          label: 'Retry',
          action: onRetry,
          variant: 'primary' as const,
          icon: <RefreshCw className="h-3 w-3" />
        }]
      : []),
    {
      label: 'Modify Request',
      action: () => {
        // Focus the input field
        const input = document.querySelector('input[aria-label="Chat input"]') as HTMLInputElement;
        input?.focus();
      },
      variant: 'secondary' as const,
      icon: <MessageSquare className="h-3 w-3" />
    },
    ...(error.documentationUrl
      ? [{
          label: 'Get Help',
          action: () => window.open(error.documentationUrl, '_blank'),
          variant: 'ghost' as const,
          icon: <HelpCircle className="h-3 w-3" />
        }]
      : [])
  ];

  const actions = error.suggestedActions || defaultActions;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all duration-200',
        config.bg,
        config.border,
        config.text,
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        
        <div className="flex-1 space-y-2">
          {/* Title and Message */}
          <div>
            <h4 className="font-medium text-sm mb-1">{config.title}</h4>
            <p className="text-sm">{error.message}</p>
          </div>

          {/* Details */}
          {error.details && (
            <div className="text-sm opacity-90">
              <p>{error.details}</p>
            </div>
          )}

          {/* Field Errors */}
          {error.fieldErrors && Object.keys(error.fieldErrors).length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium">Field Errors:</p>
              <ul className="text-sm space-y-1">
                {Object.entries(error.fieldErrors).map(([field, errorMessage]) => (
                  <li key={field}>
                    • {field}: {errorMessage}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant={action.variant === 'primary' ? 'default' : action.variant}
                  onClick={action.action}
                  aria-label={`${action.label} action`}
                  className={cn(
                    'h-8',
                    action.variant === 'primary' && 'bg-blue-600 hover:bg-blue-700',
                    action.variant === 'secondary' && 'bg-gray-200 dark:bg-gray-700',
                    action.variant === 'ghost' && 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Technical Details (Collapsible) */}
          {error.technicalDetails && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 px-2 text-xs"
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                Technical Details
              </Button>
              
              {isExpanded && (
                <div className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded text-xs font-mono">
                  <pre className="whitespace-pre-wrap break-all">
                    {error.technicalDetails}
                  </pre>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs opacity-60">Error ID: {error.id}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyErrorId}
                      className="h-6 px-2"
                    >
                      {copiedId === error.id ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="size-11 p-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss error"
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );
}

// Recovery suggestions component
interface RecoverySuggestionsProps {
  errorType: string;
  className?: string;
}

const recoverySuggestions: Record<string, string[]> = {
  'validation': [
    'Check that all required fields are filled',
    'Verify field formats match requirements',
    'Ensure values are within acceptable ranges'
  ],
  'network': [
    'Check your internet connection',
    'Try refreshing the page',
    'Contact support if the issue persists'
  ],
  'permission': [
    'Verify you have the necessary permissions',
    'Check if you\'re logged in with the correct account',
    'Contact an administrator for access'
  ],
  'tool_execution': [
    'Try rephrasing your request',
    'Break down complex requests into smaller steps',
    'Check if the required data exists'
  ],
  'rate_limit': [
    'Wait a moment before retrying',
    'Reduce the frequency of requests',
    'Consider batching operations'
  ]
};

export function RecoverySuggestions({ errorType, className }: RecoverySuggestionsProps) {
  const suggestions = recoverySuggestions[errorType] || recoverySuggestions['tool_execution'];
  
  return (
    <div className={cn('mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg', className)}>
      <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
        Suggested Solutions:
      </h5>
      <ul className="space-y-1">
        {suggestions.map((suggestion, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}