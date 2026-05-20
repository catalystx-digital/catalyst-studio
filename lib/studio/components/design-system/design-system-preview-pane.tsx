'use client'

/**
 * Design System Preview Pane
 * Story 11a Task 5: Live preview for design system editor
 *
 * Displays a live preview using REAL CMS components that updates when
 * color/font changes are made in the design system editor.
 * Uses an iframe loading /studio/design-system-sample which
 * renders actual NavBar, HeroSimple, Footer, etc. components.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Loader2, Monitor, Smartphone, Tablet, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'
import { generateShadcnCss } from '@/lib/studio/design-system/shadcn-defaults'

interface DesignSystemPreviewPaneProps {
  designSystem: ShadcnDesignSystemTokens | null
  className?: string
}

type DeviceSize = 'desktop' | 'tablet' | 'mobile'

const DEVICE_SIZES: Record<DeviceSize, { width: number; height: number; label: string }> = {
  desktop: { width: 800, height: 600, label: 'Desktop' },
  tablet: { width: 600, height: 500, label: 'Tablet' },
  mobile: { width: 375, height: 600, label: 'Mobile' },
}

/**
 * Design System Preview Pane Component
 * Shows live preview of design system changes using real CMS components
 */
export function DesignSystemPreviewPane({ designSystem, className }: DesignSystemPreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop')
  const [lastRenderTime, setLastRenderTime] = useState<number | null>(null)
  const [isPreviewReady, setIsPreviewReady] = useState(false)

  const sendDesignSystemToPreview = useCallback((ds: ShadcnDesignSystemTokens) => {
    if (!iframeRef.current?.contentWindow || !isPreviewReady) return
    try {
      const css = generateShadcnCss(ds.variables, '  ')
      const darkCss = ds.darkVariables ? generateShadcnCss(ds.darkVariables, '  ') : ''
      iframeRef.current.contentWindow.postMessage({ type: 'UPDATE_DESIGN_SYSTEM', payload: { css, darkCss }, timestamp: Date.now() }, '*')
      setLastRenderTime(Date.now())
      setError(null)
    } catch (err) {
      console.error('[DesignSystemPreviewPane] Failed to send design system:', err)
      setError('Failed to update preview')
    }
  }, [isPreviewReady])

  const debouncedSendDesignSystem = useCallback((ds: ShadcnDesignSystemTokens) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
    debounceTimeoutRef.current = setTimeout(() => sendDesignSystemToPreview(ds), 300)
  }, [sendDesignSystemToPreview])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PREVIEW_READY') {
        setIsPreviewReady(true)
        setIsLoading(false)
        if (designSystem) sendDesignSystemToPreview(designSystem)
      } else if (event.data?.type === 'DESIGN_SYSTEM_APPLIED') {
        setLastRenderTime(event.data.timestamp)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [designSystem, sendDesignSystemToPreview])

  useEffect(() => {
    if (designSystem && isPreviewReady) debouncedSendDesignSystem(designSystem)
  }, [designSystem, isPreviewReady, debouncedSendDesignSystem])

  useEffect(() => {
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current) }
  }, [])

  const handleIframeError = useCallback(() => { setError('Failed to load preview'); setIsLoading(false) }, [])

  const handleRefresh = useCallback(() => {
    setIsLoading(true); setIsPreviewReady(false); setError(null)
    if (iframeRef.current) {
      const src = iframeRef.current.src
      iframeRef.current.src = ''
      setTimeout(() => { if (iframeRef.current) iframeRef.current.src = src }, 50)
    }
  }, [])

  const device = DEVICE_SIZES[deviceSize]

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">Live Preview</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <Button variant={deviceSize === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => setDeviceSize('desktop')} title="Desktop"><Monitor className="h-4 w-4" /></Button>
            <Button variant={deviceSize === 'tablet' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => setDeviceSize('tablet')} title="Tablet"><Tablet className="h-4 w-4" /></Button>
            <Button variant={deviceSize === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => setDeviceSize('mobile')} title="Mobile"><Smartphone className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRefresh} disabled={isLoading || !designSystem} title="Refresh preview"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative bg-muted/30">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Loading real components...</span></div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-destructive">Preview Error</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Retry</Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center p-4">
            <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-all duration-300" style={{ width: device.width, height: device.height }}>
              <iframe ref={iframeRef} className="h-full w-full border-none" src="/studio/design-system-sample" title="Design System Preview" onError={handleIframeError} />
            </div>
          </div>
          {lastRenderTime && <p className="pb-2 text-center text-[10px] text-muted-foreground">Last updated: {new Date(lastRenderTime).toLocaleTimeString()}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
