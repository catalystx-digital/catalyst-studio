'use client'

/**
 * useAIContextSSE Hook
 *
 * Server-Sent Events (SSE) based hook for real-time AI context updates.
 * Receives new messages as they arrive instead of polling.
 *
 * Features:
 * - Establishes SSE connection for instant message updates
 * - Implements automatic reconnection with exponential backoff
 * - Tracks connection status for UI feedback
 * - Cleans up connection on unmount
 *
 * @see PRD: docs/prd-sse-real-time-upgrade.md Task 2.2
 * @module use-ai-context-sse
 */

import * as React from 'react'
import type { AIMessage } from '@/types/ai-context'
import { sseMetrics } from '@/lib/studio/utils/sse-metrics'
import { isSSESupported } from './use-import-progress-sse'

export interface AIContextSSEState {
  /** Current messages in the context */
  messages: AIMessage[]
  /** Metadata associated with the context */
  metadata: Record<string, unknown>
  /** Whether SSE connection is active */
  isConnected: boolean
  /** Error if connection failed */
  error: Error | null
  /** Last update timestamp */
  lastUpdatedAt: Date | null
}

const DEFAULT_STATE: AIContextSSEState = {
  messages: [],
  metadata: {},
  isConnected: false,
  error: null,
  lastUpdatedAt: null,
}

interface SSEContextData {
  sessionId: string
  messages: AIMessage[]
  metadata: Record<string, unknown>
  messageCount: number
  timestamp?: string
}

/**
 * Hook that uses SSE for real-time AI context updates.
 * Much more efficient than polling - only receives data when it changes.
 *
 * @param sessionId - The session ID to track
 * @param websiteId - The website ID (required for context lookup)
 * @param enabled - Whether SSE connection should be active
 */
export function useAIContextSSE(
  sessionId: string | null | undefined,
  websiteId: string | null | undefined,
  enabled: boolean = true
): AIContextSSEState {
  const [state, setState] = React.useState<AIContextSSEState>(DEFAULT_STATE)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = React.useRef(0)

  React.useEffect(() => {
    if (!sessionId || !websiteId || !enabled) {
      setState(DEFAULT_STATE)
      return
    }

    if (!isSSESupported()) {
      console.warn('[useAIContextSSE] EventSource not supported')
      return
    }

    const connect = () => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const url = `/api/ai-context/${encodeURIComponent(sessionId)}/stream?websiteId=${encodeURIComponent(websiteId)}`
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AI Context SSE] Connected')
        }
        reconnectAttemptsRef.current = 0
        sseMetrics.recordConnection()
        setState(prev => ({ ...prev, isConnected: true, error: null }))
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEContextData = JSON.parse(event.data)
          sseMetrics.recordMessage()

          setState(prev => ({
            ...prev,
            messages: data.messages ?? prev.messages,
            metadata: data.metadata ?? prev.metadata,
            lastUpdatedAt: data.timestamp ? new Date(data.timestamp) : new Date(),
          }))
        } catch (error) {
          console.error('[AI Context SSE] Parse error:', error)
          sseMetrics.recordError()
        }
      }

      eventSource.onerror = () => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AI Context SSE] Connection error')
        }
        sseMetrics.recordError()
        eventSource.close()
        eventSourceRef.current = null

        setState(prev => ({
          ...prev,
          isConnected: false,
          error: new Error('SSE connection failed')
        }))

        // Exponential backoff for reconnection
        const maxAttempts = 5
        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectAttemptsRef.current++
          sseMetrics.recordReconnection()
          if (process.env.NODE_ENV === 'development') {
            console.log(`[AI Context SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)
          }
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        } else {
          console.error('[AI Context SSE] Max reconnection attempts reached')
        }
      }
    }

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [sessionId, websiteId, enabled])

  return state
}

/**
 * Hybrid hook that prefers SSE but can fall back to provided messages.
 * Useful when you have initial messages from server-side rendering.
 *
 * @param initialMessages - Initial messages from server/cache
 * @param sessionId - The session ID to track
 * @param websiteId - The website ID
 * @param enabled - Whether SSE should be active
 */
export function useAIContextWithSSE(
  initialMessages: AIMessage[],
  sessionId: string | null | undefined,
  websiteId: string | null | undefined,
  enabled: boolean = true
): AIContextSSEState {
  const sseState = useAIContextSSE(sessionId, websiteId, enabled && isSSESupported())

  // Use SSE messages if connected and have messages, otherwise use initial
  const messages = React.useMemo(() => {
    if (sseState.isConnected && sseState.messages.length > 0) {
      return sseState.messages
    }
    return initialMessages
  }, [sseState.isConnected, sseState.messages, initialMessages])

  return {
    ...sseState,
    messages,
  }
}
