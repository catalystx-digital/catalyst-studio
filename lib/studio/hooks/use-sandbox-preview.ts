'use client'

/**
 * React Hook for Vercel Sandbox Preview
 *
 * Manages sandbox lifecycle and provides real-time preview URL
 * for the Site Builder and Design System pages.
 *
 * Architecture (TKT-066):
 * - Sandbox uses pre-built tarball from generate-head --provider standalone
 * - UCS provider fetches CMS data from database at RUNTIME
 * - Design system is loaded dynamically from database
 * - NO file syncing needed - all data comes from database
 *
 * Features:
 * - Automatic sandbox creation on mount
 * - Sandbox reuse for same website
 * - Cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SandboxInstance } from '@/lib/studio/preview/sandbox/types'

interface UseSandboxPreviewOptions {
  /** Website ID to create sandbox for */
  websiteId: string
  /** Enable auto-creation on mount */
  autoCreate?: boolean
}

interface UseSandboxPreviewReturn {
  /** Current sandbox instance */
  sandbox: SandboxInstance | null
  /** Preview URL (if sandbox is ready) */
  previewUrl: string | null
  /** Current status */
  status: 'idle' | 'creating' | 'ready' | 'error'
  /** Error message if any */
  error: string | null
  /** Create or get sandbox */
  create: () => Promise<void>
  /** Recreate sandbox (clears state and creates fresh) - use when sandbox expires */
  recreate: () => Promise<void>
  /** Stop and cleanup sandbox */
  stop: () => Promise<void>
  /** Whether sandbox is configured (env vars present) */
  isConfigured: boolean
}

/**
 * Hook for managing Vercel Sandbox preview
 *
 * The sandbox runs a pre-built Next.js app that uses the UCS provider
 * to fetch all CMS data (components, design system) from the database
 * at runtime. No file syncing is needed.
 */
