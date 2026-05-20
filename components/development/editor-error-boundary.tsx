'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Editor Error:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: this.state.errorCount,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 space-y-4">
          <div className="flex items-center space-x-2 text-orange-500">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-xl font-semibold">Editor Loading Error</h2>
          </div>
          
          <div className="text-center max-w-md space-y-2">
            <p className="text-gray-300">
              The code editor failed to load. This might be a temporary issue.
            </p>
            {this.state.error && (
              <p className="text-sm text-gray-400 font-mono">
                {this.state.error.message}
              </p>
            )}
            {this.state.errorCount > 2 && (
              <p className="text-sm text-yellow-500">
                Multiple retry attempts detected. Please refresh the page if the issue persists.
              </p>
            )}
          </div>

          <Button
            onClick={this.handleRetry}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Retry Loading Editor
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}