/**
 * Vercel Sandbox Preview System
 *
 * Exports the sandbox manager and types for live preview functionality.
 */

export type {
  SandboxInstance,
  SandboxConfig,
  SandboxStatus,
  SandboxResponse,
  PreviewDesignTokens,
  PreviewComponentConfig,
  CreateSandboxRequest,
} from './types'

export {
  createSandbox,
  getSandbox,
  stopSandbox,
  cleanupIdleSandboxes,
  getActiveSandboxes,
  isSandboxConfigured,
  reconnectSandbox,
} from './sandbox-manager'
