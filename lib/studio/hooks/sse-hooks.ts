/**
 * SSE Hooks - Export Module
 *
 * Central export for all Server-Sent Events (SSE) based hooks.
 * These hooks provide real-time updates with much lower latency
 * than polling-based alternatives.
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md
 * @module sse-hooks
 */

// Import progress hooks
export {
  isSSESupported,
  useImportProgressHybrid,
  useImportProgressWithSSE,
  type ImportProgressState,
} from './use-import-progress-hybrid'

// AI Context SSE Hooks
export {
  useAIContextSSE,
  useAIContextWithSSE,
  type AIContextSSEState,
} from './use-ai-context-sse'

// SSE Metrics
export {
  sseMetrics,
  useSSEMetrics,
  type SSEMetricsState,
} from '@/lib/studio/utils/sse-metrics'
