'use client';

import React from 'react';
import { useWebsiteContext } from '@/lib/context/website-context';

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading website...' }) => (
  <div className="p-6" role="status" aria-live="polite" aria-label="Loading website">
    <div className="text-gray-400">
      <p>{message}</p>
    </div>
  </div>
);

interface ErrorStateProps {
  error: Error;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error }) => (
  <div className="p-6" role="alert" aria-live="assertive">
    <div className="text-red-500">
      <h2 className="text-xl font-bold mb-2">Error Loading Website</h2>
      <p>{error.message}</p>
    </div>
  </div>
);

/**
 * Higher-Order Component that handles loading and error states for website context
 * Reduces duplication across route pages
 */
export function withWebsiteContext<P extends object>(
  Component: React.ComponentType<P>,
  loadingMessage?: string
) {
  const WrappedComponent = (props: P) => {
    const { isLoading, error } = useWebsiteContext();
    
    if (isLoading) {
      return <LoadingState message={loadingMessage} />;
    }
    
    if (error) {
      return <ErrorState error={error} />;
    }
    
    return <Component {...props} />;
  };
  
  WrappedComponent.displayName = `withWebsiteContext(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
}