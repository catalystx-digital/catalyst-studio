/**
 * Vercel Sandbox Manager
 *
 * Manages the lifecycle of preview sandboxes for websites.
 * Each website gets a dedicated sandbox running a Next.js dev server.
 *
 * Architecture (TKT-066):
 * - Uses pre-built tarball from generate-head --provider standalone
 * - Tarball is built at deployment time and stored in /public/sandbox-template.tar.gz
 * - Each sandbox receives the tarball, extracts it, and runs with website-specific .env.local
 * - UCS provider fetches data at runtime from the database
 *
 * Features:
 * - Sandbox pooling per website
 * - Automatic cleanup of idle sandboxes
 * - UCS runtime environment injection
 *
 * Tarball can be served from Vercel Blob or a configured generic S3-compatible public URL.
 */

import { Sandbox, type Command } from '@vercel/sandbox'
import type {
  SandboxInstance,
  SandboxConfig,
} from './types'

// Global store to survive Next.js hot reloads in development
// Uses globalThis to persist across module reloads
interface SandboxStore {
  activeSandboxes: Map<string, SandboxInstance>
  sandboxHandles: Map<string, Sandbox>
}

declare global {
  // eslint-disable-next-line no-var
  var __sandboxStore: SandboxStore | undefined
}

// Initialize or reuse global store
if (!globalThis.__sandboxStore) {
  globalThis.__sandboxStore = {
    activeSandboxes: new Map<string, SandboxInstance>(),
    sandboxHandles: new Map<string, Sandbox>(),
  }
}

// In-memory store for active sandboxes
// In production, this should be backed by Redis or similar for multi-instance support
const activeSandboxes = globalThis.__sandboxStore.activeSandboxes
const sandboxHandles = globalThis.__sandboxStore.sandboxHandles

// Default configuration
const DEFAULT_CONFIG: Partial<SandboxConfig> = {
  vcpus: 2,
  timeoutMinutes: 30,
}

// Idle timeout for cleanup (15 minutes of inactivity)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000

// URL to pre-built tarball
// Priority order for tarball URL:
// 1. VERCEL_BLOB_TARBALL_URL - Vercel Blob
// 2. SANDBOX_TARBALL_URL - Custom/testing URL
// 3. STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL - Generic S3-compatible public base URL
function getTarballUrl(): string {
  if (process.env.VERCEL_BLOB_TARBALL_URL) {
    return process.env.VERCEL_BLOB_TARBALL_URL
  }
  // Priority 2: Custom URL (for testing/custom deployments)
  if (process.env.SANDBOX_TARBALL_URL) {
    return process.env.SANDBOX_TARBALL_URL
  }
  const baseUrl = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL?.replace(/ /g, '%20')
  if (baseUrl) {
    return `${baseUrl}/sandbox-templates/sandbox-template.tar.gz`
  }
  throw new Error('Preview sandbox tarball URL is not configured. Set VERCEL_BLOB_TARBALL_URL, SANDBOX_TARBALL_URL, or STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL.')
}

/**
 * Decode JWT payload to extract embedded credentials
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64').toString())
  } catch {
    return {}
  }
}

/**
 * Get sandbox configuration from environment
 *
 * Supports two authentication methods:
 * 1. OIDC Token (preferred): Set VERCEL_OIDC_TOKEN - teamId/projectId extracted from JWT
 * 2. Access Token: Set VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN
 */
function getConfig(): SandboxConfig {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN
  const templateRepoUrl = process.env.PREVIEW_TEMPLATE_REPO_URL

  // OIDC token is preferred - it contains embedded teamId/projectId
  if (oidcToken) {
    const payload = decodeJwtPayload(oidcToken)
    const teamId = payload.owner_id as string
    const projectId = payload.project_id as string

    if (!teamId || !projectId) {
      throw new Error(
        'VERCEL_OIDC_TOKEN is invalid - missing owner_id or project_id in JWT payload'
      )
    }

    return {
      teamId,
      projectId,
      token: oidcToken,
      templateRepoUrl,
      ...DEFAULT_CONFIG,
    }
  }

  // Fallback to explicit credentials
  const teamId = process.env.VERCEL_TEAM_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  const token = process.env.VERCEL_TOKEN

  if (!teamId || !projectId || !token) {
    throw new Error(
      'Vercel Sandbox requires VERCEL_OIDC_TOKEN, or all of: VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and VERCEL_TOKEN'
    )
  }

  return {
    teamId,
    projectId,
    token,
    templateRepoUrl,
    ...DEFAULT_CONFIG,
  }
}

/**
 * Stream sandbox server logs in background for observability
 * Logs are sent to console which goes to Vercel Logs in production
 * Only logs errors/warnings to avoid noise
 */
