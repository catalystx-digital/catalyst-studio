import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Event types for AI assistant and site-builder canvas communication
 */
export type AssistantEventType =
  | 'component:added'
  | 'component:updated'
  | 'component:deleted'
  | 'page:added'
  | 'page:updated'
  | 'page:deleted';

/**
 * Event source attribution
 */
export type EventSource = 'ai' | 'user';

/**
 * Base event payload structure
 */
export interface BaseEventPayload {
  timestamp: Date;
  source: EventSource;
  websiteId: string;
  details: Record<string, unknown>;
}

/**
 * Component event payloads
 */
export interface ComponentEventPayload extends BaseEventPayload {
  nodeId: string;
  componentType: string;
}

/**
 * Page event payloads
 */
export interface PageEventPayload extends BaseEventPayload {
  pageId: string;
}

/**
 * Union type for all event payloads
 */
export type AssistantEventPayload = ComponentEventPayload | PageEventPayload;

/**
 * Typed event structure
 */
export interface AssistantEvent {
  id: string;
  type: AssistantEventType;
  payload: AssistantEventPayload;
}

/**
 * Subscription callback type
 */
export type EventCallback = (event: AssistantEvent) => void;

/**
 * Subscription record
 */
interface Subscription {
  id: string;
  eventType: AssistantEventType | 'all';
  callback: EventCallback;
}

/**
 * Assistant Event Bus State
 */
interface AssistantEventBusState {
  // State
  recentEvents: AssistantEvent[];
  subscriptions: Map<string, Subscription>;
  maxHistorySize: number;

  // Actions
  publish: (type: AssistantEventType, payload: Omit<AssistantEventPayload, 'timestamp'>) => void;
  subscribe: (eventType: AssistantEventType, callback: EventCallback) => string;
  subscribeAll: (callback: EventCallback) => string;
  unsubscribe: (subscriptionId: string) => void;
  clearHistory: () => void;
}

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Assistant Event Bus Store
 *
 * Provides a typed event bus for bidirectional communication between
 * AI assistant and site-builder canvas. Supports event publishing,
 * subscription, and maintains a history of recent events for debugging.
 */
export const useAssistantEventBus = create<AssistantEventBusState>()(
  immer((set, get) => ({
    // Initial state
    recentEvents: [],
    subscriptions: new Map(),
    maxHistorySize: 50,

    /**
     * Publish an event to all subscribers
     */
    publish: (type, payload) => {
      const event: AssistantEvent = {
        id: generateEventId(),
        type,
        payload: {
          ...payload,
          timestamp: new Date(),
        } as AssistantEventPayload,
      };

      set((state) => {
        // Add to recent events (FIFO queue with max size)
        state.recentEvents.push(event);
        if (state.recentEvents.length > state.maxHistorySize) {
          state.recentEvents.shift();
        }
      });

      // Notify subscribers (outside immer for performance)
      const subscriptions = get().subscriptions;
      subscriptions.forEach((sub) => {
        if (sub.eventType === 'all' || sub.eventType === type) {
          try {
            sub.callback(event);
          } catch (error) {
            console.error(`[AssistantEventBus] Error in subscription ${sub.id}:`, error);
          }
        }
      });
    },

    /**
     * Subscribe to a specific event type
     */
    subscribe: (eventType, callback) => {
      const subscriptionId = generateSubscriptionId();

      set((state) => {
        state.subscriptions.set(subscriptionId, {
          id: subscriptionId,
          eventType,
          callback,
        });
      });

      return subscriptionId;
    },

    /**
     * Subscribe to all events
     */
    subscribeAll: (callback) => {
      const subscriptionId = generateSubscriptionId();

      set((state) => {
        state.subscriptions.set(subscriptionId, {
          id: subscriptionId,
          eventType: 'all',
          callback,
        });
      });

      return subscriptionId;
    },

    /**
     * Unsubscribe from events
     */
    unsubscribe: (subscriptionId) => {
      set((state) => {
        state.subscriptions.delete(subscriptionId);
      });
    },

    /**
     * Clear event history (useful for testing or memory management)
     */
    clearHistory: () => {
      set((state) => {
        state.recentEvents = [];
      });
    },
  }))
);

/**
 * Helper to create component event payloads
 */
export function createComponentEventPayload(
  source: EventSource,
  websiteId: string,
  nodeId: string,
  componentType: string,
  details: Record<string, unknown> = {}
): Omit<ComponentEventPayload, 'timestamp'> {
  return {
    source,
    websiteId,
    nodeId,
    componentType,
    details,
  };
}

/**
 * Helper to create page event payloads
 */
export function createPageEventPayload(
  source: EventSource,
  websiteId: string,
  pageId: string,
  details: Record<string, unknown> = {}
): Omit<PageEventPayload, 'timestamp'> {
  return {
    source,
    websiteId,
    pageId,
    details,
  };
}
