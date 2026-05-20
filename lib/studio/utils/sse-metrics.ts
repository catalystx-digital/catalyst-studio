/**
 * SSE Metrics Tracker
 *
 * Tracks Server-Sent Events connection metrics for monitoring and debugging.
 * This is a simple in-memory tracker - metrics reset on page refresh.
 *
 * For production monitoring, consider integrating with:
 * - Vercel Analytics
 * - Posthog
 * - Custom monitoring dashboard
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 3.1
 * @module sse-metrics
 */

export interface SSEMetricsState {
  totalConnections: number
  totalReconnections: number
  totalErrors: number
  totalMessages: number
  errorRate: number
  lastConnectionTime: Date | null
  lastMessageTime: Date | null
  lastErrorTime: Date | null
}

class SSEMetricsTracker {
  private connections = 0
  private reconnections = 0
  private errors = 0
  private messagesReceived = 0
  private lastConnectionTime: Date | null = null
  private lastMessageTime: Date | null = null
  private lastErrorTime: Date | null = null

  /**
   * Record a new SSE connection
   */
  recordConnection() {
    this.connections++
    this.lastConnectionTime = new Date()
    this.logDebug('Connection established', { total: this.connections })
  }

  /**
   * Record a reconnection attempt
   */
  recordReconnection() {
    this.reconnections++
    this.logDebug('Reconnection attempt', { total: this.reconnections })
  }

  /**
   * Record an SSE error
   */
  recordError() {
    this.errors++
    this.lastErrorTime = new Date()
    this.logDebug('Error occurred', { total: this.errors })
  }

  /**
   * Record a received message
   */
  recordMessage() {
    this.messagesReceived++
    this.lastMessageTime = new Date()
  }

  /**
   * Get current metrics snapshot
   */
  getStats(): SSEMetricsState {
    return {
      totalConnections: this.connections,
      totalReconnections: this.reconnections,
      totalErrors: this.errors,
      totalMessages: this.messagesReceived,
      errorRate: this.errors / Math.max(this.connections, 1),
      lastConnectionTime: this.lastConnectionTime,
      lastMessageTime: this.lastMessageTime,
      lastErrorTime: this.lastErrorTime,
    }
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.connections = 0
    this.reconnections = 0
    this.errors = 0
    this.messagesReceived = 0
    this.lastConnectionTime = null
    this.lastMessageTime = null
    this.lastErrorTime = null
  }

  /**
   * Log to console in development mode
   */
  private logDebug(message: string, data?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SSE Metrics] ${message}`, data ?? '')
    }
  }
}

// Singleton instance
export const sseMetrics = new SSEMetricsTracker()

/**
 * Hook to access SSE metrics in React components
 * Useful for debugging/monitoring dashboards
 */
export function useSSEMetrics(): SSEMetricsState {
  // This is a simple snapshot - not reactive
  // For reactive updates, implement with useState + polling
  return sseMetrics.getStats()
}
