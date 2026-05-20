/**
 * Simple Monitoring and Performance Tracking
 * Provides foundation for future observability
 */

interface PerformanceEntry {
  action: string;
  duration: number;
  timestamp: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: Record<string, any>;
}

class MonitoringService {
  private performanceEntries: PerformanceEntry[] = [];
  private errorEntries: ErrorEntry[] = [];
  private isEnabled = process.env.NODE_ENV === 'development';

  /**
   * Log performance metrics
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logPerformance(action: string, duration: number, metadata?: Record<string, any>) {
    const entry: PerformanceEntry = {
      action,
      duration,
      timestamp: new Date(),
      metadata
    };

    this.performanceEntries.push(entry);

    if (this.isEnabled) {
      console.log(`[PERF] ${action}: ${duration}ms`, metadata || '');
    }

    // Ready for future integration with analytics service
    // analytics.track('performance', entry);
  }

  /**
   * Time an async operation
   */
  async timeOperation<T>(
    action: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      this.logPerformance(action, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logPerformance(action, duration, { error: true });
      throw error;
    }
  }

  /**
   * Log errors
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logError(message: string, error?: Error, context?: Record<string, any>) {
    const entry: ErrorEntry = {
      message,
      stack: error?.stack,
      timestamp: new Date(),
      context
    };

    this.errorEntries.push(entry);

    if (this.isEnabled) {
      console.error(`[ERROR] ${message}`, error, context || '');
    }

    // Ready for future integration with error reporting service
    // errorReporter.report(entry);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary: Record<string, { count: number; avgDuration: number; maxDuration: number }> = {};

    this.performanceEntries.forEach(entry => {
      if (!summary[entry.action]) {
        summary[entry.action] = { count: 0, avgDuration: 0, maxDuration: 0 };
      }
      
      const current = summary[entry.action];
      current.count++;
      current.avgDuration = (current.avgDuration * (current.count - 1) + entry.duration) / current.count;
      current.maxDuration = Math.max(current.maxDuration, entry.duration);
    });

    return summary;
  }

  /**
   * Clear monitoring data
   */
  clear() {
    this.performanceEntries = [];
    this.errorEntries = [];
  }

  /**
   * Export monitoring data for analysis
   */
  export() {
    return {
      performance: this.performanceEntries,
      errors: this.errorEntries,
      summary: this.getPerformanceSummary()
    };
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

/**
 * React Hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const logMount = () => {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      monitoring.logPerformance(`${componentName}.mount`, duration);
    };
  };

  const logRender = () => {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      monitoring.logPerformance(`${componentName}.render`, duration);
    };
  };

  return { logMount, logRender };
}