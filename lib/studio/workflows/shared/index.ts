/**
 * Shared Workflow Infrastructure
 *
 * Common utilities for Vercel Workflow SDK workflows.
 * Used by both Import and Greenfield workflows to ensure consistent patterns.
 *
 * @module workflows/shared
 */

// Re-export progress heartbeat utilities
export {
  ProgressHeartbeat,
  createProgressHeartbeat,
  type HeartbeatConfig,
  type HeartbeatCounts,
} from './progress-heartbeat';

// Re-export internal API utilities
export {
  getInternalApiBaseUrl,
  getInternalApiUrl,
  getInternalApiHeaders,
  callInternalApi,
} from './internal-api';
