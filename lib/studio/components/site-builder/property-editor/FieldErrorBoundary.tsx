'use client'

/**
 * FieldErrorBoundary - Error boundary for individual fields
 *
 * Features:
 * - Catches render errors in field editors
 * - Displays fallback UI with error message
 * - Provides reset functionality
 * - Logs errors for debugging
 */

import * as React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FieldErrorBoundaryProps {
  children: React.ReactNode
  fieldName?: string
  className?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface FieldErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class FieldErrorBoundary extends React.Component<
  FieldErrorBoundaryProps,
  FieldErrorBoundaryState
> {
  constructor(props: FieldErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): FieldErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
    console.error(
      `[FieldErrorBoundary] Error in field "${this.props.fieldName || 'unknown'}":`,
      error,
      errorInfo
    )
    }
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            'rounded-lg border border-destructive/50 bg-destructive/10 p-4',
            this.props.className
          )}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-destructive">
                Failed to render field
                {this.props.fieldName && (
                  <span className="font-normal">
                    : {this.props.fieldName}
                  </span>
                )}
              </p>
              {this.state.error && (
                <p className="text-xs text-muted-foreground font-mono">
                  {this.state.error.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="h-7"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook to create a wrapped component with error boundary
 */
export function withFieldErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  getFieldName?: (props: P) => string
) {
  const WrappedComponent = (props: P) => {
    const fieldName = getFieldName ? getFieldName(props) : undefined
    return (
      <FieldErrorBoundary fieldName={fieldName}>
        <Component {...props} />
      </FieldErrorBoundary>
    )
  }

  WrappedComponent.displayName = `WithErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`

  return WrappedComponent
}
