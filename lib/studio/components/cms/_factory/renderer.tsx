'use client';

import React, { Suspense, lazy, useEffect, useState, useRef, useCallback } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CMSComponentProps, ComponentType, ComponentPerformanceMetrics } from '../_core/types';
import { cmsComponentFactory } from './factory';
import { performanceMonitor } from '../_core/monitoring';
// Ensure component registrations are loaded in browser/dev so cache is populated
// This allows rendering registered adapters without relying on dynamic imports.
import '../_factory/initialize';
import { Button } from '@/components/ui/button';

// ============================================================================
// Component Renderer Props
// ============================================================================

export interface CMSComponentRendererProps extends CMSComponentProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onMetrics?: (metrics: ComponentPerformanceMetrics) => void;
  suspenseDelay?: number;
}

// ============================================================================
// Error Fallback Component
// ============================================================================

const DefaultErrorFallback: React.FC<{
  error: Error;
  resetErrorBoundary: () => void;
}> = ({ error, resetErrorBoundary }) => {
  const showDiagnostics = process.env.NODE_ENV !== 'production';

  return (
    <div className="cms-component-error rounded-md border border-border/60 bg-muted/70 p-4 text-sm text-muted-foreground">
      <h3 className="text-sm font-semibold text-foreground">
        We hit a snag loading this block.
      </h3>
      <p className="mt-1">
        You can retry in place or refresh the page if the issue persists.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="default" onClick={resetErrorBoundary}>
          Try again
        </Button>
      </div>
      {showDiagnostics ? (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Technical details
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-background p-3 font-mono text-[11px] text-destructive">
            {(error.stack || error.message || String(error)).trim()}
          </pre>
        </details>
      ) : null}
    </div>
  );
};

// ============================================================================
// Loading Fallback Component
// ============================================================================

const DefaultLoadingFallback: React.FC<{ type: ComponentType }> = ({ type }) => {
  return (
    <div className="cms-component-loading animate-pulse text-muted-foreground">
      <div className="h-32 rounded bg-muted/70" />
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-2 text-xs">Loading {type}...</p>
      )}
    </div>
  );
};

// ============================================================================
// Dynamic Component Loader
// ============================================================================

const DynamicComponentLoader: React.FC<{
  type: ComponentType;
  props: CMSComponentProps;
  onLoad?: (Component: React.ComponentType<CMSComponentProps>) => void;
  onError?: (error: Error) => void;
}> = ({ type, props, onLoad, onError }) => {
  const [Component, setComponent] = useState<React.ComponentType<CMSComponentProps> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const loadComponent = async () => {
      try {
        const loadedComponent = await cmsComponentFactory.loadComponent(type);
        
        if (!cancelled && mountedRef.current) {
          setComponent(() => loadedComponent);
          onLoad?.(loadedComponent);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        if (!cancelled && mountedRef.current) {
          setError(error);
          onError?.(error);
          
          // Use fallback component
          const fallback = cmsComponentFactory.createFallbackComponent(error);
          setComponent(() => fallback);
        }
      }
    };

    loadComponent();

    return () => {
      cancelled = true;
    };
  }, [type, onLoad, onError]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (error && process.env.NODE_ENV === 'development') {
    console.error(`Failed to load component ${type}:`, error);
  }

  if (!Component) {
    return null;
  }

  return <Component {...props} />;
};

// ============================================================================
// Main Component Renderer
// ============================================================================

export const CMSComponentRenderer: React.FC<CMSComponentRendererProps> = ({
  fallback,
  errorFallback: ErrorFallbackComponent = DefaultErrorFallback,
  onMetrics,
  suspenseDelay = 0,
  ...componentProps
}) => {
  const renderStartTime = useRef(performance.now());
  const [isDelayed, setIsDelayed] = useState(suspenseDelay > 0);
  const errorBoundaryRef = useRef<any>(null);

  // Handle suspense delay
  useEffect(() => {
    if (suspenseDelay > 0) {
      const timer = setTimeout(() => {
        setIsDelayed(false);
      }, suspenseDelay);

      return () => clearTimeout(timer);
    }
  }, [suspenseDelay]);

  // Track component load metrics
  const handleComponentLoad = useCallback(
    (Component: React.ComponentType<CMSComponentProps>) => {
      const loadTime = performance.now() - renderStartTime.current;
      
      if (onMetrics) {
        const metrics: ComponentPerformanceMetrics = {
          componentId: componentProps.id,
          componentType: componentProps.type,
          renderTime: loadTime,
          mountTime: loadTime,
          updateCount: 0,
          timestamp: Date.now()
        };
        
        onMetrics(metrics);
      }

      // Track with performance monitor if available
      if (performanceMonitor) {
        performanceMonitor.trackComponentRender(componentProps.type, loadTime);
      }

      componentProps.onLoad?.();
    },
    [componentProps, onMetrics]
  );

  // Handle component error
  const handleComponentError = useCallback(
    (error: Error) => {
      if (process.env.NODE_ENV === 'development') {
      console.error(`Component ${componentProps.type} failed:`, error);
      }
      componentProps.onError?.(error);
    },
    [componentProps]
  );

  // Reset error boundary
  const resetErrorBoundary = useCallback(() => {
    errorBoundaryRef.current?.resetErrorBoundary();
  }, []);

  // Get cached component if available (registered via initialize)
  const CachedComponent = cmsComponentFactory.getComponent(componentProps.type);

  // Filter out event handler functions to comply with RSC rules
  // These handlers are already managed by the renderer via handleComponentLoad/handleComponentError
  const { onLoad, onError, onInteraction, ...safeProps } = componentProps;

  // If component is cached, render immediately (adapters provide correct types)
  if (CachedComponent) {
    return (
      <ErrorBoundary
        ref={errorBoundaryRef}
        FallbackComponent={ErrorFallbackComponent}
        onError={handleComponentError}
        onReset={() => {}}
      >
        <CachedComponent {...safeProps} />
      </ErrorBoundary>
    );
  }

  // Otherwise, use dynamic loading with Suspense
  const loadingFallback = fallback || (
    <DefaultLoadingFallback type={componentProps.type} />
  );

  if (isDelayed) {
    return <>{loadingFallback}</>;
  }

  return (
    <ErrorBoundary
      ref={errorBoundaryRef}
      FallbackComponent={ErrorFallbackComponent}
      onError={handleComponentError}
      onReset={() => {}}
    >
      <Suspense fallback={loadingFallback}>
        <DynamicComponentLoader
          type={componentProps.type}
          props={safeProps}
          onLoad={handleComponentLoad}
          onError={handleComponentError}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

// ============================================================================
// Batch Renderer for Multiple Components
// ============================================================================

export interface CMSBatchRendererProps {
  components: CMSComponentProps[];
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onMetrics?: (metrics: ComponentPerformanceMetrics) => void;
  preload?: boolean;
}

export const CMSBatchRenderer: React.FC<CMSBatchRendererProps> = ({
  components,
  fallback,
  errorFallback,
  onMetrics,
  preload = false
}) => {
  useEffect(() => {
    if (preload) {
      // Preload all components in the batch
      const types = components.map(c => c.type);
      cmsComponentFactory.preloadComponents(types);
    }
  }, [components, preload]);

  return (
    <>
      {components.map((component) => (
        <CMSComponentRenderer
          key={component.id}
          {...component}
          fallback={fallback}
          errorFallback={errorFallback}
          onMetrics={onMetrics}
        />
      ))}
    </>
  );
};

// ============================================================================
// Export Utilities
// ============================================================================

export { cmsComponentFactory } from './factory';
export type { CMSComponentFactory } from './factory';
