import React from 'react';
import { ComponentType, ComponentPerformanceMetrics } from './types';

// ============================================================================
// Performance Thresholds
// ============================================================================

export interface PerformanceThresholds {
  renderTime: number;      // ms
  mountTime: number;       // ms
  bundleSize: number;      // bytes
  memoryUsage: number;     // bytes
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  renderTime: 50,          // 50ms max render time
  mountTime: 100,          // 100ms max mount time
  bundleSize: 10240,       // 10KB gzipped
  memoryUsage: 5242880     // 5MB memory usage
};

// ============================================================================
// Performance Monitor Class
// ============================================================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, ComponentPerformanceMetrics[]> = new Map();
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private alertCallbacks: Set<(alert: PerformanceAlert) => void> = new Set();
  private analyticsCallback?: (metrics: ComponentPerformanceMetrics) => void;

  private constructor() {
    // Setup performance observer if available
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.setupPerformanceObserver();
    }
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // ============================================================================
  // Performance Tracking
  // ============================================================================

  /**
   * Track component render performance
   */
  public trackComponentRender(
    componentType: ComponentType,
    renderTime: number,
    additionalMetrics?: Partial<ComponentPerformanceMetrics>
  ): void {
    const metrics: ComponentPerformanceMetrics = {
      componentId: `${componentType}-${Date.now()}`,
      componentType,
      renderTime,
      mountTime: renderTime,
      updateCount: 1,
      timestamp: Date.now(),
      ...additionalMetrics
    };

    this.recordMetrics(metrics);
    this.checkThresholds(metrics);
    this.sendAnalytics(metrics);
  }

  /**
   * Track component update
   */
  public trackComponentUpdate(
    componentId: string,
    componentType: ComponentType,
    updateTime: number
  ): void {
    const existingMetrics = this.getMetricsById(componentId);
    
    if (existingMetrics) {
      existingMetrics.updateCount++;
      existingMetrics.renderTime = updateTime;
      this.checkThresholds(existingMetrics);
    } else {
      this.trackComponentRender(componentType, updateTime, { componentId });
    }
  }

  /**
   * Track bundle size
   */
  public trackBundleSize(componentType: ComponentType, size: number): void {
    const metrics = this.getLatestMetrics(componentType);
    
    if (metrics) {
      metrics.bundleSize = size;
      this.checkThresholds(metrics);
    }
  }

  /**
   * Track memory usage
   */
  public trackMemoryUsage(componentType: ComponentType, usage: number): void {
    const metrics = this.getLatestMetrics(componentType);
    
    if (metrics) {
      metrics.memoryUsage = usage;
      this.checkThresholds(metrics);
    }
  }

  // ============================================================================
  // Threshold Management
  // ============================================================================

  /**
   * Set performance thresholds
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get current thresholds
   */
  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(metrics: ComponentPerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    if (metrics.renderTime > this.thresholds.renderTime) {
      alerts.push({
        type: 'render-time',
        componentType: metrics.componentType,
        actual: metrics.renderTime,
        threshold: this.thresholds.renderTime,
        severity: this.getSeverity(metrics.renderTime, this.thresholds.renderTime)
      });
    }

    if (metrics.bundleSize && metrics.bundleSize > this.thresholds.bundleSize) {
      alerts.push({
        type: 'bundle-size',
        componentType: metrics.componentType,
        actual: metrics.bundleSize,
        threshold: this.thresholds.bundleSize,
        severity: this.getSeverity(metrics.bundleSize, this.thresholds.bundleSize)
      });
    }

    if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory-usage',
        componentType: metrics.componentType,
        actual: metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage,
        severity: this.getSeverity(metrics.memoryUsage, this.thresholds.memoryUsage)
      });
    }

    alerts.forEach(alert => this.triggerAlert(alert));
  }

  /**
   * Calculate severity based on how much threshold is exceeded
   */
  private getSeverity(actual: number, threshold: number): 'warning' | 'error' | 'critical' {
    const ratio = actual / threshold;
    
    if (ratio > 2) return 'critical';
    if (ratio > 1.5) return 'error';
    return 'warning';
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Register alert callback
   */
  public onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(alert: PerformanceAlert): void {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Performance Alert [${alert.severity}]:`, alert);
    }

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Alert callback failed:', error);
        }
      }
    });
  }

  // ============================================================================
  // Analytics Integration
  // ============================================================================

  /**
   * Set analytics callback
   */
  public setAnalyticsCallback(callback: (metrics: ComponentPerformanceMetrics) => void): void {
    this.analyticsCallback = callback;
  }

  /**
   * Send metrics to analytics
   */
  private sendAnalytics(metrics: ComponentPerformanceMetrics): void {
    if (this.analyticsCallback) {
      try {
        this.analyticsCallback(metrics);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Analytics callback failed:', error);
        }
      }
    }
  }

  // ============================================================================
  // Metrics Management
  // ============================================================================

  /**
   * Record metrics
   */
  private recordMetrics(metrics: ComponentPerformanceMetrics): void {
    const key = metrics.componentType;
    const existing = this.metrics.get(key) || [];
    
    existing.push(metrics);
    
    // Keep only last 100 entries per component type
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.metrics.set(key, existing);
  }

  /**
   * Get metrics by component ID
   */
  private getMetricsById(componentId: string): ComponentPerformanceMetrics | undefined {
    for (const metricsArray of this.metrics.values()) {
      const found = metricsArray.find(m => m.componentId === componentId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Get latest metrics for component type
   */
  private getLatestMetrics(componentType: ComponentType): ComponentPerformanceMetrics | undefined {
    const metricsArray = this.metrics.get(componentType);
    return metricsArray?.[metricsArray.length - 1];
  }

  /**
   * Get all metrics for component type
   */
  public getMetrics(componentType: ComponentType): ComponentPerformanceMetrics[] {
    return this.metrics.get(componentType) || [];
  }

  /**
   * Get average metrics for component type
   */
  public getAverageMetrics(componentType: ComponentType): Partial<ComponentPerformanceMetrics> | null {
    const metricsArray = this.metrics.get(componentType);
    
    if (!metricsArray || metricsArray.length === 0) {
      return null;
    }

    const sum = metricsArray.reduce((acc, m) => ({
      renderTime: (acc.renderTime || 0) + m.renderTime,
      mountTime: (acc.mountTime || 0) + m.mountTime,
      updateCount: (acc.updateCount || 0) + m.updateCount,
      bundleSize: (acc.bundleSize || 0) + (m.bundleSize || 0),
      memoryUsage: (acc.memoryUsage || 0) + (m.memoryUsage || 0)
    }), {} as Partial<ComponentPerformanceMetrics>);

    const count = metricsArray.length;

    return {
      renderTime: sum.renderTime! / count,
      mountTime: sum.mountTime! / count,
      updateCount: sum.updateCount! / count,
      bundleSize: sum.bundleSize ? sum.bundleSize / count : undefined,
      memoryUsage: sum.memoryUsage ? sum.memoryUsage / count : undefined
    };
  }

  /**
   * Clear metrics
   */
  public clearMetrics(componentType?: ComponentType): void {
    if (componentType) {
      this.metrics.delete(componentType);
    } else {
      this.metrics.clear();
    }
  }

  // ============================================================================
  // Performance Observer Setup
  // ============================================================================

  private setupPerformanceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.startsWith('cms-component-')) {
            const componentType = entry.name.replace('cms-component-', '') as ComponentType;
            this.trackComponentRender(componentType, entry.duration);
          }
        }
      });

      observer.observe({ entryTypes: ['measure'] });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to setup PerformanceObserver:', error);
      }
    }
  }

  // ============================================================================
  // Report Generation
  // ============================================================================

  /**
   * Get report (alias for generateReport for compatibility)
   */
  public getReport(): any {
    return this.generateReport();
  }
  
  /**
   * Subscribe to metric updates
   */
  public subscribe(callback: (report: any) => void): () => void {
    // Simple subscription implementation
    const interval = setInterval(() => {
      callback(this.getReport());
    }, 2000);
    
    return () => clearInterval(interval);
  }

  /**
   * Export metrics in various formats
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const report = this.getReport();
    
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }
    
    // CSV format
    let csv = 'Component Type,Render Time,Mount Time,Update Count,Timestamp\n';
    Object.entries(report.components).forEach(([type, metrics]: [string, any]) => {
      if (Array.isArray(metrics)) {
        metrics.forEach(metric => {
          csv += `${type},${metric.renderTime},${metric.mountTime},${metric.updateCount},${new Date(metric.timestamp).toISOString()}\n`;
        });
      }
    });
    
    return csv;
  }
  
  /**
   * Generate performance report
   */
  public generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: Date.now(),
      components: {},
      summary: {
        totalComponents: 0,
        averageRenderTime: 0,
        slowestComponent: null,
        fastestComponent: null,
        violations: []
      }
    };

    let totalRenderTime = 0;
    let componentCount = 0;
    let slowest: { type: ComponentType; time: number } | null = null;
    let fastest: { type: ComponentType; time: number } | null = null;

    this.metrics.forEach((metricsArray, componentType) => {
      const average = this.getAverageMetrics(componentType as ComponentType);
      
      if (average) {
        report.components[componentType] = average;
        componentCount++;
        
        if (average.renderTime) {
          totalRenderTime += average.renderTime;
          
          if (!slowest || average.renderTime > slowest.time) {
            slowest = { type: componentType as ComponentType, time: average.renderTime };
          }
          
          if (!fastest || average.renderTime < fastest.time) {
            fastest = { type: componentType as ComponentType, time: average.renderTime };
          }
          
          if (average.renderTime > this.thresholds.renderTime) {
            report.summary.violations.push({
              componentType: componentType as ComponentType,
              metric: 'renderTime',
              actual: average.renderTime,
              threshold: this.thresholds.renderTime
            });
          }
        }
      }
    });

    report.summary.totalComponents = componentCount;
    report.summary.averageRenderTime = componentCount > 0 ? totalRenderTime / componentCount : 0;
    report.summary.slowestComponent = slowest;
    report.summary.fastestComponent = fastest;

    return report;
  }
}

// ============================================================================
// Higher-Order Component for Performance Tracking
// ============================================================================

export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentType: ComponentType
): React.ComponentType<P> {
  const monitor = PerformanceMonitor.getInstance();

  // Use Date.now() fallback for non-browser environments
  const getTimestamp = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  );

  // Create a wrapper component instead of using forwardRef directly
  const WrappedComponent = (props: P) => {
    if (typeof window === 'undefined') {
      return React.createElement(Component, props);
    }

    const renderStartTime = React.useRef(getTimestamp());
    const updateCount = React.useRef(0);
    const componentId = React.useRef(`${componentType}-${Date.now()}`);

    React.useEffect(() => {
      const mountTime = getTimestamp() - renderStartTime.current;
      monitor.trackComponentRender(componentType, mountTime, {
        componentId: componentId.current
      });
    }, []);

    React.useEffect(() => {
      updateCount.current++;
      
      if (updateCount.current > 1) {
        const updateTime = getTimestamp() - renderStartTime.current;
        monitor.trackComponentUpdate(componentId.current, componentType, updateTime);
      }
      
      renderStartTime.current = getTimestamp();
    });

    return React.createElement(Component, props);
  };

  // Set display name for debugging
  WrappedComponent.displayName = `WithPerformanceTracking(${Component.displayName || Component.name || componentType})`;
  
  return WrappedComponent;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface PerformanceAlert {
  type: 'render-time' | 'bundle-size' | 'memory-usage';
  componentType: ComponentType;
  actual: number;
  threshold: number;
  severity: 'warning' | 'error' | 'critical';
}

export interface PerformanceReport {
  timestamp: number;
  components: {
    [key: string]: Partial<ComponentPerformanceMetrics>;
  };
  summary: {
    totalComponents: number;
    averageRenderTime: number;
    slowestComponent: { type: ComponentType; time: number } | null;
    fastestComponent: { type: ComponentType; time: number } | null;
    violations: Array<{
      componentType: ComponentType;
      metric: string;
      actual: number;
      threshold: number;
    }>;
  };
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const performanceMonitor = PerformanceMonitor.getInstance();

