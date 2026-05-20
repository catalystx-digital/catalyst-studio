'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useViewport } from 'reactflow'
import { X, ChevronDown, ChevronUp, Activity, Eye, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'

interface PerformanceStatsPanelProps {
  // Node metrics
  totalNodes: number
  visibleNodes: number
  // Viewport sync metrics
  viewportSyncEnabled: boolean
  viewportStats: {
    loadedRegions: number
    totalLoaded: number
  }
  isViewportLoading: boolean
  // Render queue (from VirtualCanvas)
  renderQueueLength?: number
  // Callbacks
  onToggleViewportSync?: (enabled: boolean) => void
  onClose?: () => void
}

// Keyboard shortcut: Ctrl+Shift+P (or Cmd+Shift+P on Mac)
const TOGGLE_SHORTCUT = { key: 'p', ctrlKey: true, shiftKey: true }

export function PerformanceStatsPanel({
  totalNodes,
  visibleNodes,
  viewportSyncEnabled,
  viewportStats,
  isViewportLoading,
  renderQueueLength = 0,
  onToggleViewportSync,
  onClose,
}: PerformanceStatsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isVisible, setIsVisible] = useState(false) // Hidden by default
  const viewport = useViewport()
  const setViewportSyncEnabled = useSiteBuilderStore(state => state.setViewportSyncEnabled)

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrlOrCmd = e.ctrlKey || e.metaKey
    if (
      e.key.toLowerCase() === TOGGLE_SHORTCUT.key &&
      ctrlOrCmd === TOGGLE_SHORTCUT.ctrlKey &&
      e.shiftKey === TOGGLE_SHORTCUT.shiftKey
    ) {
      e.preventDefault()
      setIsVisible(prev => !prev)
    }
  }, [])

  // Register keyboard shortcut
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Only available in development or when there are many nodes
  const shouldBeAvailable = process.env.NODE_ENV !== 'production' || totalNodes > 50

  if (!shouldBeAvailable || !isVisible) {
    return null
  }

  const handleToggleViewportSync = () => {
    const newValue = !viewportSyncEnabled
    setViewportSyncEnabled(newValue)
    onToggleViewportSync?.(newValue)
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  // Shortcut label for display
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
  const shortcutLabel = isMac ? '⌘⇧P' : 'Ctrl+Shift+P'

  return (
    <div className="absolute top-20 right-4 z-50">
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-300">Performance</span>
            <span className="text-[10px] text-gray-500 font-mono">{shortcutLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title={`Close (${shortcutLabel})`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-3 text-xs space-y-3">
            {/* Node Stats */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Eye className="w-3 h-3" />
                <span className="font-medium">Nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Visible</span>
                <span className="text-white font-mono">{visibleNodes}/{totalNodes}</span>
              </div>
              {renderQueueLength > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Rendering</span>
                  <span className="text-yellow-400 font-mono">{renderQueueLength}</span>
                </div>
              )}
            </div>

            {/* Viewport Sync */}
            {totalNodes > 50 && (
              <>
                <div className="border-t border-gray-700/50 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Zap className="w-3 h-3" />
                      <span className="font-medium">Viewport Sync</span>
                    </div>
                    <button
                      onClick={handleToggleViewportSync}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        viewportSyncEnabled
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      )}
                    >
                      {viewportSyncEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {viewportSyncEnabled && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Regions</span>
                        <span className="text-white font-mono">{viewportStats.loadedRegions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Detail loaded</span>
                        <span className="text-white font-mono">{viewportStats.totalLoaded}</span>
                      </div>
                      {isViewportLoading && (
                        <div className="flex items-center gap-1.5 text-blue-400">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                          <span>Loading...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Viewport Info (dev only) */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="border-t border-gray-700/50 pt-3 space-y-1">
                <div className="text-gray-500 text-[10px]">
                  Zoom: {(viewport.zoom * 100).toFixed(0)}%
                </div>
                <div className="text-gray-500 text-[10px]">
                  Pos: {Math.round(-viewport.x)}, {Math.round(-viewport.y)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