export function useSandboxPreview(options: UseSandboxPreviewOptions): UseSandboxPreviewReturn {
  const { websiteId, autoCreate = true } = options

  const [sandbox, setSandbox] = useState<SandboxInstance | null>(null)
  const [status, setStatus] = useState<'idle' | 'creating' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)

  const isMountedRef = useRef(true)
  const previousWebsiteIdRef = useRef(websiteId)

  // Polling refs for async job pattern
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentJobIdRef = useRef<string | null>(null)

  /** Polling interval in milliseconds (1.5s for faster detection) */
  const POLLING_INTERVAL_MS = 1500

  /**
   * Stop polling for job status
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    currentJobIdRef.current = null
  }, [])

  /**
   * Map API status to hook status
   * API: PENDING, CREATING_SANDBOX, SYNCING_FILES, READY, ERROR
   * Hook: idle, creating, ready, error
   */
  const mapApiStatusToHookStatus = (apiStatus: string): 'idle' | 'creating' | 'ready' | 'error' => {
    switch (apiStatus) {
      case 'PENDING':
      case 'CREATING_SANDBOX':
      case 'SYNCING_FILES':
        return 'creating'
      case 'READY':
        return 'ready'
      case 'ERROR':
        return 'error'
      default:
        return 'creating'
    }
  }

  /**
   * Poll job status endpoint
   */
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (!isMountedRef.current) return

    try {
      const response = await fetch(`/api/preview/sandbox/status/${jobId}`)

      if (!isMountedRef.current) return

      if (!response.ok) {
        // Handle network/server errors gracefully
        console.error(`[useSandboxPreview] Poll failed with status ${response.status}`)
        return // Keep polling, might be temporary
      }

      const data = await response.json()

      if (!isMountedRef.current) return

      // Update status based on job status
      const hookStatus = mapApiStatusToHookStatus(data.status)
      setStatus(hookStatus)

      // Handle terminal states
      if (data.status === 'READY') {
        stopPolling()
        // Create sandbox instance from job data
        setSandbox({
          id: data.jobId,
          websiteId,
          previewUrl: data.previewUrl,
          status: 'ready',
          createdAt: new Date(data.createdAt),
          lastActivityAt: new Date(data.updatedAt),
        })
      } else if (data.status === 'ERROR') {
        stopPolling()
        setError(data.error || 'Sandbox creation failed')
      }
    } catch (err) {
      // Network error - log but keep polling (might be temporary)
      console.error('[useSandboxPreview] Poll error:', err)
    }
  }, [stopPolling])

  /**
   * Start polling for job status
   */
  const startPolling = useCallback((jobId: string) => {
    // Stop any existing polling
    stopPolling()

    currentJobIdRef.current = jobId

    // Poll immediately
    pollJobStatus(jobId)

    // Set up interval
    pollingIntervalRef.current = setInterval(() => {
      if (currentJobIdRef.current === jobId) {
        pollJobStatus(jobId)
      }
    }, POLLING_INTERVAL_MS)
  }, [stopPolling, pollJobStatus])

  /**
   * Create or get sandbox (async job pattern)
   * - POST to create job, get jobId
   * - If existing READY job, use it directly
   * - Otherwise, poll status until ready/error
   */
  const create = useCallback(async () => {
    if (!websiteId) return

    setStatus('creating')
    setError(null)

    try {
      const response = await fetch('/api/preview/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId }),
      })

      const data = await response.json()

      if (!isMountedRef.current) return

      if (!data.success) {
        if (response.status === 503) {
          setIsConfigured(false)
        }
        setStatus('error')
        setError(data.error || 'Failed to create sandbox')
        return
      }

      // Check if sandbox is already ready (200 response with previewUrl)
      if (response.status === 200 && data.previewUrl) {
        // Existing ready job - use it directly
        setSandbox({
          id: data.jobId,
          websiteId,
          previewUrl: data.previewUrl,
          status: 'ready',
          createdAt: new Date(),
          lastActivityAt: new Date(),
        })
        setStatus('ready')
        return
      }

      // New job created (202 response) - start polling
      if (data.jobId) {
        startPolling(data.jobId)
      } else {
        setStatus('error')
        setError('No jobId returned from server')
      }
    } catch (err) {
      if (!isMountedRef.current) return
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }, [websiteId, startPolling])

  /**
   * Stop and cleanup sandbox
   */
  const stop = useCallback(async () => {
    if (!sandbox) return

    try {
      await fetch(`/api/preview/sandbox?websiteId=${websiteId}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to stop sandbox:', err)
    }

    setSandbox(null)
    setStatus('idle')
  }, [sandbox, websiteId])

  /**
   * Recreate sandbox (for when sandbox expires/stops)
   * Clears local state and server-side cache, then creates fresh
   */
  const recreate = useCallback(async () => {
    if (!websiteId) return

    // Clear local state
    setSandbox(null)
    setStatus('creating')
    setError(null)

    // Delete stale sandbox from server cache
    try {
      await fetch(`/api/preview/sandbox?websiteId=${websiteId}`, {
        method: 'DELETE',
      })
    } catch {
      // Ignore delete errors - sandbox may already be gone
    }

    // Create fresh sandbox
    await create()
  }, [websiteId, create])

  // Detect websiteId changes and reset sandbox state
  useEffect(() => {
    if (previousWebsiteIdRef.current !== websiteId) {
      console.log(`[useSandboxPreview] Website changed: ${previousWebsiteIdRef.current} -> ${websiteId}`)
      previousWebsiteIdRef.current = websiteId
      // Stop any active polling
      stopPolling()
      // Clear sandbox state - a new sandbox will be created for the new website
      setSandbox(null)
      setStatus('idle')
      setError(null)
    }
  }, [websiteId, stopPolling])

  // Auto-create on mount
  useEffect(() => {
    isMountedRef.current = true

    if (autoCreate && websiteId) {
      create()
    }

    return () => {
      isMountedRef.current = false
      // Cleanup polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, []) // Only run on mount, not on create change

  return {
    sandbox,
    previewUrl: sandbox?.previewUrl || null,
    status,
    error,
    create,
    recreate,
    stop,
    isConfigured,
  }
}

/**
 * Lightweight hook to check if sandbox is configured
 */
export function useSandboxConfigured(): boolean {
  const [isConfigured, setIsConfigured] = useState(true)

  useEffect(() => {
    fetch('/api/preview/sandbox?websiteId=_config_check')
      .then(response => {
        if (response.status === 503) {
          setIsConfigured(false)
        }
      })
      .catch(() => {})
  }, [])

  return isConfigured
}
