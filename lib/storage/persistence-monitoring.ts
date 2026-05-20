import { monitoring } from '@/lib/monitoring';

interface StorageMetrics {
  strategy: string;
  operation: 'save' | 'load' | 'remove' | 'clear';
  duration: number;
  dataSize: number;
  success: boolean;
  quotaUsage?: number;
  error?: string;
}

class PersistenceMonitor {
  private readonly SAVE_THRESHOLD = 100; // 100ms threshold for save operations
  private readonly LOAD_THRESHOLD = 50;  // 50ms threshold for load operations
  private readonly QUOTA_WARNING_THRESHOLD = 0.8; // 80% quota usage warning
  
  private metrics: StorageMetrics[] = [];
  private strategySelections: Map<string, number> = new Map();

  /**
   * Monitor save operation performance
   */
  async monitorSave<T>(
    strategy: string,
    operation: () => Promise<T>,
    dataSize: number
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await operation();
      return result;
    } catch (e) {
      success = false;
      error = (e as Error).message;
      throw e;
    } finally {
      const duration = performance.now() - startTime;
      
      // Record metric
      const metric: StorageMetrics = {
        strategy,
        operation: 'save',
        duration,
        dataSize,
        success,
        error
      };
      
      this.metrics.push(metric);
      
      // Log to main monitoring service
      monitoring.logPerformance('storage.save', duration, {
        strategy,
        dataSize,
        success,
        error
      });
      
      // Warn if exceeds threshold
      if (duration > this.SAVE_THRESHOLD) {
        console.warn(
          `[Storage Performance] Save operation exceeded threshold: ${duration.toFixed(2)}ms (threshold: ${this.SAVE_THRESHOLD}ms)`,
          { strategy, dataSize }
        );
      }
    }
  }

  /**
   * Monitor load operation performance
   */
  async monitorLoad<T>(
    strategy: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await operation();
      return result;
    } catch (e) {
      success = false;
      error = (e as Error).message;
      throw e;
    } finally {
      const duration = performance.now() - startTime;
      
      // Record metric
      const metric: StorageMetrics = {
        strategy,
        operation: 'load',
        duration,
        dataSize: 0, // Size unknown for loads
        success,
        error
      };
      
      this.metrics.push(metric);
      
      // Log to main monitoring service
      monitoring.logPerformance('storage.load', duration, {
        strategy,
        success,
        error
      });
      
      // Warn if exceeds threshold
      if (duration > this.LOAD_THRESHOLD) {
        console.warn(
          `[Storage Performance] Load operation exceeded threshold: ${duration.toFixed(2)}ms (threshold: ${this.LOAD_THRESHOLD}ms)`,
          { strategy }
        );
      }
    }
  }

  /**
   * Monitor storage quota usage
   */
  monitorQuotaUsage(usage: number, quota: number, strategy: string) {
    const percentage = quota > 0 ? usage / quota : 0;
    
    monitoring.logPerformance('storage.quota', percentage * 100, {
      strategy,
      usage,
      quota
    });
    
    if (percentage > this.QUOTA_WARNING_THRESHOLD) {
      console.warn(
        `[Storage Quota] High usage detected: ${(percentage * 100).toFixed(1)}% (${this.formatBytes(usage)} / ${this.formatBytes(quota)})`,
        { strategy }
      );
    }
    
    // Record quota metric
    this.metrics.push({
      strategy,
      operation: 'save',
      duration: 0,
      dataSize: usage,
      success: true,
      quotaUsage: percentage
    });
  }

  /**
   * Track storage strategy selection
   */
  trackStrategySelection(strategy: string) {
    const count = this.strategySelections.get(strategy) || 0;
    this.strategySelections.set(strategy, count + 1);
    
    monitoring.logPerformance('storage.strategy.selected', 0, {
      strategy,
      selectionCount: count + 1
    });
  }

  /**
   * Get performance baseline for testing
   */
  getPerformanceBaseline() {
    const saveMetrics = this.metrics.filter(m => m.operation === 'save' && m.success);
    const loadMetrics = this.metrics.filter(m => m.operation === 'load' && m.success);
    
    const avgSaveTime = saveMetrics.length > 0
      ? saveMetrics.reduce((sum, m) => sum + m.duration, 0) / saveMetrics.length
      : 0;
    
    const avgLoadTime = loadMetrics.length > 0
      ? loadMetrics.reduce((sum, m) => sum + m.duration, 0) / loadMetrics.length
      : 0;
    
    const maxSaveTime = Math.max(...saveMetrics.map(m => m.duration), 0);
    const maxLoadTime = Math.max(...loadMetrics.map(m => m.duration), 0);
    
    return {
      avgSaveTime,
      avgLoadTime,
      maxSaveTime,
      maxLoadTime,
      totalSaves: saveMetrics.length,
      totalLoads: loadMetrics.length,
      failedSaves: this.metrics.filter(m => m.operation === 'save' && !m.success).length,
      failedLoads: this.metrics.filter(m => m.operation === 'load' && !m.success).length,
      strategyUsage: Object.fromEntries(this.strategySelections)
    };
  }

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceAcceptable(): boolean {
    const baseline = this.getPerformanceBaseline();
    
    // Check against thresholds
    if (baseline.avgSaveTime > this.SAVE_THRESHOLD) {
      console.warn(`[Performance] Average save time (${baseline.avgSaveTime.toFixed(2)}ms) exceeds threshold`);
      return false;
    }
    
    if (baseline.avgLoadTime > this.LOAD_THRESHOLD) {
      console.warn(`[Performance] Average load time (${baseline.avgLoadTime.toFixed(2)}ms) exceeds threshold`);
      return false;
    }
    
    // Check failure rates
    const totalSaveAttempts = baseline.totalSaves + baseline.failedSaves;
    const saveFailureRate = totalSaveAttempts > 0 ? baseline.failedSaves / totalSaveAttempts : 0;
    
    if (saveFailureRate > 0.1) { // More than 10% failure rate
      console.warn(`[Performance] High save failure rate: ${(saveFailureRate * 100).toFixed(1)}%`);
      return false;
    }
    
    return true;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      baseline: this.getPerformanceBaseline(),
      strategySelections: Object.fromEntries(this.strategySelections),
      performanceAcceptable: this.isPerformanceAcceptable()
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = [];
    this.strategySelections.clear();
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create performance report
   */
  generateReport(): string {
    const baseline = this.getPerformanceBaseline();
    const report = [
      '=== Storage Performance Report ===',
      '',
      'Average Performance:',
      `  Save: ${baseline.avgSaveTime.toFixed(2)}ms (threshold: ${this.SAVE_THRESHOLD}ms)`,
      `  Load: ${baseline.avgLoadTime.toFixed(2)}ms (threshold: ${this.LOAD_THRESHOLD}ms)`,
      '',
      'Peak Performance:',
      `  Max Save: ${baseline.maxSaveTime.toFixed(2)}ms`,
      `  Max Load: ${baseline.maxLoadTime.toFixed(2)}ms`,
      '',
      'Operations:',
      `  Total Saves: ${baseline.totalSaves} (${baseline.failedSaves} failed)`,
      `  Total Loads: ${baseline.totalLoads} (${baseline.failedLoads} failed)`,
      '',
      'Strategy Usage:',
      ...Object.entries(baseline.strategyUsage).map(([strategy, count]) => 
        `  ${strategy}: ${count} selections`
      ),
      '',
      `Performance Status: ${this.isPerformanceAcceptable() ? '✅ ACCEPTABLE' : '❌ NEEDS OPTIMIZATION'}`
    ];
    
    return report.join('\n');
  }
}

// Singleton instance
export const persistenceMonitor = new PersistenceMonitor();

// Integration hook for React components
export function usePersistenceMonitoring() {
  const logSavePerformance = async <T>(
    operation: () => Promise<T>,
    strategy: string,
    dataSize: number
  ): Promise<T> => {
    return persistenceMonitor.monitorSave(strategy, operation, dataSize);
  };

  const logLoadPerformance = async <T>(
    operation: () => Promise<T>,
    strategy: string
  ): Promise<T> => {
    return persistenceMonitor.monitorLoad(strategy, operation);
  };

  const checkQuota = (usage: number, quota: number, strategy: string) => {
    persistenceMonitor.monitorQuotaUsage(usage, quota, strategy);
  };

  const getReport = () => {
    return persistenceMonitor.generateReport();
  };

  return {
    logSavePerformance,
    logLoadPerformance,
    checkQuota,
    getReport
  };
}