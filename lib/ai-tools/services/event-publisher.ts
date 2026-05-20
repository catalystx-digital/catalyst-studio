/**
 * Server-side Event Publisher for AI Tools
 *
 * Provides a mechanism for AI tools to publish events that can be consumed
 * by the client-side event bus. Events are stored in the tool result and
 * the client-side chat handler processes them to publish to the event bus.
 *
 * Architecture:
 * 1. AI Tool executes and calls publishEvent()
 * 2. Events are attached to the tool result
 * 3. Client-side chat handler extracts events from tool results
 * 4. Events are published to useAssistantEventBus
 */

/**
 * Event types for AI assistant communication
 */
export type AIEventType =
  | 'component:added'
  | 'component:updated'
  | 'component:deleted'
  | 'page:added'
  | 'page:updated'
  | 'page:deleted';

/**
 * Component event data
 */
export interface ComponentEventData {
  type: 'component';
  eventType: AIEventType;
  websiteId: string;
  nodeId: string;
  componentType: string;
  pageId?: string;
  pageTitle?: string;
  properties?: Record<string, unknown>;
}

/**
 * Page event data
 */
export interface PageEventData {
  type: 'page';
  eventType: AIEventType;
  websiteId: string;
  pageId: string;
  title?: string;
  slug?: string;
  url?: string;
}

/**
 * Union type for all events
 */
export type AIToolEvent = ComponentEventData | PageEventData;

/**
 * Tool result with events attached
 */
export interface ToolResultWithEvents<T = unknown> {
  /** Original tool result */
  result: T;
  /** Events to be published to the client */
  _events?: AIToolEvent[];
}

/**
 * Create a component added event
 */
export function createComponentAddedEvent(
  websiteId: string,
  nodeId: string,
  componentType: string,
  pageId?: string,
  pageTitle?: string
): ComponentEventData {
  return {
    type: 'component',
    eventType: 'component:added',
    websiteId,
    nodeId,
    componentType,
    pageId,
    pageTitle,
  };
}

/**
 * Create a component updated event
 */
export function createComponentUpdatedEvent(
  websiteId: string,
  nodeId: string,
  componentType: string,
  pageId?: string,
  pageTitle?: string,
  properties?: Record<string, unknown>
): ComponentEventData {
  return {
    type: 'component',
    eventType: 'component:updated',
    websiteId,
    nodeId,
    componentType,
    pageId,
    pageTitle,
    properties,
  };
}

/**
 * Create a component deleted event
 */
export function createComponentDeletedEvent(
  websiteId: string,
  nodeId: string,
  componentType: string,
  pageId?: string,
  pageTitle?: string
): ComponentEventData {
  return {
    type: 'component',
    eventType: 'component:deleted',
    websiteId,
    nodeId,
    componentType,
    pageId,
    pageTitle,
  };
}

/**
 * Create a page added event
 */
export function createPageAddedEvent(
  websiteId: string,
  pageId: string,
  title?: string,
  slug?: string,
  url?: string
): PageEventData {
  return {
    type: 'page',
    eventType: 'page:added',
    websiteId,
    pageId,
    title,
    slug,
    url,
  };
}

/**
 * Create a page updated event
 */
export function createPageUpdatedEvent(
  websiteId: string,
  pageId: string,
  title?: string
): PageEventData {
  return {
    type: 'page',
    eventType: 'page:updated',
    websiteId,
    pageId,
    title,
  };
}

/**
 * Create a page deleted event
 */
export function createPageDeletedEvent(
  websiteId: string,
  pageId: string,
  title?: string
): PageEventData {
  return {
    type: 'page',
    eventType: 'page:deleted',
    websiteId,
    pageId,
    title,
  };
}

/**
 * Wrap a tool result with events
 * The events will be extracted by the client-side handler
 */
export function withEvents<T>(result: T, events: AIToolEvent[]): T & { _events: AIToolEvent[] } {
  return {
    ...result,
    _events: events,
  };
}

/**
 * Extract events from a tool result
 */
export function extractEvents(result: unknown): AIToolEvent[] {
  if (result && typeof result === 'object' && '_events' in result) {
    return (result as ToolResultWithEvents)._events || [];
  }
  return [];
}
