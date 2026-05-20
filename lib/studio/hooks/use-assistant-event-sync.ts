/**
 * Assistant Event Sync Hook
 *
 * Bridges AI assistant tool results with the site-builder canvas by:
 * 1. Extracting _events from tool results in chat messages
 * 2. Publishing events to the assistant event bus
 * 3. Subscribing to events and triggering canvas updates
 *
 * This enables real-time synchronization between AI actions and the visual canvas.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { UIMessage } from 'ai';
import {
  useAssistantEventBus,
  type AssistantEventType,
  type ComponentEventPayload,
  type PageEventPayload,
} from '@/lib/studio/stores/assistant-event-bus';
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store';

/**
 * Event data structure attached to tool results by event-publisher.ts
 */
interface AIToolEventData {
  type: 'component' | 'page';
  eventType: AssistantEventType;
  websiteId: string;
  nodeId?: string;
  componentType?: string;
  pageId?: string;
  pageTitle?: string;
  properties?: Record<string, unknown>;
}

/**
 * Tool invocation part structure from AI SDK v5
 *
 * States: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
 * Type format: 'tool-${toolName}' (e.g., 'tool-createPage')
 */
interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input: unknown;
  output?: unknown & { _events?: AIToolEventData[] };
  errorText?: string;
}

/**
 * Check if a message part is a completed tool invocation
 * AI SDK v5 uses 'output-available' state when tool execution is complete
 */
function isCompletedToolPart(part: unknown): part is ToolInvocationPart {
  if (!part || typeof part !== 'object') return false;
  const p = part as Record<string, unknown>;
  return (
    typeof p.type === 'string' &&
    p.type.startsWith('tool-') &&
    p.state === 'output-available' &&
    'output' in p
  );
}

/**
 * Extract events from a tool result output
 */
function extractEventsFromOutput(output: unknown): AIToolEventData[] {
  if (!output || typeof output !== 'object') return [];
  const obj = output as Record<string, unknown>;
  if (Array.isArray(obj._events)) {
    return obj._events as AIToolEventData[];
  }
  return [];
}

/**
 * Hook options
 */
