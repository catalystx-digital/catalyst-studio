/**
 * ErrorBoundary Component
 * Story 10: Code Quality - Task 4.4
 *
 * Wraps sections to catch React errors and prevent full page crashes.
 * Provides fallback UI while logging errors for debugging.
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback UI shown when an error occurs
 */
function DefaultErrorFallback({
  componentName,
  className
}: {
  componentName?: string;
  className?: string;
}) {
  return (
    <Card className={cn('border-destructive bg-destructive/5', className)}>
      <CardHeader>
        <h3 className="text-sm font-semibold text-destructive">
          {componentName ? `Error in ${componentName}` : 'Something went wrong'}
        </h3>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          This section encountered an error and couldn&apos;t be displayed.
        </p>
        <p className="text-sm text-muted-foreground">
          Try refreshing the page. If the problem persists, clear your browser cache or contact support.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * ErrorBoundary - Catches React errors in child component tree
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary componentName="HeroSection">
 *   <HeroSection {...props} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error('ErrorBoundary caught error:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback or default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          componentName={this.props.componentName}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}
