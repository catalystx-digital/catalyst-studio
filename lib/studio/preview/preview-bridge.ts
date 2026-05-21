/**
 * Preview Bridge - Type-Safe postMessage Helpers
 * Story 11a Task 3: Live Preview Sandbox
 *
 * Provides type-safe helper functions for sending messages to preview iframe.
 * Eliminates manual postMessage construction and ensures type safety.
 */

interface PreviewMessage {
  type: 'UPDATE_CONTENT' | 'UPDATE_COMPONENT' | 'CHANGE_DEVICE' | 'NAVIGATE' | 'REFRESH'
  payload: {
    content?: string
    device?: 'desktop' | 'tablet' | 'mobile'
    page?: number
    styles?: string
    html?: string
    css?: string
    darkCss?: string
  }
  timestamp: number
}

/**
 * Send UPDATE_COMPONENT message to preview iframe
 * More efficient than UPDATE_CONTENT - injects HTML + CSS without full reload
 */
export function sendUpdateComponent(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  payload: {
    html?: string
    css?: string
    darkCss?: string
  }
): boolean {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[preview-bridge] Cannot send UPDATE_COMPONENT: iframe not loaded')
    return false
  }

  const message: PreviewMessage = {
    type: 'UPDATE_COMPONENT',
    payload,
    timestamp: Date.now()
  }

  iframeRef.current.contentWindow.postMessage(message, '*')
  return true
}

/**
 * Send UPDATE_CONTENT message to preview iframe
 * Full content update (backward compatible)
 */
export function sendUpdateContent(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  payload: {
    content?: string
    styles?: string
  }
): boolean {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[preview-bridge] Cannot send UPDATE_CONTENT: iframe not loaded')
    return false
  }

  const message: PreviewMessage = {
    type: 'UPDATE_CONTENT',
    payload,
    timestamp: Date.now()
  }

  iframeRef.current.contentWindow.postMessage(message, '*')
  return true
}

/**
 * Send REFRESH message to preview iframe
 * Triggers full page reload
 */
export function sendRefresh(
  iframeRef: React.RefObject<HTMLIFrameElement>
): boolean {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[preview-bridge] Cannot send REFRESH: iframe not loaded')
    return false
  }

  const message: PreviewMessage = {
    type: 'REFRESH',
    payload: {},
    timestamp: Date.now()
  }

  iframeRef.current.contentWindow.postMessage(message, '*')
  return true
}

/**
 * Send NAVIGATE message to preview iframe
 */
export function sendNavigate(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  page: number
): boolean {
  if (!iframeRef.current?.contentWindow) {
    console.warn('[preview-bridge] Cannot send NAVIGATE: iframe not loaded')
    return false
  }

  const message: PreviewMessage = {
    type: 'NAVIGATE',
    payload: { page },
    timestamp: Date.now()
  }

  iframeRef.current.contentWindow.postMessage(message, '*')
  return true
}

/**
 * Get iframe ref from global context (fallback if ref not available)
 * Used by design system API route to access preview iframe
 */
export function getPreviewIframeRef(): HTMLIFrameElement | null {
  if (typeof window === 'undefined') return null

  const win = window as Window & { __previewIframeRef?: { current: HTMLIFrameElement | null } }
  return win.__previewIframeRef?.current || null
}
