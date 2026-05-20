'use client'

/**
 * Preview Context Provider
 * Story 1.4: Manages preview state and device switching
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import {
  PreviewState,
  Device,
  Page,
  PreviewSettings,
  INITIAL_PREVIEW_STATE,
  DEVICE_PRESETS,
  PreviewMessage,
  PreviewResponse
} from '@/lib/preview/types'

interface PreviewContextType {
  state: PreviewState
  // Device management
  switchDevice: (deviceKey: string) => void
  setCustomDevice: (device: Device) => void
  // Content management
  updateContent: (content: string, styles?: string) => void
  clearContent: () => void
  // Navigation
  navigateToPage: (pageIndex: number) => void
  addPage: (page: Page) => void
  removePage: (pageId: string) => void
  updatePage: (pageId: string, updates: Partial<Page>) => void
  // Settings
  updateSettings: (settings: Partial<PreviewSettings>) => void
  updateZoom: (zoom: number) => void
  // Preview actions
  refresh: () => void
  toggleDeviceFrame: () => void
  clearCache: () => void
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined)

export function usePreviewContext() {
  const context = useContext(PreviewContext)
  if (!context) {
    throw new Error('usePreviewContext must be used within PreviewProvider')
  }
  return context
}

interface PreviewProviderProps {
  children: React.ReactNode
}

export function PreviewProvider({ children }: PreviewProviderProps) {
  const [state, setState] = useState<PreviewState>(INITIAL_PREVIEW_STATE)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Integration with existing contexts from Stories 1.2 and 1.3
  // These contexts may not be available in all environments
  // Note: Hooks must be called unconditionally, so we'll handle missing providers differently

  // Send message to preview iframe - defined early to avoid dependency issues
  const sendMessageToPreview = useCallback((message: PreviewMessage) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*')
    }
  }, [])

  // Device switching with smooth transition
  const switchDevice = useCallback((deviceKey: string) => {
    const device = DEVICE_PRESETS[deviceKey]
    if (device) {
      setState(prev => ({
        ...prev,
        activeDevice: device,
        isLoading: true
      }))
      
      // Send device change message to iframe
      sendMessageToPreview({
        type: 'CHANGE_DEVICE',
        payload: { device: device.type },
        timestamp: Date.now()
      })

      // Clear loading state after transition
      setTimeout(() => {
        setState(prev => ({ ...prev, isLoading: false }))
      }, 300)
    }
  }, [sendMessageToPreview])

  // Set custom device configuration
  const setCustomDevice = useCallback((device: Device) => {
    setState(prev => ({
      ...prev,
      activeDevice: device,
      isLoading: true
    }))
    
    setTimeout(() => {
      setState(prev => ({ ...prev, isLoading: false }))
    }, 300)
  }, [])

  // Update content with debouncing for performance
  const updateContent = useCallback((content: string, styles?: string) => {
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Set loading state immediately
    setState(prev => ({ ...prev, isLoading: true }))

    // Debounce content updates (500ms)
    updateTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        content,
        styles, // Store styles in state
        lastUpdate: Date.now(),
        isLoading: false
      }))

      // Send content update to iframe if it's available
      if (iframeRef.current?.contentWindow) {
        sendMessageToPreview({
          type: 'UPDATE_CONTENT',
          payload: { content, styles },
          timestamp: Date.now()
        })
      } else {
        console.log('Preview: Iframe not ready, content will be shown on next load')
      }
    }, 500)
  }, [sendMessageToPreview])

  // Clear all content
  const clearContent = useCallback(() => {
    setState(prev => ({
      ...prev,
      content: '',
      pages: [],
      currentPage: 0,
      error: null
    }))
  }, [])

  // Navigate between pages
  const navigateToPage = useCallback((pageIndex: number) => {
    setState(prev => {
      if (pageIndex >= 0 && pageIndex < prev.pages.length) {
        const page = prev.pages[pageIndex]
        
        // Send navigation message to iframe
        sendMessageToPreview({
          type: 'NAVIGATE',
          payload: { page: pageIndex },
          timestamp: Date.now()
        })

        return {
          ...prev,
          currentPage: pageIndex,
          content: page.content
        }
      }
      return prev
    })
  }, [sendMessageToPreview])

  // Add new page
  const addPage = useCallback((page: Page) => {
    setState(prev => ({
      ...prev,
      pages: [...prev.pages, page]
    }))
  }, [])

  // Remove page
  const removePage = useCallback((pageId: string) => {
    setState(prev => {
      const filteredPages = prev.pages.filter(p => p.id !== pageId)
      const newCurrentPage = Math.min(prev.currentPage, filteredPages.length - 1)
      
      return {
        ...prev,
        pages: filteredPages,
        currentPage: Math.max(0, newCurrentPage)
      }
    })
  }, [])

  // Update existing page
  const updatePage = useCallback((pageId: string, updates: Partial<Page>) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(page =>
        page.id === pageId ? { ...page, ...updates } : page
      )
    }))
  }, [])

  // Update preview settings
  const updateSettings = useCallback((settings: Partial<PreviewSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings }
    }))
  }, [])

  // Set zoom level
  const updateZoom = useCallback((zoom: number) => {
    // Clamp zoom between 0.25 and 2
    const clampedZoom = Math.max(0.25, Math.min(2, zoom))
    setState(prev => ({
      ...prev,
      zoom: clampedZoom
    }))
  }, [])

  // Refresh preview content
  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    // Send refresh message to iframe
    sendMessageToPreview({
      type: 'REFRESH',
      payload: {},
      timestamp: Date.now()
    })

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdate: Date.now()
      }))
    }, 100)
  }, [sendMessageToPreview])

  // Toggle device frame visibility
  const toggleDeviceFrame = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        showDeviceFrame: !prev.settings.showDeviceFrame
      }
    }))
  }, [])

  // Clear preview cache
  const clearCache = useCallback(() => {
    setState(prev => ({
      ...prev,
      cachedContent: {},
      lastUpdate: Date.now()
    }))
    // Force refresh after clearing cache
    refresh()
  }, [refresh])

  // Handle messages from preview iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<PreviewResponse>) => {
      // Validate origin if needed
      if (event.data?.type) {
        switch (event.data.type) {
          case 'READY':
            setState(prev => ({ ...prev, isLoading: false }))
            break
          case 'ERROR':
            setState(prev => ({
              ...prev,
              error: event.data.payload?.error || 'Unknown error',
              isLoading: false
            }))
            break
          case 'LOADED':
            setState(prev => ({ ...prev, isLoading: false }))
            break
          case 'NAVIGATION':
            if (event.data.payload?.currentPage !== undefined) {
              setState(prev => ({ ...prev, currentPage: event.data.payload.currentPage! }))
            }
            break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auto-refresh functionality
  // TEMPORARILY DISABLED to debug style loss issue
  /*
  useEffect(() => {
    if (state.settings.autoRefresh && state.content) {
      const interval = setInterval(() => {
        refresh()
      }, state.settings.refreshInterval)

      return () => clearInterval(interval)
    }
  }, [state.settings.autoRefresh, state.settings.refreshInterval, state.content, refresh])
  */

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('preview-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...parsed }
        }))
      } catch (error) {
        console.error('Failed to load preview settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage on change
  useEffect(() => {
    localStorage.setItem('preview-settings', JSON.stringify(state.settings))
  }, [state.settings])

  const value: PreviewContextType = {
    state,
    switchDevice,
    setCustomDevice,
    updateContent,
    clearContent,
    navigateToPage,
    addPage,
    removePage,
    updatePage,
    updateSettings,
    updateZoom,
    refresh,
    toggleDeviceFrame,
    clearCache
  }

  // Watch for iframe ref from PreviewFrame component
  useEffect(() => {
    const checkIframeRef = () => {
      const win = window as Window & { __previewIframeRef?: { current: HTMLIFrameElement | null } }
      if (win.__previewIframeRef?.current) {
        iframeRef.current = win.__previewIframeRef.current
      }
    }
    
    // Check immediately and periodically
    checkIframeRef()
    const interval = setInterval(checkIframeRef, 100)
    
    return () => clearInterval(interval)
  }, [])

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
}

// Hook to check if preview feature is enabled
// Note: Preview feature is now permanently enabled (Epic 2 completion)
export function usePreviewFeature() {
  return true
}