interface UseAssistantEventSyncOptions {
  /** The current website ID for filtering events */
  websiteId?: string | null;
  /** Chat messages to extract events from */
  messages: UIMessage[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook for synchronizing AI assistant events with site-builder canvas
 *
 * This hook performs two main functions:
 * 1. Extracts _events from completed tool results and publishes them to the event bus
 * 2. Subscribes to the event bus and triggers appropriate canvas updates
 *
 * @example
 * ```tsx
 * function AssistantSurface({ websiteId }) {
 *   const { messages } = useChat();
 *   useAssistantEventSync({ websiteId, messages });
 *   // ...
 * }
 * ```
 */
export function useAssistantEventSync({
  websiteId,
  messages,
  debug = false,
}: UseAssistantEventSyncOptions) {
  const publish = useAssistantEventBus((state) => state.publish);
  const subscribe = useAssistantEventBus((state) => state.subscribe);
  const unsubscribe = useAssistantEventBus((state) => state.unsubscribe);

  // Track which tool calls we've already processed to avoid duplicates
  const processedToolCalls = useRef(new Set<string>());

  // Store actions for canvas updates
  const loadStructure = useSiteBuilderStore((state) => state.loadStructure);
  const updateComponentInNode = useSiteBuilderStore((state) => state.updateComponentInNode);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useAssistantEventSync]', ...args);
      }
    },
    [debug]
  );

  // Effect 1: Extract events from messages and publish to event bus
  useEffect(() => {
    if (!websiteId) return;

    for (const message of messages) {
      // Only process assistant messages with parts
      if (message.role !== 'assistant') continue;
      if (!('parts' in message) || !Array.isArray(message.parts)) continue;

      for (const part of message.parts as unknown[]) {
        if (!isCompletedToolPart(part)) continue;

        // Skip if we've already processed this tool call
        if (processedToolCalls.current.has(part.toolCallId)) continue;
        processedToolCalls.current.add(part.toolCallId);

        // Extract events from the tool output
        const events = extractEventsFromOutput(part.output);
        if (events.length === 0) continue;

        log('Extracted events from tool', part.type, ':', events.length);

        // Publish each event to the event bus
        for (const eventData of events) {
          // Skip events for different websites
          if (eventData.websiteId !== websiteId) continue;

          if (eventData.type === 'component') {
            publish(eventData.eventType, {
              source: 'ai',
              websiteId: eventData.websiteId,
              nodeId: eventData.nodeId || '',
              componentType: eventData.componentType || '',
              details: {
                pageId: eventData.pageId,
                pageTitle: eventData.pageTitle,
                properties: eventData.properties,
              },
            } as Omit<ComponentEventPayload, 'timestamp'>);
          } else if (eventData.type === 'page') {
            publish(eventData.eventType, {
              source: 'ai',
              websiteId: eventData.websiteId,
              pageId: eventData.pageId || '',
              details: {
                pageTitle: eventData.pageTitle,
              },
            } as Omit<PageEventPayload, 'timestamp'>);
          }

          log('Published event:', eventData.eventType);
        }
      }
    }
  }, [messages, websiteId, publish, log]);

  // Effect 2: Subscribe to event bus and trigger canvas updates
  useEffect(() => {
    if (!websiteId) return;

    const subscriptionId = subscribe('component:updated', (event) => {
      log('Received component:updated event:', event);

      // For component updates, we need to refresh the affected node
      const payload = event.payload as ComponentEventPayload;
      if (payload.websiteId !== websiteId) return;

      // The nodeId in our events is actually the component instanceId
      // We need to find the page and update the component within it
      const details = payload.details as {
        pageId?: string;
        properties?: Record<string, unknown>;
      };

      if (details.pageId && payload.nodeId && details.properties) {
        // Update the specific component in the store
        // Note: nodeId here is the page node, componentId is the component instance
        log('Updating component in node:', details.pageId, payload.nodeId);
        updateComponentInNode(details.pageId, payload.nodeId, details.properties);
      }
    });

    const pageAddedSubId = subscribe('page:added', (event) => {
      log('Received page:added event:', event);
      const payload = event.payload as PageEventPayload;
      if (payload.websiteId !== websiteId) return;

      // Reload the entire structure to include the new page
      log('Reloading structure for new page');
      loadStructure(websiteId);
    });

    const pageDeletedSubId = subscribe('page:deleted', (event) => {
      log('Received page:deleted event:', event);
      const payload = event.payload as PageEventPayload;
      if (payload.websiteId !== websiteId) return;

      // Reload the entire structure to reflect the deletion
      log('Reloading structure after page deletion');
      loadStructure(websiteId);
    });

    const componentAddedSubId = subscribe('component:added', (event) => {
      log('Received component:added event:', event);
      const payload = event.payload as ComponentEventPayload;
      if (payload.websiteId !== websiteId) return;

      // For new components, reload the structure to fetch the updated page content
      const details = payload.details as { pageId?: string };
      if (details.pageId) {
        log('Reloading structure for new component');
        loadStructure(websiteId);
      }
    });

    const componentDeletedSubId = subscribe('component:deleted', (event) => {
      log('Received component:deleted event:', event);
      const payload = event.payload as ComponentEventPayload;
      if (payload.websiteId !== websiteId) return;

      // For deleted components, reload the structure
      log('Reloading structure after component deletion');
      loadStructure(websiteId);
    });

    return () => {
      unsubscribe(subscriptionId);
      unsubscribe(pageAddedSubId);
      unsubscribe(pageDeletedSubId);
      unsubscribe(componentAddedSubId);
      unsubscribe(componentDeletedSubId);
    };
  }, [websiteId, subscribe, unsubscribe, loadStructure, updateComponentInNode, log]);

  // Clear processed tool calls when websiteId changes
  useEffect(() => {
    processedToolCalls.current.clear();
  }, [websiteId]);
}

/**
 * Hook to get recent events for debugging/display purposes
 */
export function useRecentAssistantEvents(limit = 10) {
  const recentEvents = useAssistantEventBus((state) => state.recentEvents);
  return recentEvents.slice(-limit);
}
