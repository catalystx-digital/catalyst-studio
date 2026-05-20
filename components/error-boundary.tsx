'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Enhanced Error Boundary with Recovery
 * SECURITY: Prevents error propagation and provides graceful fallbacks
 * PERFORMANCE: Includes error count tracking to prevent infinite loops
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
      // Don't reset errorCount here - it's managed in componentDidCatch
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;
    
    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ErrorBoundary${componentName ? ` - ${componentName}` : ''}] Caught error:`, error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error details
    // FIXED: Use callback to check errorCount properly
    this.setState(prevState => {
      const newErrorCount = prevState.errorCount + 1;
      
      // Auto-recover after 5 seconds if error count is low
      // FIXED: Now checking the updated count, not stale state
      if (newErrorCount < 3) {
        this.resetTimeoutId = setTimeout(() => {
          this.resetErrorBoundary();
        }, 5000);
      }
      
      return {
        errorInfo,
        errorCount: newErrorCount
      };
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    // Reset on prop changes if enabled
    if (hasError && prevProps.children !== this.props.children && resetOnPropsChange) {
      this.resetErrorBoundary();
    }
    
    // Reset if resetKeys changed
    if (resetKeys && prevProps.resetKeys !== resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== this.previousResetKeys[idx]);
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
        this.previousResetKeys = [...resetKeys];
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    });
  };

  render() {
    const { hasError, error, errorCount } = this.state;
    const { children, fallback, isolate, componentName } = this.props;

    if (hasError && error) {
      // Too many errors - show permanent error state
      if (errorCount >= 3) {
        return (
          <div className="error-boundary-fallback p-4 m-2 border border-red-500 rounded-lg bg-red-50 dark:bg-red-950">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
              Component Error {componentName && `in ${componentName}`}
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              This component has encountered multiple errors and cannot recover automatically.
            </p>
            <button
              onClick={this.resetErrorBoundary}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400">
                  Error Details
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                  {error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        );
      }

      // Custom fallback provided
      if (fallback) {
        return <>{fallback}</>;
      }

      // Default fallback with auto-recovery message
      return (
        <div className={`error-boundary-fallback p-4 ${isolate ? 'border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950' : ''}`}>
          <h3 className="text-md font-semibold text-yellow-700 dark:text-yellow-300 mb-1">
            Temporary Error {componentName && `in ${componentName}`}
          </h3>
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Attempting to recover in a few seconds...
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 underline hover:no-underline"
          >
            Reset Now
          </button>
        </div>
      );
    }

    return children;
  }
}

/**
 * Wrapper component for isolated error boundaries
 * Use this for components that might fail independently
 */
export function IsolatedErrorBoundary({ 
  children, 
  componentName,
  fallback 
}: { 
  children: ReactNode; 
  componentName?: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary 
      isolate 
      componentName={componentName}
      fallback={fallback}
      resetOnPropsChange
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Hook for error recovery
 * Use within components wrapped in ErrorBoundary
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error; // This will be caught by the nearest ErrorBoundary
  };
}