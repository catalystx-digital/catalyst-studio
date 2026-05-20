'use client'

/**
 * Sandbox Preview Component
 *
 * Displays a live preview of the website using Vercel Sandbox.
 *
 * Architecture (TKT-066):
 * - Sandbox uses pre-built tarball from generate-head --provider standalone
 * - UCS provider fetches CMS data from database at RUNTIME
 * - Design system is loaded dynamically from database
 * - NO file syncing needed - all data comes from database
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSandboxPreview } from '@/lib/studio/hooks/use-sandbox-preview'
import { Loader2, RefreshCw, AlertCircle, ExternalLink, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SandboxPreviewProps {
  websiteId: string
  className?: string
  /** Design concept slug/id to load (changes CSS variables without recreating sandbox) */
  designConcept?: string
  /** Page slug to display */
  pageSlug?: string
}

/**
 * Build the preview URL with optional design concept and page slug query parameters.
 * This allows switching design systems without recreating the sandbox.
 */
function buildPreviewUrl(baseUrl: string, designConcept?: string, pageSlug?: string): string {
  if (!designConcept && !pageSlug) return baseUrl

  try {
    const url = new URL(baseUrl)
    if (designConcept) {
      url.searchParams.set('designConcept', designConcept)
    }
    if (pageSlug) {
      url.searchParams.set('page', pageSlug)
    }
    return url.toString()
  } catch {
    // If URL parsing fails, return the original URL
    return baseUrl
  }
}

export function SandboxPreview({
  websiteId,
  className,
  designConcept,
  pageSlug,
}: SandboxPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [iframeLoadError, setIframeLoadError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const recreateAttemptedRef = useRef(false)
  const previousWebsiteIdRef = useRef(websiteId)

  // Use sandbox preview hook - sandbox fetches all data from database via UCS provider
  const {
    previewUrl,
    status,
    error: sandboxError,
    create,
    recreate,
    isConfigured,
  } = useSandboxPreview({
    websiteId,
    autoCreate: true, // Auto-create sandbox on mount
  })

  // Detect websiteId changes and recreate sandbox for new website
  useEffect(() => {
    if (previousWebsiteIdRef.current !== websiteId) {
      console.log(`[SandboxPreview] Website changed: ${previousWebsiteIdRef.current} -> ${websiteId}`)
      previousWebsiteIdRef.current = websiteId
      // Clear state and recreate sandbox for new website
      setIframeLoadError(false)
      recreateAttemptedRef.current = false
      recreate()
    }
  }, [websiteId, recreate])

  // Handle iframe load errors (sandbox expired/stopped)
  // The iframe can't tell us about 410 errors directly, so we use a message listener
  // and a fallback timeout-based detection
  const handleIframeError = useCallback(() => {
    console.warn('[SandboxPreview] Iframe load error detected')
    if (!recreateAttemptedRef.current) {
      recreateAttemptedRef.current = true
      setIframeLoadError(true)
      recreate()
    }
  }, [recreate])

  // Reset recreate flag when we get a new previewUrl (sandbox recreated)
  useEffect(() => {
    if (previewUrl && status === 'ready') {
      // New sandbox ready - reset flags
      recreateAttemptedRef.current = false
      setIframeLoadError(false)
    }
  }, [previewUrl, status])

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      iframeRef.current?.parentElement?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Not configured state
  if (!isConfigured) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-muted/50', className)}>
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sandbox Not Configured</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Vercel Sandbox requires OIDC token or API credentials.
            Set VERCEL_OIDC_TOKEN environment variable to enable live preview.
          </p>
        </div>
      </div>
    )
  }

  // Sandbox error state
  if (sandboxError) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-destructive/5', className)}>
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sandbox Error</h3>
          <p className="text-sm text-muted-foreground mb-4">{sandboxError}</p>
          <Button onClick={create} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Creating sandbox state - show progress
  if (status === 'creating' && !previewUrl) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center w-full max-w-xs">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-3">Creating sandbox environment...</p>
          <Progress value={25} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground/60">This typically takes about 30 seconds</p>
        </div>
      </div>
    )
  }

  // Ready state with iframe
  return (
    <div className={cn('relative h-full w-full', className)}>
      {/* Toolbar - positioned outside iframe at bottom for less intrusion */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border px-2 py-1.5">
        {/* Status indicator - compact dot only */}
        <div className="flex items-center gap-1.5 px-2 py-0.5" title="Live preview - data from database">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Open in new tab */}
        {previewUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(previewUrl, '_blank')}
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Preview iframe */}
      {previewUrl && !iframeLoadError ? (
        <iframe
          ref={iframeRef}
          src={buildPreviewUrl(previewUrl, designConcept, pageSlug)}
          className="w-full h-full border-0 bg-white"
          title="Website Preview"
          onError={handleIframeError}
        />
      ) : iframeLoadError ? (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">Sandbox expired, recreating...</p>
            <p className="text-xs text-muted-foreground/60">This typically takes about 30 seconds</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <p className="text-sm text-muted-foreground">Waiting for preview URL...</p>
        </div>
      )}
    </div>
  )
}
