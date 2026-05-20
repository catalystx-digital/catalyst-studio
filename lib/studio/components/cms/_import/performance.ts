/**
 * Performance monitoring utilities for import integration
 */

export interface PerformanceMetrics {
  operation: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private timers: Map<string, Array<{ id: string; start: number }>> = new Map()
  private timerCounter = 0
  private readonly WARNING_THRESHOLD = 4000 // 4s warning threshold
  private readonly ERROR_THRESHOLD = 200000 // 8s error threshold

  /**
   * Start timing an operation
   */
  public startTimer(operation: string): string {
    const timerId = `${operation}:${++this.timerCounter}`
    const start = performance.now()
    const timersForOperation = this.timers.get(operation) || []
    timersForOperation.push({ id: timerId, start })
    this.timers.set(operation, timersForOperation)
    return timerId
  }

  /**
   * End timing and record metrics
   */
  public endTimer(operation: string, metadata?: Record<string, any>, timerId?: string): number {
    const timersForOperation = this.timers.get(operation)
    if (!timersForOperation || timersForOperation.length === 0) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`No timer found for operation: ${operation}`)
      }
      return 0
    }

    let index = timersForOperation.length - 1
    if (timerId) {
      index = timersForOperation.findIndex(timer => timer.id === timerId)
    }

    if (index === -1) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`No timer found for operation: ${operation}`)
      }
      return 0
    }

    const [{ start }] = timersForOperation.splice(index, 1)
    if (timersForOperation.length === 0) {
      this.timers.delete(operation)
    }

    const duration = performance.now() - start

    const metric: PerformanceMetrics = {
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    }

    this.metrics.push(metric)

    // Log warnings for slow operations
    if (duration > this.ERROR_THRESHOLD) {
      if (process.env.NODE_ENV === 'development') {
      console.error(`PERFORMANCE ERROR: ${operation} took ${duration.toFixed(2)}ms (>8000ms threshold)`)
      }
    } else if (duration > this.WARNING_THRESHOLD) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`PERFORMANCE WARNING: ${operation} took ${duration.toFixed(2)}ms (>4000ms threshold)`)
      }
    }

    return duration
  }

  /**
   * Measure async operation
   */
  public async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(operation)
    try {
      const result = await fn()
      this.endTimer(operation, metadata, timerId)
      return result
    } catch (error) {
      this.endTimer(operation, { ...metadata, error: true }, timerId)
      throw error
    }
  }

  /**
   * Measure sync operation
   */
  public measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const timerId = this.startTimer(operation)
    try {
      const result = fn()
      this.endTimer(operation, metadata, timerId)
      return result
    } catch (error) {
      this.endTimer(operation, { ...metadata, error: true }, timerId)
      throw error
    }
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalOperations: number
    averageDuration: number
    slowOperations: number
    errorOperations: number
    operationBreakdown: Map<string, { count: number; avgDuration: number; maxDuration: number }>
  } {
    const operationBreakdown = new Map<string, { count: number; avgDuration: number; maxDuration: number }>()
    
    // Group metrics by operation
    for (const metric of this.metrics) {
      const existing = operationBreakdown.get(metric.operation) || { count: 0, avgDuration: 0, maxDuration: 0 }
      existing.count++
      existing.avgDuration = (existing.avgDuration * (existing.count - 1) + metric.duration) / existing.count
      existing.maxDuration = Math.max(existing.maxDuration, metric.duration)
      operationBreakdown.set(metric.operation, existing)
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0)
    const slowOperations = this.metrics.filter(m => m.duration > this.WARNING_THRESHOLD).length
    const errorOperations = this.metrics.filter(m => m.duration > this.ERROR_THRESHOLD).length

    return {
      totalOperations: this.metrics.length,
      averageDuration: this.metrics.length > 0 ? totalDuration / this.metrics.length : 0,
      slowOperations,
      errorOperations,
      operationBreakdown
    }
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.metrics = []
    this.timers.clear()
    this.timerCounter = 0
  }

  /**
   * Export metrics for reporting
   */
  public exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()