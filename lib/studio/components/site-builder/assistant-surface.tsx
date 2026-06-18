'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { JSONValue, UIMessage as Message } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, CornerDownLeft, Loader2, Sparkles, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SaveStatusBadge } from '@/lib/studio/components/site-builder/save-status-indicator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ChatPersistence } from '@/components/chat/chat-persistence'
import { BUILDER_ASSISTANT_PANEL_ID, getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session'
import { ImportStatusCard } from '@/lib/studio/components/site-builder/import-status-card'
import { useImportProgressWithSSE } from '@/lib/studio/hooks/use-import-progress-hybrid'
import { useAssistantEventSync } from '@/lib/studio/hooks/use-assistant-event-sync'
import type { AIMessage } from '@/types/ai-context'

/**
 * Extract text content from a UIMessage, handling both old (content string)
 * and new (parts array) AI SDK message formats.
 */
const getMessageTextContent = (message: Message): string => {
  // Handle new AI SDK v5 format with parts array
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } =>
        part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part
      )
      .map(part => part.text)
      .join('')
  }
  // Fallback to old content string format for backwards compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMsg = message as any
  if (typeof anyMsg.content === 'string') {
    return anyMsg.content
  }
  return ''
}

/**
 * Tool invocation part structure from AI SDK v5
 * In v5, tool parts have type like 'tool-list-content-items' (prefixed with 'tool-')
 * and include state, input, output properties
 */
interface ToolInvocationPart {
  type: string // 'tool-{toolName}'
  toolCallId: string
  state: 'input-streaming' | 'streaming' | 'complete' | 'output-error'
  input: unknown
  output?: unknown
  errorText?: string
}

/**
 * Check if a part is a tool invocation (type starts with 'tool-')
 */
const isToolInvocationPart = (part: unknown): part is ToolInvocationPart => {
  if (!part || typeof part !== 'object') return false
  const p = part as Record<string, unknown>
  return typeof p.type === 'string' && p.type.startsWith('tool-') && 'toolCallId' in p && 'state' in p
}

/**
 * Extract tool invocation parts from a UIMessage.
 * Returns array of tool invocations for displaying what the assistant is doing.
 */
const getMessageToolCalls = (message: Message): ToolInvocationPart[] => {
  if (!('parts' in message) || !Array.isArray(message.parts)) {
    return []
  }
  // Cast to any and filter, then assert as ToolInvocationPart[] to satisfy TypeScript
  // The isToolInvocationPart type guard ensures runtime safety
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (message.parts as any[]).filter(isToolInvocationPart) as ToolInvocationPart[]
}

/**
 * Extract tool name from tool invocation type (e.g., 'tool-list-content-items' -> 'list-content-items')
 */
const getToolNameFromType = (type: string): string => {
  return type.replace(/^tool-/, '')
}

/**
 * Format tool name for display (convert kebab-case to readable format)
 */
