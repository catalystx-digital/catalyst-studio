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
  id?: string
  /** Website ID this sandbox is for */
  websiteId: string
  /** Current status */
  status: SandboxStatus
  /** Preview URL (port 3000 domain) */
  previewUrl?: string
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
  /** Component instance ID */
  id?: string
  /** Component type (e.g., 'hero-simple') */
  type: string
  /** Parent component ID for nested layouts */
  parentId?: string | null
  /** Component order within its parent */
  position?: number
  /** Component props */
  props: Record<string, unknown>
  /** Normalized component content */
  content?: Record<string, unknown>
  /** Normalized responsive styles */
  styles?: Record<string, unknown>
  /** Normalized component metadata */
  metadata?: Record<string, unknown>
  /** Shared/global component reference */
  sharedComponentId?: string
  /** Global component reference */
  globalComponentId?: string
}

/**
 * Request to create or get a sandbox for a website
 */
export interface CreateSandboxRequest {
  /** Website ID */
  websiteId: string
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