async function streamSandboxLogs(websiteId: string, serverCommand: Command): Promise<void> {
  const LOG_PREFIX = `[sandbox:${websiteId}]`
  const MAX_LOG_DURATION_MS = 5 * 60 * 1000 // Stream logs for max 5 minutes

  const timeout = setTimeout(() => {
    console.log(`${LOG_PREFIX} Log streaming timeout reached, stopping`)
  }, MAX_LOG_DURATION_MS)

  try {
    for await (const log of serverCommand.logs()) {
      // Only log errors and important runtime messages to Vercel Logs
      if (log.stream === 'stderr') {
        // Parse for error patterns
        const isError = log.data.includes('Error') ||
                       log.data.includes('error') ||
                       log.data.includes('FATAL') ||
                       log.data.includes('Failed')
        const isWarning = log.data.includes('warn') ||
                         log.data.includes('WARN')
        const isDiagnostic = log.data.includes('head-runtime:')

        if (isError) {
          console.error(`${LOG_PREFIX} ERROR:`, log.data.trim())
        } else if (isWarning) {
          console.warn(`${LOG_PREFIX} WARN:`, log.data.trim())
        } else if (isDiagnostic) {
          // Log diagnostics at info level for debugging
          console.log(`${LOG_PREFIX} DIAG:`, log.data.trim())
        }
      } else if (log.stream === 'stdout') {
        // Only log server startup messages
        if (log.data.includes('Ready') || log.data.includes('started')) {
          console.log(`${LOG_PREFIX} ${log.data.trim()}`)
        }
      }
    }
  } catch (err) {
    // Log streaming can fail when sandbox stops - this is expected
    if (err instanceof Error && !err.message.includes('stopping')) {
      console.error(`${LOG_PREFIX} Log stream error:`, err.message)
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Verify sandbox is still alive by checking if the handle is valid
 */
async function verifySandboxAlive(websiteId: string): Promise<boolean> {
  const sandbox = sandboxHandles.get(websiteId)
  if (!sandbox) return false

  try {
    // Try to get sandbox info - this will fail if stopped
    // The sandbox SDK doesn't have an explicit "isAlive" method,
    // but we can try a lightweight operation
    const domain = sandbox.domain(3000)
    return !!domain
  } catch {
    return false
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function commandExitCode(command: Command): number | undefined {
  return (command as Command & { exitCode?: number }).exitCode
}

function assertCommandSucceeded(command: Command, label: string): void {
  const exitCode = commandExitCode(command)
  if (exitCode !== undefined && exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`)
  }
}

async function cleanupExistingHandleBeforeCreate(websiteId: string, instance: SandboxInstance): Promise<void> {
  const sandbox = sandboxHandles.get(websiteId)
  if (!sandbox) return

  try {
    await sandbox.stop()
  } catch (error) {
    const message = errorMessage(error)
    const previousError = instance.error ? ` Previous error: ${instance.error}` : ''
    instance.status = 'error'
    instance.error = `Failed to cleanup existing sandbox before retry: ${message}.${previousError}`
    throw new Error(
      `Cannot create sandbox for ${websiteId} because existing sandbox${instance.id ? ` ${instance.id}` : ''} could not be stopped: ${message}`
    )
  }

  sandboxHandles.delete(websiteId)
  activeSandboxes.delete(websiteId)
}

/**
 * Create a new sandbox for a website
 */
export async function createSandbox(websiteId: string): Promise<SandboxInstance> {
  // Check if sandbox already exists
  const existing = activeSandboxes.get(websiteId)
  if (existing && existing.status === 'ready') {
    // Verify sandbox is still alive before returning
    const isAlive = await verifySandboxAlive(websiteId)
    if (isAlive) {
      existing.lastActivityAt = new Date()
      return existing
    }
    // Sandbox is dead - clean up stale state
    console.log(`[sandbox-manager] Sandbox for ${websiteId} expired, cleaning up`)
    activeSandboxes.delete(websiteId)
    sandboxHandles.delete(websiteId)
  }
  if (existing && existing.status !== 'ready') {
    await cleanupExistingHandleBeforeCreate(websiteId, existing)
  }

  const config = getConfig()

  // Create placeholder instance
  const instance: SandboxInstance = {
    websiteId,
    status: 'creating',
    createdAt: new Date(),
    lastActivityAt: new Date(),
  }
  activeSandboxes.set(websiteId, instance)
  let createdSandbox: Sandbox | undefined

  try {
    // TKT-066: New tarball-based approach
    // Use SDK's built-in tarball source type for cleaner integration
    // The tarball is pre-built and served from our public URL
    // 1. Create sandbox WITH tarball source (SDK handles download + extraction)
    // 2. Write website-specific .env.local
    // 3. npm run dev

    const tarballUrl = getTarballUrl()
    console.log(`[sandbox-manager] Creating sandbox for ${websiteId} with tarball from ${tarballUrl}...`)

    // CRITICAL: ports: [3000] exposes the port to a public URL (sb-xxx.vercel.run)
    // Without this, the sandbox URL returns 404 SANDBOX_NOT_FOUND
    const sandbox = await Sandbox.create({
      teamId: config.teamId,
      projectId: config.projectId,
      token: config.token,
      source: {
        type: 'tarball',
        url: tarballUrl,
      },
      resources: { vcpus: config.vcpus || 2 },
      timeout: (config.timeoutMinutes || 30) * 60 * 1000, // 30 minutes
      ports: [3000], // CRITICAL: Exposes port to public URL
      runtime: 'node24',
    })
    createdSandbox = sandbox
    instance.id = sandbox.sandboxId

    // Store sandbox handle
    sandboxHandles.set(websiteId, sandbox)
    console.log(`[sandbox-manager] Sandbox created with tarball source`)

    // Fix execute permissions on bin scripts
    // Windows-built tarballs lose Unix execute permissions, causing "Permission denied" errors
    console.log(`[sandbox-manager] Fixing execute permissions on bin scripts...`)
    const chmodResult = await sandbox.runCommand({
      cmd: 'chmod',
      args: ['-R', '+x', 'node_modules/.bin'],
    })
    assertCommandSucceeded(chmodResult, 'chmod node_modules/.bin')

    // NOTE: Prisma generate is NO LONGER needed here!
    // The tarball now includes pre-generated Linux Prisma binaries (rhel-openssl-3.0.x)
    // This saves ~15-25 seconds per sandbox creation

    // Get database credentials from host environment
    const databaseUrl = process.env.DATABASE_URL || ''
    const directUrl = process.env.DIRECT_URL || ''

    // Write .env.local - dev mode loads this file
    // This ensures env vars persist if the process restarts
    console.log(`[sandbox-manager] Writing .env.local for website ${websiteId}...`)
    await sandbox.writeFiles([
      {
        path: '.env.local',
        content: Buffer.from(`# Generated by Catalyst Studio sandbox
HEAD_RUNTIME_WEBSITE_ID=${websiteId}
HEAD_RUNTIME_PROVIDER=ucs
DATABASE_URL="${databaseUrl}"
DIRECT_URL="${directUrl}"
HEAD_RUNTIME_CACHE_TTL_SECONDS=0
HEAD_RUNTIME_REVALIDATE_SECONDS=0
`),
      },
    ])

    // Do not generate component-specific preview pages here.
    // The tarball boots the UCS head runtime and fetches canonical snapshot data
    // from the database, matching local preview semantics.

    // Start production server (pre-compiled in tarball, no build needed)
    // Pass environment variables directly via runCommand's env option
    console.log(`[sandbox-manager] Starting production server for website ${websiteId}...`)
    const serverCommand = await sandbox.runCommand({
      cmd: 'npm',
      args: ['start'],
      env: {
        DATABASE_URL: databaseUrl,
        DIRECT_URL: directUrl,
        HEAD_RUNTIME_WEBSITE_ID: websiteId,
        HEAD_RUNTIME_PROVIDER: 'ucs',
        HEAD_RUNTIME_CACHE_TTL_SECONDS: '0',
        HEAD_RUNTIME_REVALIDATE_SECONDS: '0',
        NODE_ENV: 'production',
      },
      detached: true,
    })
    assertCommandSucceeded(serverCommand, 'npm start')

    // Stream server logs in background for observability (goes to Vercel Logs)
    streamSandboxLogs(websiteId, serverCommand).catch((err) => {
      console.error(`[sandbox-manager] Log streaming error for ${websiteId}:`, err)
    })

    // Get preview URL
    const previewUrl = sandbox.domain(3000)

    // IMPORTANT: Do NOT poll for server readiness here!
    // The waitUntil() function has a 60-second timeout on Vercel, and sandbox creation
    // already takes ~32 seconds. Polling would exceed the timeout, causing the job
    // status to never be updated to READY (TKT-069 root cause).
    //
    // Instead, we return the URL immediately. The client-side SandboxPreview component
    // handles server startup delays gracefully - the iframe will show loading until
    // the server is ready. The production server typically starts within 5-15 seconds.
    console.log(`[sandbox-manager] Sandbox created at ${previewUrl} (server starting in background)`)

    // Update instance
    instance.status = 'ready'
    instance.previewUrl = previewUrl

    return instance
  } catch (error) {
    instance.status = 'error'
    const response = (error as { response?: Response } | null)?.response
    const isForbidden = response?.status === 403
    const creationErrorMessage = isForbidden
      ? 'Vercel Sandbox returned 403 Forbidden. The token or OIDC identity is not authorized for this team/project, or the Vercel account does not have Sandbox access. Use the default local preview mode or fix the Vercel Sandbox credentials.'
      : error instanceof Error ? error.message : 'Unknown error'
    instance.error = creationErrorMessage
    console.error(`[sandbox-manager] Error creating sandbox:`, error)

    if (createdSandbox) {
      try {
        await createdSandbox.stop()
        sandboxHandles.delete(websiteId)
      } catch (cleanupError) {
        const cleanupMessage = errorMessage(cleanupError)
        instance.error = `${creationErrorMessage}; cleanup failed: ${cleanupMessage}`
        console.error(`[sandbox-manager] Error cleaning up failed sandbox for ${websiteId}:`, cleanupError)
        throw new Error(instance.error)
      }
    }

    if (isForbidden) {
      throw new Error(instance.error)
    }
    throw error
  }
}

/**
 * Get sandbox for a website
 */
export function getSandbox(websiteId: string): SandboxInstance | undefined {
  const instance = activeSandboxes.get(websiteId)
  if (instance?.status === 'ready' || instance?.status === 'updating') {
    instance.lastActivityAt = new Date()
  }
  return instance
}

/**
 * Stop and cleanup a sandbox
 */
export async function stopSandbox(websiteId: string): Promise<void> {
  const sandbox = sandboxHandles.get(websiteId)
  const instance = activeSandboxes.get(websiteId)

  if (sandbox) {
    try {
      await sandbox.stop()
    } catch (error) {
      console.error(`Error stopping sandbox for ${websiteId}:`, error)
      if (instance) {
        instance.status = 'error'
        instance.error = `Failed to stop sandbox: ${errorMessage(error)}`
      }
      throw error
    }
    sandboxHandles.delete(websiteId)
  }

  if (instance) {
    instance.status = 'stopped'
    activeSandboxes.delete(websiteId)
  }
}

/**
 * Cleanup idle sandboxes
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function cleanupIdleSandboxes(): Promise<void> {
  const now = Date.now()
  const failures: string[] = []

  for (const [websiteId, instance] of activeSandboxes.entries()) {
    const idleTime = now - instance.lastActivityAt.getTime()
    if (idleTime > IDLE_TIMEOUT_MS) {
      console.log(`Cleaning up idle sandbox for website ${websiteId}`)
      try {
        await stopSandbox(websiteId)
      } catch (error) {
        failures.push(`${websiteId}: ${errorMessage(error)}`)
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to cleanup ${failures.length} idle sandbox(es): ${failures.join('; ')}`)
  }
}

/**
 * Get all active sandboxes (for monitoring)
 */
export function getActiveSandboxes(): SandboxInstance[] {
  return Array.from(activeSandboxes.values())
}

/**
 * Check if Vercel Sandbox is configured
 */
export function isSandboxConfigured(): boolean {
  // OIDC token is preferred and sufficient on its own
  if (process.env.VERCEL_OIDC_TOKEN) {
    return true
  }

  // Fallback to explicit credentials
  return !!(
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID &&
    process.env.VERCEL_TOKEN
  )
}

/**
 * Reconnect to an existing sandbox by its Vercel sandbox ID
 *
 * This is used when a different serverless instance needs to sync files
 * to a sandbox that was created by another instance. The sandbox handle
 * is stored in the in-memory cache after reconnection.
 *
 * @param websiteId - Website ID (used as cache key)
 * @param sandboxId - Vercel sandbox ID from database
 * @param previewUrl - Preview URL from database
 * @returns SandboxInstance after reconnection
 * @throws Error if sandbox is no longer available
 */
export async function reconnectSandbox(
  websiteId: string,
  sandboxId: string,
  previewUrl: string
): Promise<SandboxInstance> {
  console.log(`[sandbox-manager] Reconnecting to sandbox ${sandboxId} for website ${websiteId}`)

  // Check if we already have this sandbox cached
  const existing = activeSandboxes.get(websiteId)
  if (existing && existing.id === sandboxId) {
    console.log(`[sandbox-manager] Sandbox ${sandboxId} already in cache`)
    existing.lastActivityAt = new Date()
    return existing
  }

  // Use Sandbox.get() to reconnect to the existing sandbox
  const sandbox = await Sandbox.get({ sandboxId })

  // Create instance metadata
  const instance: SandboxInstance = {
    id: sandboxId,
    websiteId,
    status: 'ready',
    previewUrl,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  }

  // Store in cache for future requests
  activeSandboxes.set(websiteId, instance)
  sandboxHandles.set(websiteId, sandbox)

  console.log(`[sandbox-manager] Successfully reconnected to sandbox ${sandboxId}`)
  return instance
}