const formatToolName = (toolName: string): string => {
  return toolName
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Simple markdown to HTML converter for chat message display.
 * Handles common markdown syntax used in AI responses.
 */
const parseMarkdown = (markdown: string): string => {
  if (!markdown) return ''

  let html = markdown
    // Escape HTML to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (must be before inline code)
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-white/10 rounded px-2 py-1 my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 rounded px-1 py-0.5 text-xs">$1</code>')
    // Headers (in chat we make them smaller)
    .replace(/^### (.*$)/gim, '<strong class="block mt-2 mb-1">$1</strong>')
    .replace(/^## (.*$)/gim, '<strong class="block mt-2 mb-1 text-base">$1</strong>')
    .replace(/^# (.*$)/gim, '<strong class="block mt-2 mb-1 text-base">$1</strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Blockquotes
    .replace(/^\&gt; (.*$)/gim, '<blockquote class="border-l-2 border-white/30 pl-2 my-1 italic text-white/70">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gim, '<hr class="border-white/20 my-2" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-catalyst-orange hover:underline">$1</a>')
    // Unordered lists - handle multiple consecutive lines
    .replace(/^[\*\-] (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    // Line breaks (but not inside pre tags)
    .replace(/\n/g, '<br />')

  // Clean up br tags inside pre elements
  html = html.replace(/<pre([^>]*)>([\s\S]*?)<\/pre>/g, (match, attrs, content) => {
    return `<pre${attrs}>${content.replace(/<br \/>/g, '\n')}</pre>`
  })

  return html
}

export type AssistantScope =
  | { type: 'site'; label: string }
  | { type: 'node'; nodeId: string; label: string }
  | { type: 'multi'; nodeIds: string[]; label: string }

interface AssistantSurfaceProps {
  websiteId?: string | null
  selectedNodes: Array<{ id: string; label?: string | null }>
  onFocusScope: (scope: AssistantScope) => void
  autoOpen?: boolean
  /** Import job ID from URL param - used for SSE progress when workflow-based import is active */
  importJobId?: string | null
}

interface ImportProgressMetadata {
  type: 'import-progress'
  jobId?: string
  url?: string
  stage?: string
  progress?: number
  processedCount?: number
  totalCount?: number
  currentUrl?: string | null
  status?: string
  message?: string
  description?: string
  updatedAt?: string
  queuePosition?: number | null
  estimatedStartSeconds?: number | null
  skippedSummary?: Array<{ url: string; reason?: string }>
}

const extractImportProgressMetadata = (message: Message): ImportProgressMetadata | null => {
  const metadata = (message as Message & { metadata?: unknown }).metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  if ((metadata as Record<string, unknown>).type !== 'import-progress') {
    return null
  }

  return metadata as ImportProgressMetadata
}

const TERMINAL_IMPORT_CARD_STATUSES = new Set(['failed', 'cancelled', 'recoverable_stuck', 'unknown'])

const toSkippedPageDetails = (skippedPages: string[]): Array<{ url: string; reason: string }> =>
  skippedPages.map((url) => ({ url, reason: 'Skipped' }))

// AI SDK v5: serializeScope is no longer needed since we don't send scope via annotations
// Keeping for potential future use with transport body customization

const isSameScope = (a: AssistantScope | null | undefined, b: AssistantScope | null | undefined) => {
  if (!a || !b) return false
  if (a.type !== b.type) return false
  if (a.type === 'site') return true
  if (a.type === 'node' && b.type === 'node') return a.nodeId === b.nodeId
  if (a.type === 'multi' && b.type === 'multi') {
    if (a.nodeIds.length !== b.nodeIds.length) return false
    return a.nodeIds.every((id, idx) => id === b.nodeIds[idx])
  }
  return false
}

const getScrollViewportElement = (root: HTMLDivElement | null) =>
  (root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? null

export function AssistantSurface({ websiteId, selectedNodes, onFocusScope, autoOpen, importJobId }: AssistantSurfaceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const processedMessageIds = useRef(new Set<string>())
  const pendingUserScope = useRef<AssistantScope | null>(null)
  const pendingAssistantScope = useRef<AssistantScope | null>(null)
  const lastSubmittedScope = useRef<AssistantScope | null>(null)
  const [messageScopes, setMessageScopes] = useState<Record<string, AssistantScope>>({})
  const hasAutoOpenedRef = useRef(false)
  const [openImportAccordions, setOpenImportAccordions] = useState<string[]>([])
  // AI SDK v5: input state must be managed manually
  const [input, setInput] = useState('')

  const currentScope = useMemo<AssistantScope>(() => {
    if (selectedNodes.length === 0) {
      return { type: 'site', label: 'Entire site' }
    }

    if (selectedNodes.length === 1) {
      const node = selectedNodes[0]
      return { type: 'node', nodeId: node.id, label: node.label?.trim() || 'Selected node' }
    }

    return {
      type: 'multi',
      nodeIds: selectedNodes.map((node) => node.id),
      label: `${selectedNodes.length} nodes`
    }
  }, [selectedNodes])

  useEffect(() => {
    // When switching websites clear local bookkeeping to avoid leaking scopes
    processedMessageIds.current.clear()
    setMessageScopes({})
  }, [websiteId])

  const sessionKey = getBuilderAssistantSessionId(websiteId ?? 'default')

  // Get the selected page ID (first selected node) for context
  // This helps the AI know which page is the "current" page for creating child pages
  const selectedPageId = selectedNodes.length > 0 ? selectedNodes[0].id : undefined
  const selectedPageLabel = selectedNodes.length > 0 ? selectedNodes[0].label : undefined

  // AI SDK v5: Memoize transport to avoid infinite re-renders
  // Include selectedPageId so AI can use it as parent when creating child pages
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: websiteId ? { websiteId, selectedPageId, selectedPageLabel } : undefined,
  }), [websiteId, selectedPageId, selectedPageLabel])

  // AI SDK v5: useChat API changed significantly
  // - input/setInput/handleInputChange removed (manage manually above)
  // - handleSubmit replaced with sendMessage
  // - isLoading replaced with status checks
  // - api option moved to transport
  const {
    messages,
    sendMessage,
    setMessages,
    error,
    status
  } = useChat({
    transport,
    id: sessionKey,
    onError: (error) => {
      if (process.env.NODE_ENV === 'development') {
      console.error('[useChat] onError:', error)
      }
    },
    onFinish: ({ message }) => {
      if (process.env.NODE_ENV === 'development') {
      console.log('[useChat] onFinish:', { role: message.role, contentLength: getMessageTextContent(message).length })
      }
    }
  })

  // AI SDK v5: isLoading is replaced by status checks
  const isLoading = status === 'streaming' || status === 'submitted'

  // Sync AI tool events with the site-builder canvas
  // This extracts _events from tool results and publishes them to the event bus,
  // which triggers canvas updates (component refreshes, structure reloads, etc.)
  useAssistantEventSync({
    websiteId: websiteId ?? undefined,
    messages,
    debug: process.env.NODE_ENV === 'development',
  })

  // Debug: Log messages state changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    console.log('[useChat] messages state:', messages.map(m => ({
      id: m.id,
      role: m.role,
      contentPreview: getMessageTextContent(m).substring(0, 50),
      parts: 'parts' in m ? (m.parts as unknown[])?.length : 'N/A'
    })))
    }
    if (process.env.NODE_ENV === 'development') {
    console.log('[useChat] status:', status, 'error:', error?.message)
    }
  }, [messages, status, error])

  // AI SDK v5: annotations no longer exist on messages
  // Store scope data in local messageScopes state instead
  const annotateMessage = useCallback((messageId: string, scope: AssistantScope) => {
    setMessageScopes((prev) => {
      const existingScope = prev[messageId]
      if (isSameScope(existingScope, scope)) {
        return prev
      }
      return { ...prev, [messageId]: scope }
    })
  }, [])

  // AI SDK v5: annotations removed from messages
  // Process new messages and assign scopes from local state
  // Note: messageScopes removed from deps to prevent infinite loop - we use processedMessageIds ref instead
  useEffect(() => {
    if (messages.length === 0) {
      processedMessageIds.current.clear()
      setMessageScopes({})
      return
    }

    const updates: Record<string, AssistantScope> = {}

    for (const message of messages) {
      if (processedMessageIds.current.has(message.id)) continue

      processedMessageIds.current.add(message.id)

      if (message.role === 'user') {
        const scope = pendingUserScope.current ?? currentScope
        pendingUserScope.current = null
        if (scope) {
          updates[message.id] = scope
          lastSubmittedScope.current = scope
          pendingAssistantScope.current = scope
        }
      } else if (message.role === 'assistant') {
        const scope = pendingAssistantScope.current ?? lastSubmittedScope.current ?? currentScope
        pendingAssistantScope.current = null
        if (scope) {
          updates[message.id] = scope
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setMessageScopes((prev) => ({ ...prev, ...updates }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentScope])

  const focusScope = useCallback((scope: AssistantScope) => {
    onFocusScope(scope)
    setIsOpen(false)
  }, [onFocusScope])

  // AI SDK v5: handleSubmit replaced with sendMessage
  const submitMessage = useCallback(() => {
    if (!input.trim()) {
      return
    }

    const scope = currentScope
    pendingUserScope.current = scope
    pendingAssistantScope.current = scope
    lastSubmittedScope.current = scope

    // AI SDK v5: sendMessage takes { text: string } format
    sendMessage({ text: input.trim() })
    setInput('')
  }, [currentScope, sendMessage, input])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!input.trim()) {
        return
      }
      submitMessage()
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  const messageCount = messages.length
  const latestMessageRole = messageCount > 0 ? messages[messageCount - 1]?.role ?? null : null

  useEffect(() => {
    if (messageCount === 0) return
    const scrollElement = getScrollViewportElement(scrollAreaRef.current)
    if (!scrollElement) return

    const isNearBottom = scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight - 100
    if (!isNearBottom && latestMessageRole !== 'user') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      scrollElement.scrollTop = scrollElement.scrollHeight
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [messageCount, latestMessageRole])

  useEffect(() => {
    if (!isOpen || messageCount === 0) return
    const scrollElement = getScrollViewportElement(scrollAreaRef.current)
    if (!scrollElement) return

    const timeoutId = window.setTimeout(() => {
      scrollElement.scrollTop = scrollElement.scrollHeight
    }, 100)

    return () => window.clearTimeout(timeoutId)
  }, [isOpen, messageCount])

  const currentScopeLabel = currentScope.label
  useEffect(() => {
    if (autoOpen && !hasAutoOpenedRef.current) {
      setIsOpen(true)
      hasAutoOpenedRef.current = true
    }
  }, [autoOpen])

  const formatEta = useCallback((seconds?: number | null) => {
    if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
      return null
    }
    if (seconds < 60) {
      return '<1 minute'
    }
    const minutes = Math.ceil(seconds / 60)
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }, [])

  const formatClockTime = useCallback((value?: Date | null) => {
    if (!value) return ''
    try {
      return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [])

  // Convert chat messages to AIMessage format for the progress hook
  // AI SDK v5: createdAt no longer exists on messages, use current time as fallback
  const aiMessages = useMemo<AIMessage[]>(() => {
    return messages.map((msg, index) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: getMessageTextContent(msg),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timestamp: (msg as any).createdAt ? new Date((msg as any).createdAt) : new Date(Date.now() - (messages.length - index) * 1000),
      metadata: (msg as Message & { metadata?: unknown }).metadata as Record<string, unknown> | undefined,
    }))
  }, [messages])

  // Extract active import jobId from messages for SSE streaming
  // Priority: 1) importJobId prop (from URL, workflow-based imports), 2) chat messages metadata
  const activeJobId = useMemo(() => {
    // If importJobId prop is provided (workflow-based import), use it directly
    if (importJobId) {
      return importJobId
    }
    // Fallback: Search chat messages for legacy chat-based imports
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      const metadata = (msg as Message & { metadata?: unknown }).metadata as Record<string, unknown> | undefined
      if (metadata?.type === 'import-progress' && metadata?.jobId) {
        const status = (metadata.status as string ?? '').toLowerCase()
        // Only return jobId for active imports
        if (status === 'pending' || status === 'running' || status === 'processing' || status === 'queued') {
          return metadata.jobId as string
        }
      }
    }
    return null
  }, [messages, importJobId])

  // Use the new SSE-based progress hook with polling fallback
  const { progressState, filteredMessages } = useImportProgressWithSSE(aiMessages, activeJobId, websiteId, sessionKey)
  const shouldShowImportStatusCard =
    progressState.hasActiveImport ||
    (!!activeJobId && TERMINAL_IMPORT_CARD_STATUSES.has(progressState.status))

  const importGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        jobId?: string
        url?: string
        events: Array<{ id: string; timestamp: Date; metadata: ImportProgressMetadata; content?: string | null }>
      }
    >()

    messages.forEach((message, index) => {
      const importProgress = extractImportProgressMetadata(message)
      if (!importProgress) return
      const key = importProgress.jobId ?? `import-${index}`
      // AI SDK v5: createdAt no longer exists, use fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timestamp =
        (message as any).createdAt ? new Date((message as any).createdAt) : new Date(Date.now() + index)
      const entry =
        groups.get(key) ??
        {
          jobId: importProgress.jobId,
          url: importProgress.url,
          events: [],
        }
      entry.events.push({
        id: message.id,
        timestamp,
        metadata: importProgress,
        content: getMessageTextContent(message),
      })
      groups.set(key, entry)
    })

    return Array.from(groups.entries()).map(([key, group]) => {
      const events = [...group.events].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )
      const latest = events[events.length - 1]
      const latestMeta = latest?.metadata ?? {}
      return {
        key,
        jobId: group.jobId,
        url: group.url,
        events,
        latestMeta,
        latestTimestamp: latest?.timestamp ?? null,
        startedAt: events[0]?.timestamp ?? null,
      }
    })
  }, [messages])

  // Filter to only show COMPLETED/FAILED imports in the accordion (Issue #3 Fix)
  // Active imports (pending, running, queued, processing) are shown in ImportStatusCard
  const completedImportGroups = useMemo(() => {
    return importGroups.filter((group) => {
      const status = ((group.latestMeta as ImportProgressMetadata).status ?? '').toLowerCase()
      // Only show completed or failed imports in accordion
      return status === 'completed' || status === 'failed' || status === 'cancelled'
    })
  }, [importGroups])

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col items-end gap-3">
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label={isOpen ? `Hide assistant for ${currentScopeLabel}` : `Open assistant for ${currentScopeLabel}`}
              className={cn(
                'group relative h-14 w-14 rounded-full border border-white/10 bg-white/5 shadow-lg backdrop-blur transition-colors flex items-center justify-center text-catalyst-orange',
                isOpen && 'bg-catalyst-orange/20 border-catalyst-orange/40 text-white'
              )}
              onClick={() => setIsOpen((prev) => !prev)}
              title={isOpen ? `Hide assistant for ${currentScopeLabel}` : `Open assistant for ${currentScopeLabel}`}
            >
              <span className="absolute inset-0 pointer-events-none rounded-full border border-catalyst-orange/40 opacity-40 animate-[spin_8s_linear_infinite]" />
              <span className="absolute inset-1 pointer-events-none rounded-full border border-white/10 opacity-0 group-hover:opacity-60 transition-opacity" />
              <Sparkles className="h-6 w-6" />
              <SaveStatusBadge className="absolute top-1 right-1" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-black text-white border-white/10 max-w-[220px]">
            <div>
              <p className="font-medium">AI Canvas Assistant</p>
              <p className="text-[11px] mt-0.5 text-white/70">Edit pages, generate components, apply globals, or restructure – context-aware and fully working in the seeded demo. Click to open.</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen && (
        <div className="w-[380px] h-[520px] rounded-2xl bg-[#070707]/95 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
          <ChatPersistence
            messages={messages}
            setMessages={setMessages}
            sessionId={
              websiteId ? getBuilderAssistantSessionId(websiteId) : `${BUILDER_ASSISTANT_PANEL_ID}-default`
            }
            websiteIdOverride={websiteId ?? undefined}
          >
            <div className="flex h-full flex-col">
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-catalyst-orange/20 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-catalyst-orange" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Canvas assistant</p>
                    <p className="text-xs text-white/60">AI-powered editing • works out-of-the-box on demo</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white/70 hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close assistant</span>
                </Button>
              </header>

              <div className="border-b border-white/10 px-4 py-2 text-xs text-white/70 flex items-center gap-2">
                <Badge variant="outline" className="border-catalyst-orange/30 text-catalyst-orange bg-catalyst-orange/10">
                  {currentScopeLabel}
                </Badge>
                <span>
                  Replies target the current selection.
                </span>
              </div>

              {/* Quick start guidance for newcomers / demo users */}
              {messages.length === 0 && (
                <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-[11px] text-white/70">
                  <div className="font-medium text-white/80 mb-1">What to try first (demo ready):</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded bg-white/10 px-1.5 py-px">"Add a testimonials section to this page"</span>
                    <span className="rounded bg-white/10 px-1.5 py-px">"Create an About page"</span>
                    <span className="rounded bg-white/10 px-1.5 py-px">"Make the hero global"</span>
                    <span className="rounded bg-white/10 px-1.5 py-px">"List available components"</span>
                  </div>
                  <div className="mt-1 text-[10px] text-white/50">Full CMS + AI import power + component library available instantly.</div>
                </div>
              )}

              {/* Active Import Status Card - FIXED at top, always visible */}
              {shouldShowImportStatusCard && (
                <div className="px-4 py-3 border-b border-white/10 bg-black/60 backdrop-blur-sm">
                  <ImportStatusCard
                    stage={progressState.stage}
                    progress={progressState.progress}
                    stageProgress={progressState.stageProgress}
                    message={progressState.message}
                    description={progressState.description}
                    processedCount={progressState.processedCount}
                    totalCount={progressState.totalCount}
                    currentUrl={progressState.currentUrl}
                    startedAt={progressState.startedAt ?? undefined}
                    estimatedTimeRemaining={progressState.estimatedTimeRemaining}
                    status={progressState.status}
                    queuePosition={progressState.queuePosition}
                    estimatedStartSeconds={progressState.estimatedStartSeconds}
                    skippedPages={toSkippedPageDetails(progressState.skippedPages)}
                    errorCount={progressState.errorCount}
                    sticky={false}
                    className="border-catalyst-orange/20"
                    isGreenfield={progressState.isGreenfield}
                  />
                </div>
              )}

              <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-3">
                <TooltipProvider delayDuration={150}>
                <div className="space-y-4 pr-2 max-w-full break-words">
                  {messages.map((message, index) => {
                    // AI SDK v5: annotations no longer exist, use local messageScopes state
                    const scope = messageScopes[message.id]
                    const isUser = message.role === 'user'
                    // AI SDK v5: createdAt no longer exists, use fallback
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const timestamp = (message as any).createdAt ? new Date((message as any).createdAt) : null
                    const importProgress = extractImportProgressMetadata(message)
                    const messageKey = `${message.id}-${timestamp?.getTime() ?? index}`

                    // Skip rendering import progress messages inline - they're shown in ImportStatusCard
                    // But NEVER skip user messages - they should always be visible
                    if (importProgress && shouldShowImportStatusCard && !isUser) {
                      return null
                    }

                    // Show completed/failed import messages as a summary (only for non-user messages)
                    if (importProgress && !isUser) {
                      const status = (importProgress.status ?? importProgress.stage ?? 'Update').toString()
                      const progressValue =
                        typeof importProgress.progress === 'number'
                          ? Math.min(100, Math.max(0, Math.round(importProgress.progress)))
                          : null
                      const processedLabel =
                        typeof importProgress.processedCount === 'number' &&
                        typeof importProgress.totalCount === 'number'
                          ? `${importProgress.processedCount}/${importProgress.totalCount}`
                          : null
                      const queueLabel =
                        typeof importProgress.queuePosition === 'number' && importProgress.queuePosition > 0
                          ? `Queued • #${importProgress.queuePosition}`
                          : importProgress.status === 'queued'
                            ? 'Queued'
                            : null
                      const hasSkips = Array.isArray(importProgress.skippedSummary) && importProgress.skippedSummary.length > 0

                      return (
                        <div
                          key={messageKey}
                          className="flex w-full max-w-full justify-start"
                        >
                          <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 shadow-lg">
                            <div className="mb-2 flex items-center gap-2">
                              <Badge variant="outline" className="border-white/20 bg-white/5 text-[11px] text-white/80">
                                {importProgress.jobId ? `Import ${importProgress.jobId.slice(0, 6)}` : 'Import progress'}
                              </Badge>
                              {hasSkips && (
                                <Badge variant="outline" className="border-red-200/40 bg-red-500/10 text-[11px] text-red-100">
                                  {importProgress.skippedSummary!.length} skipped
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[11px]',
                                  status.toLowerCase() === 'completed'
                                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                    : status.toLowerCase() === 'failed'
                                      ? 'border-red-400/40 bg-red-500/10 text-red-100'
                                      : 'border-primary/30 bg-primary/15 text-primary-foreground'
                                )}
                              >
                                {status}
                              </Badge>
                              {queueLabel && (
                                <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-[11px] text-amber-100">
                                  {queueLabel}
                                </Badge>
                              )}
                              {progressValue !== null && (
                                <Badge variant="secondary" className="border-primary/30 bg-primary/20 text-primary text-[11px]">
                                  {progressValue}%
                                </Badge>
                              )}
                            </div>

                            <p className="whitespace-pre-wrap leading-relaxed break-words text-white/90">
                              {importProgress.message ?? (getMessageTextContent(message) || 'Import update')}
                            </p>

                            {importProgress.description && (
                              <p className="mt-2 text-xs text-white/70">
                                {importProgress.description}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
                              {processedLabel && <Badge variant="outline" className="border-white/15 bg-white/5 text-white/70">{processedLabel} processed</Badge>}
                              {importProgress.currentUrl && (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="border-white/15 bg-white/5 text-white/70 max-w-[160px] truncate">
                                      {importProgress.currentUrl}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs break-all bg-black text-white border-white/10">
                                    {importProgress.currentUrl}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>

                            {hasSkips && (
                              <Accordion type="single" collapsible className="mt-3 border-t border-white/10 pt-2">
                                <AccordionItem value="skipped">
                                  <AccordionTrigger className="text-sm text-white hover:text-white/80">
                                    Skipped URLs
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ul className="space-y-2">
                                      {importProgress.skippedSummary!.map((entry, idx) => (
                                        <li
                                          key={`${entry.url}-${idx}`}
                                          className="rounded-lg bg-white/5 px-3 py-2 text-[11px]"
                                        >
                                          <div className="break-words text-white/90">{entry.url}</div>
                                          {entry.reason && (
                                            <div className="mt-1 text-white/60">Reason: {entry.reason}</div>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            )}

                            {timestamp && (
                              <p className="mt-2 text-[11px] text-white/40">
                                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Get message content parts
                    const textContent = getMessageTextContent(message)
                    const toolInvocations = getMessageToolCalls(message)
                    const hasToolCalls = toolInvocations.length > 0
                    const hasText = textContent.trim().length > 0

                    return (
                      <div key={messageKey} className={cn('flex w-full max-w-full', isUser ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[280px] rounded-2xl px-4 py-3 text-sm shadow-lg break-words',
                          isUser ? 'bg-catalyst-orange text-white rounded-br-sm' : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/10 backdrop-blur')}
                        >
                          {/* Show text content if available */}
                          {hasText && (
                            isUser ? (
                              <p className="whitespace-pre-wrap leading-relaxed break-all">
                                {textContent}
                              </p>
                            ) : (
                              <div
                                className="leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: parseMarkdown(textContent) }}
                              />
                            )
                          )}

                          {/* Show tool calls for assistant messages (Issue #3 Fix) */}
                          {!isUser && hasToolCalls && (
                            <div className={cn('space-y-2', hasText && 'mt-3 pt-3 border-t border-white/10')}>
                              <div className="flex items-center gap-2 text-xs text-white/60">
                                <Wrench className="h-3 w-3" />
                                <span>Actions performed:</span>
                              </div>
                              {toolInvocations.map((toolInvocation) => {
                                const toolName = getToolNameFromType(toolInvocation.type)
                                const isComplete = toolInvocation.state === 'complete'
                                const isError = toolInvocation.state === 'output-error'
                                const isStreaming = toolInvocation.state === 'streaming' || toolInvocation.state === 'input-streaming'

                                return (
                                  <div
                                    key={toolInvocation.toolCallId}
                                    className="rounded-lg bg-white/5 px-3 py-2 border border-white/10"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[11px]',
                                          isComplete ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' :
                                          isError ? 'border-red-400/40 bg-red-400/10 text-red-200' :
                                          'border-catalyst-orange/40 bg-catalyst-orange/10 text-catalyst-orange'
                                        )}
                                      >
                                        {formatToolName(toolName)}
                                      </Badge>
                                      {isStreaming && (
                                        <Loader2 className="h-3 w-3 animate-spin text-catalyst-orange" />
                                      )}
                                    </div>
                                    {/* Show brief summary of input args if available */}
                                    {(() => {
                                      const inputObj = toolInvocation.input
                                      if (!inputObj || typeof inputObj !== 'object' || Object.keys(inputObj as object).length === 0) {
                                        return null
                                      }
                                      return (
                                        <p className="mt-1 text-[11px] text-white/50 truncate">
                                          {Object.entries(inputObj as Record<string, unknown>).slice(0, 2).map(([key, value]: [string, unknown]): string => {
                                            const displayValue: string = typeof value === 'string'
                                              ? (value.length > 30 ? value.slice(0, 30) + '...' : value)
                                              : String(JSON.stringify(value)).slice(0, 30)
                                            return `${key}: ${displayValue}`
                                          }).join(', ')}
                                        </p>
                                      )
                                    })()}
                                    {/* Show error message if failed */}
                                    {isError && toolInvocation.errorText && (
                                      <p className="mt-1 text-[11px] text-red-300 truncate">
                                        Error: {toolInvocation.errorText}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Show placeholder when no text and no tool calls (edge case) */}
                          {!hasText && !hasToolCalls && !isUser && (
                            <p className="text-white/50 italic">Processing...</p>
                          )}

                          {scope && message.role === 'assistant' && (
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <Badge variant="outline" className="border-white/20 text-white/70 bg-white/5">
                                {scope.label}
                              </Badge>
                              <Button
                                variant="link"
                                className="h-auto p-0 text-xs text-catalyst-orange hover:text-catalyst-orange/80"
                                onClick={() => focusScope(scope)}
                              >
                                View change
                              </Button>
                            </div>
                          )}

                          {timestamp && (
                            <p className="mt-2 text-[11px] text-white/40">
                              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Issue #3 Fix: Show accordion only for COMPLETED/FAILED imports
                      - Active imports (pending, running) are shown in ImportStatusCard
                      - Completed/failed imports are shown in this accordion
                      - Uses completedImportGroups which filters out active imports */}
                  {completedImportGroups.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/60">Past Imports</p>
                          <p className="text-sm font-semibold text-white">
                            {completedImportGroups.length === 1 ? '1 completed import' : `${completedImportGroups.length} completed imports`}
                          </p>
                        </div>
                      </div>
                      <Accordion
                        type="multiple"
                        value={openImportAccordions}
                        onValueChange={(value) => setOpenImportAccordions(value as string[])}
                        className="space-y-2"
                      >
                        {completedImportGroups.map((group) => {
                          const latest = group.latestMeta
                          const status = (latest.status ?? '').toLowerCase()
                          const isQueued = status === 'queued'
                          const isCompleted = status === 'completed'
                          const isFailed = status === 'failed'
                          const progressValue =
                            typeof latest.progress === 'number'
                              ? Math.min(100, Math.max(0, Math.round(latest.progress)))
                              : null
                          const processedLabel =
                            typeof latest.processedCount === 'number' &&
                            typeof latest.totalCount === 'number'
                              ? `${latest.processedCount}/${latest.totalCount}`
                              : null
                          const queueLabel =
                            typeof latest.queuePosition === 'number' && latest.queuePosition > 0
                              ? `Queued • #${latest.queuePosition}`
                              : isQueued
                                ? 'Queued'
                                : null
                          const etaLabel = formatEta(latest.estimatedStartSeconds)
                          const jobLabel =
                            typeof group.url === 'string'
                              ? group.url
                              : group.jobId
                                ? `Import ${group.jobId.slice(0, 6)}`
                                : 'Import job'

                          const statusBadgeClass = isCompleted
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                            : isFailed
                              ? 'border-red-400/40 bg-red-500/10 text-red-100'
                              : isQueued
                                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                                : 'border-primary/30 bg-primary/15 text-primary-foreground'

                          return (
                            <AccordionItem key={group.key} value={group.key} className="border-white/10">
                              <AccordionTrigger className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                                <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                                  <div className="flex items-center gap-2">
                                    <Tooltip delayDuration={150}>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="border-white/20 bg-white/5 text-[11px] text-white/80 max-w-[170px] truncate">
                                          {jobLabel}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs break-all bg-black text-white border-white/10">
                                        {jobLabel}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Badge variant="outline" className={cn('text-[11px]', statusBadgeClass)}>
                                      {isCompleted ? 'Completed' : isFailed ? 'Failed' : latest.stage ?? 'Processing'}
                                    </Badge>
                                  </div>
                                  <p className="truncate text-xs text-white/70">
                                    {latest.message ?? 'Import in progress'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {queueLabel && (
                                    <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-[11px] text-amber-100">
                                      {queueLabel}{etaLabel ? ` • ETA ${etaLabel}` : ''}
                                    </Badge>
                                  )}
                                  {progressValue !== null && (
                                    <Badge variant="secondary" className="border-primary/30 bg-primary/20 text-primary">
                                      {progressValue}%
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 rounded-lg bg-black/40 px-3 py-3">
                                <div className="space-y-1 text-xs text-white/70">
                                  {group.startedAt && (
                                    <p>Started at {formatClockTime(group.startedAt)}</p>
                                  )}
                                  {group.latestTimestamp && (
                                    <p>Updated at {formatClockTime(group.latestTimestamp)}</p>
                                  )}
                                  {processedLabel && <p>Processed {processedLabel}</p>}
                                  {latest.currentUrl && (
                                    <Tooltip delayDuration={150}>
                                      <TooltipTrigger asChild>
                                        <p className="truncate">Working on: {latest.currentUrl}</p>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs break-all bg-black text-white border-white/10">
                                        {latest.currentUrl}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-2">
                                  {group.events.map((event) => {
                                    const evtMeta = event.metadata
                                    const evtProgress =
                                      typeof evtMeta.progress === 'number'
                                        ? Math.min(100, Math.max(0, Math.round(evtMeta.progress)))
                                        : null
                                    const evtStatus = (evtMeta.status ?? evtMeta.stage ?? 'Update').toString()
                                    return (
                                      <div key={event.id} className="space-y-1 text-xs text-white/80">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-medium">{evtStatus}</span>
                                          <span className="text-[11px] text-white/50">
                                            {formatClockTime(event.timestamp)}
                                          </span>
                                        </div>
                                        <p className="text-white/80">{evtMeta.message ?? event.content ?? 'Progress update'}</p>
                                        {evtProgress !== null && (
                                          <div className="mt-1 h-1.5 rounded-full bg-white/10">
                                            <div
                                              className="h-full rounded-full bg-catalyst-orange transition-all"
                                              style={{ width: `${evtProgress}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </div>
                  )}

                  {isLoading && (
                    <div className="flex items-center gap-3 text-white/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs">Crafting an update...</span>
                    </div>
                  )}
                </div>
                </TooltipProvider>
              </ScrollArea>

              <div className="border-t border-white/10 bg-black/40 px-4 py-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!input.trim()) {
                      return
                    }
                    submitMessage()
                  }}
                  className="flex flex-col gap-2"
                >
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={websiteId ? 'Ask the assistant to modify this selection…' : 'Select a website to start chatting'}
                    disabled={!websiteId}
                    className="min-h-[96px] resize-none bg-white/5 text-white placeholder:text-white/40"
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-white/50">
                    <span>Shift + Enter for newline</span>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isLoading || !input.trim() || !websiteId}
                      className="gap-2 bg-catalyst-orange text-white hover:bg-catalyst-orange/90"
                    >
                      Send
                      <CornerDownLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </ChatPersistence>
        </div>
      )}
    </div>
  )
}
