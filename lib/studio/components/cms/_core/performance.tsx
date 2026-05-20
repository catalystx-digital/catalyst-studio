'use client';

import React, { useEffect, useRef, Profiler, memo, useMemo, useCallback, ComponentType as ReactComponentType } from 'react';
import { ComponentType, ComponentPerformanceMetrics, CMSComponentProps } from './types';
import { PERFORMANCE_THRESHOLDS } from './constants';

class PerformanceMonitor {
  private metrics: Map<string, ComponentPerformanceMetrics> = new Map();
  private observers: ((metrics: ComponentPerformanceMetrics) => void)[] = [];
  
  recordMetric(metric: ComponentPerformanceMetrics): void {
    this.metrics.set(metric.componentId, metric);
    
    // Warn if performance threshold exceeded
    if (metric.renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Component ${metric.componentType} (${metric.componentId}) exceeded render time threshold: ${metric.renderTime}ms > ${PERFORMANCE_THRESHOLDS.renderTime}ms`
      );
      }
    }
    
    // Notify observers
    this.observers.forEach(observer => observer(metric));
  }
  
  getMetrics(componentId: string): ComponentPerformanceMetrics | undefined {
    return this.metrics.get(componentId);
  }
  
  getAllMetrics(): ComponentPerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }
  
  clearMetrics(): void {
    this.metrics.clear();
  }
  
  subscribe(observer: (metrics: ComponentPerformanceMetrics) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  getAverageRenderTime(componentType?: ComponentType): number {
    const relevantMetrics = componentType
      ? Array.from(this.metrics.values()).filter(m => m.componentType === componentType)
      : Array.from(this.metrics.values());
    
    if (relevantMetrics.length === 0) return 0;
    
    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    return totalTime / relevantMetrics.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order component to measure component performance
 */
export function measurePerformance<P extends { id: string; type: ComponentType }>(
  Component: React.ComponentType<P>,
  componentType: ComponentType
): React.ComponentType<P> {
  return function MeasuredComponent(props: P) {
    const mountTime = useRef<number>(0);
    const updateCount = useRef<number>(0);
    
    useEffect(() => {
      mountTime.current = performance.now();
      return () => {
        const metric: ComponentPerformanceMetrics = {
          componentId: props.id,
          componentType,
          renderTime: 0,
          mountTime: performance.now() - mountTime.current,
          updateCount: updateCount.current,
          timestamp: Date.now()
        };
        performanceMonitor.recordMetric(metric);
      };
    }, []);
    
    useEffect(() => {
      updateCount.current++;
    });
    
    const onRenderCallback = (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      const metric: ComponentPerformanceMetrics = {
        componentId: props.id,
        componentType,
        renderTime: actualDuration,
        mountTime: mountTime.current,
        updateCount: updateCount.current,
        timestamp: Date.now()
      };
      performanceMonitor.recordMetric(metric);
    };
    
    if (process.env.NODE_ENV === 'development') {
      return (
        <Profiler id={props.id} onRender={onRenderCallback}>
          <Component {...props} />
        </Profiler>
      );
    }
    
    return <Component {...props} />;
  };
}

/**
 * Hook to use performance metrics
 */
export function usePerformanceMetrics(componentId?: string): {
  metrics: ComponentPerformanceMetrics | ComponentPerformanceMetrics[] | undefined;
  averageRenderTime: number;
} {
  const [metrics, setMetrics] = React.useState<ComponentPerformanceMetrics | ComponentPerformanceMetrics[] | undefined>(
    componentId ? performanceMonitor.getMetrics(componentId) : performanceMonitor.getAllMetrics()
  );
  
  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe((newMetric) => {
      if (componentId) {
        if (newMetric.componentId === componentId) {
          setMetrics(newMetric);
        }
      } else {
        setMetrics(performanceMonitor.getAllMetrics());
      }
    });
    
    return unsubscribe;
  }, [componentId]);
  
  const averageRenderTime = React.useMemo(() => {
    if (!metrics) return 0;
    
    if (Array.isArray(metrics)) {
      if (metrics.length === 0) return 0;
      const total = metrics.reduce((sum, m) => sum + m.renderTime, 0);
      return total / metrics.length;
    }
    
    return metrics.renderTime;
  }, [metrics]);
  
  return { metrics, averageRenderTime };
}

/**
 * Performance optimization wrapper that applies React.memo with custom comparison
 */
export function withPerformanceOptimization<P extends CMSComponentProps>(
  Component: ReactComponentType<P>,
  options: {
    name?: string
    compareProps?: (prevProps: P, nextProps: P) => boolean
    skipMemo?: boolean
  } = {}
): ReactComponentType<P> {
  const { name = Component.displayName || 'Component', compareProps, skipMemo = false } = options

  // Custom props comparison function
  const defaultCompareProps = (prevProps: P, nextProps: P): boolean => {
    // Quick reference equality check
    if (prevProps === nextProps) return true

    // Check if core props are equal
    if (
      prevProps.id !== nextProps.id ||
      prevProps.type !== nextProps.type ||
      prevProps.category !== nextProps.category
    ) {
      return false
    }

    // Deep compare content (most likely to change)
    if (JSON.stringify(prevProps.content) !== JSON.stringify(nextProps.content)) {
      return false
    }

    // Compare other props
    const prevKeys = Object.keys(prevProps)
    const nextKeys = Object.keys(nextProps)
    
    if (prevKeys.length !== nextKeys.length) return false
    
    // Check if any prop has changed
    for (const key of prevKeys) {
      if (key === 'content') continue // Already checked
      
      const prevValue = (prevProps as any)[key]
      const nextValue = (nextProps as any)[key]
      
      // Handle functions separately
      if (typeof prevValue === 'function' && typeof nextValue === 'function') {
        // Functions are considered equal if their reference hasn't changed
        if (prevValue !== nextValue) return false
      } else if (prevValue !== nextValue) {
        return false
      }
    }

    return true
  }

  const comparisonFn = compareProps || defaultCompareProps

  // Wrap component with performance tracking
  const PerformanceComponent = (props: P) => {
    const startTime = performance.now()
    
    // Memoize expensive computations
    const memoizedContent = useMemo(() => props.content, [JSON.stringify(props.content)])
    
    // Memoize callbacks
    const memoizedCallbacks = useMemo(() => ({
      onLoad: props.onLoad,
      onError: props.onError,
      onInteraction: props.onInteraction
    }), [props.onLoad, props.onError, props.onInteraction])

    // Track render time in development
    if (process.env.NODE_ENV === 'development') {
      React.useLayoutEffect(() => {
        const renderTime = performance.now() - startTime
        if (renderTime > 50) {
          if (process.env.NODE_ENV === 'development') {
          console.warn(`[Performance] ${name} rendered in ${renderTime.toFixed(2)}ms`)
          }
        }
      })
    }

    const optimizedProps = {
      ...props,
      content: memoizedContent,
      ...memoizedCallbacks
    }

    return <Component {...optimizedProps} />
  }

  PerformanceComponent.displayName = `Performance(${name})`

  // Apply React.memo unless explicitly skipped
  return skipMemo ? PerformanceComponent : memo(PerformanceComponent, comparisonFn)
}

/**
 * Hook for optimizing event handlers
 */
export function useOptimizedHandler<T extends (...args: any[]) => any>(
  handler: T | undefined,
  deps: React.DependencyList = []
): T | undefined {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    handler ? (...args: Parameters<T>) => handler(...args) : () => {},
    [handler, ...deps]
  ) as T | undefined
}

/**
 * Hook for optimizing complex computations
 */
export function useOptimizedComputation<T>(
  computation: () => T,
  deps: React.DependencyList
): T {
  return useMemo(computation, deps)
}