'use client';

import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Wrench, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ToolExecutionState = 'pending' | 'executing' | 'success' | 'error';

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: ToolExecutionState;
  result?: unknown;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;
}

interface ToolExecutionDisplayProps {
  invocation: ToolInvocation;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

const toolDisplayNames: Record<string, string> = {
  // Website management tools
  getWebsiteContext: 'Getting Website Context',
  updateBusinessRequirements: 'Updating Business Requirements',
  validateContent: 'Validating Content',
  // Content type management tools
  listContentTypes: 'Listing Content Types',
  getContentType: 'Getting Content Type',
  createContentType: 'Creating Content Type',
  updateContentType: 'Updating Content Type',
  // Content item management tools
  listContentItems: 'Listing Content Items',
  createPage: 'Creating Page',
  updateContentItem: 'Updating Content Item',
  // Test tool
  echoTool: 'Echo Test'
};

const toolIcons: Record<string, string> = {
  getWebsiteContext: '🌐',
  updateBusinessRequirements: '📋',
  validateContent: '✅',
  listContentTypes: '📑',
  getContentType: '📄',
  createContentType: '✨',
  updateContentType: '✏️',
  listContentItems: '📝',
  createPage: '📄',
  updateContentItem: '🔄',
  echoTool: '🔧'
};

export function ToolExecutionDisplay({ 
  invocation, 
  onRetry, 
  onCancel,
  className 
}: ToolExecutionDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const displayName = toolDisplayNames[invocation.toolName] || invocation.toolName;
  const icon = toolIcons[invocation.toolName] || '🔧';
  
  const stateConfig = {
    pending: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-300 dark:border-gray-600',
      text: 'text-gray-700 dark:text-gray-300',
      icon: <Clock className="h-4 w-4 text-gray-500" />,
      pulse: false
    },
    executing: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-300 dark:border-blue-700 animate-pulse',
      text: 'text-blue-700 dark:text-blue-300',
      icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
      pulse: true
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-700 dark:text-green-300',
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      pulse: false
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-700 dark:text-red-300',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      pulse: false
    }
  };
  
  const config = stateConfig[invocation.state];
  const duration = invocation.startTime && invocation.endTime 
    ? (invocation.endTime.getTime() - invocation.startTime.getTime()) / 1000
    : invocation.estimatedDuration;

  return (
    <div 
      className={cn(
        'rounded-lg border p-3 transition-all duration-200',
        config.bg,
        config.border,
        config.text,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`Tool execution: ${displayName} - ${invocation.state}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={displayName}>
            {icon}
          </span>
          {config.icon}
          <span className="font-medium text-sm">{displayName}</span>
          {duration && invocation.state === 'executing' && (
            <span className="text-xs opacity-70">
              (~{duration}s)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {invocation.state === 'executing' && onCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-7 px-2 text-xs"
              aria-label="Cancel execution"
            >
              Cancel
            </Button>
          )}
          
          {invocation.state === 'error' && onRetry && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRetry}
              className="h-7 px-2 text-xs"
              aria-label="Retry execution"
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="size-11 p-0"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {invocation.state === 'executing' && (
        <div className="mt-2 text-xs opacity-70">
          Executing tool with provided parameters...
        </div>
      )}
      
      {invocation.state === 'success' && (
        <div className="mt-2 text-sm">
          <span className="font-medium">✅ Success:</span>
          <span className="ml-2">
            {invocation.result !== null && invocation.result !== undefined && typeof invocation.result === 'object' && 'message' in invocation.result
              ? String((invocation.result as any).message)
              : 'Operation completed successfully'}
          </span>
        </div>
      )}
      
      {invocation.state === 'error' && invocation.error && (
        <div className="mt-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Error:</span>
              <span className="ml-2">{invocation.error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
          {/* Parameters */}
          <div className="text-xs">
            <span className="font-medium">Parameters:</span>
            <pre className="mt-1 p-2 bg-black/5 dark:bg-white/5 rounded text-xs overflow-x-auto">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          </div>
          
          {/* Result */}
          {invocation.result !== null && invocation.result !== undefined && (
            <div className="text-xs">
              <span className="font-medium">Result:</span>
              <pre className="mt-1 p-2 bg-black/5 dark:bg-white/5 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                {typeof invocation.result === 'object' && invocation.result !== null
                  ? JSON.stringify(invocation.result, null, 2)
                  : String(invocation.result)}
              </pre>
            </div>
          )}
          
          {/* Timing */}
          {duration && invocation.state !== 'executing' && (
            <div className="text-xs opacity-70">
              Completed in {duration.toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Multi-step tool execution display
interface MultiStepToolExecutionProps {
  steps: ToolInvocation[];
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function MultiStepToolExecution({
  steps,
  currentStep,
  totalSteps,
  className
}: MultiStepToolExecutionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
        Step {currentStep} of {totalSteps}
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <ToolExecutionDisplay
            key={step.toolCallId}
            invocation={step}
            className={index === currentStep - 1 ? 'ring-2 ring-blue-400' : ''}
          />
        ))}
      </div>
    </div>
  );
}