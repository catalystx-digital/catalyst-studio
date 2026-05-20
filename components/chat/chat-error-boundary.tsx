'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chat component error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            The chat interface encountered an error. Please try refreshing the page or resetting the chat.
          </p>
          {this.state.error && (
            <details className="mb-4 text-xs text-gray-500 dark:text-gray-500 max-w-md">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-left overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button
              onClick={this.handleReset}
              variant="default"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Chat
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}