/**
 * Types for Vercel Sandbox Preview System
 *
 * Defines the contract for managing preview sandboxes per website.
 */

/**
 * Sandbox status states
 */
export type SandboxStatus =
  | 'creating'
  | 'ready'
  | 'updating'
  | 'error'
  | 'stopped'

/**
 * Sandbox instance metadata
 */
export interface SandboxInstance {
  /** Unique sandbox ID from Vercel */
  id: string
  /** Website ID this sandbox is for */
  websiteId: string
  /** Current status */
  status: SandboxStatus
  /** Preview URL (port 3000 domain) */
  previewUrl: string
  /** When the sandbox was created */
  createdAt: Date
  /** Last activity timestamp (for idle detection) */
  lastActivityAt: Date
  /** Error message if status is 'error' */
  error?: string
}

/**
 * Design system tokens for preview
 */
export interface PreviewDesignTokens {
  /** Light mode CSS variables */
  variables: Record<string, string>
  /** Dark mode CSS variables */
  darkVariables?: Record<string, string>
}

/**
 * Component configuration for preview
 */
export interface PreviewComponentConfig {
  /** Component type (e.g., 'hero-simple') */
  type: string
  /** Component props */
  props: Record<string, unknown>
}

/**
 * Request to create or get a sandbox for a website
 */
export interface CreateSandboxRequest {
  /** Website ID */
  websiteId: string
  /** Design system tokens */
  designSystem?: PreviewDesignTokens
  /** Initial component configurations */
  components?: PreviewComponentConfig[]
}

/**
 * Request to update a sandbox's content
 */
export interface UpdateSandboxRequest {
  /** Sandbox ID */
  sandboxId: string
  /** Updated design system tokens */
  designSystem?: PreviewDesignTokens
  /** Updated component props (keyed by component ID) */
  componentUpdates?: Record<string, Record<string, unknown>>
}

/**
 * Response from sandbox operations
 */
export interface SandboxResponse {
  /** Whether the operation succeeded */
  success: boolean
  /** Sandbox instance data */
  sandbox?: SandboxInstance
  /** Error message if failed */
  error?: string
}

/**
 * File to sync to sandbox
 */
export interface SandboxFile {
  /** File path relative to sandbox root (e.g., 'app/preview/page.tsx') */
  path: string
  /** File content as string */
  content: string
}

/**
 * Request to sync files to a sandbox (for live updates)
 */
export interface SandboxSyncRequest {
  /** Website ID */
  websiteId: string
  /** Files to write/update */
  files: SandboxFile[]
}

/**
 * Environment configuration for Vercel Sandbox
 */
export interface SandboxConfig {
  /** Vercel Team ID */
  teamId: string
  /** Vercel Project ID */
  projectId: string
  /** Vercel Access Token */
  token: string
  /** Number of vCPUs per sandbox (1-8) */
  vcpus?: number
  /** Timeout in minutes (default: 30) */
  timeoutMinutes?: number
  /** Git repository URL for preview template */
  templateRepoUrl?: string
}
