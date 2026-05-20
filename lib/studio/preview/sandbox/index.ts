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
  UpdateSandboxRequest,
  SandboxFile,
  SandboxSyncRequest,
} from './types'

export {
  createSandbox,
  getSandbox,
  updateDesignSystem,
  updateComponent,
  syncFilesToSandbox,
  stopSandbox,
  cleanupIdleSandboxes,
  getActiveSandboxes,
  isSandboxConfigured,
  reconnectSandbox,
} from './sandbox-manager'
