/**
 * AI Undo Integration
 *
 * Provides integration between AI tool operations and the site-builder's
 * undo manager. This enables users to undo AI-made changes using the
 * standard undo/redo controls.
 *
 * Architecture:
 * - AI tools operate on the database directly (pages, components)
 * - After AI operations, the canvas reloads structure
 * - The undo manager tracks sitemap state (nodes/edges)
 * - This integration ensures AI changes are captured in undo history
 */

import type { SitemapNode, SitemapEdge } from '@/lib/studio/components/site-builder/types';

/**
 * AI operation types for undo tracking
 */
export type AIOperationType =
  | 'page:create'
  | 'page:update'
  | 'page:delete'
  | 'component:add'
  | 'component:update'
  | 'component:delete'
  | 'batch:update'
  | 'batch:add'
  | 'batch:delete';

/**
 * AI operation record for undo history
 */
export interface AIOperationRecord {
  id: string;
  type: AIOperationType;
  timestamp: Date;
  description: string;
  toolCallId?: string;
  messageId?: string;
  /** Affected resource IDs */
  resourceIds: string[];
  /** Snapshot before operation (for potential reversal) */
  beforeSnapshot?: {
    nodes: SitemapNode[];
    edges: SitemapEdge[];
  };
}

/**
 * AI undo state stored in metadata
 */
export interface AIUndoState {
  operations: AIOperationRecord[];
  lastSnapshotId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate unique operation ID
 */
function generateOperationId(): string {
  return `ai-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an AI operation record
 */
export function createAIOperationRecord(
  type: AIOperationType,
  description: string,
  resourceIds: string[],
  options?: {
    toolCallId?: string;
    messageId?: string;
    beforeSnapshot?: AIOperationRecord['beforeSnapshot'];
  }
): AIOperationRecord {
  return {
    id: generateOperationId(),
    type,
    timestamp: new Date(),
    description,
    resourceIds,
    toolCallId: options?.toolCallId,
    messageId: options?.messageId,
    beforeSnapshot: options?.beforeSnapshot,
  };
}

/**
 * Add an operation to the undo state
 */
export function addAIOperation(
  state: AIUndoState | undefined,
  operation: AIOperationRecord
): AIUndoState {
  const now = new Date().toISOString();

  if (!state) {
    return {
      operations: [operation],
      lastSnapshotId: operation.beforeSnapshot ? operation.id : undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Limit history size
  const maxOperations = 30;
  const operations = [...state.operations, operation].slice(-maxOperations);

  return {
    ...state,
    operations,
    lastSnapshotId: operation.beforeSnapshot ? operation.id : state.lastSnapshotId,
    updatedAt: now,
  };
}

/**
 * Get the most recent AI operations
 */
export function getRecentAIOperations(
  state: AIUndoState | undefined,
  count = 10
): AIOperationRecord[] {
  if (!state) return [];
  return state.operations.slice(-count);
}

/**
 * Find an operation by ID
 */
export function findAIOperation(
  state: AIUndoState | undefined,
  operationId: string
): AIOperationRecord | undefined {
  if (!state) return undefined;
  return state.operations.find(op => op.id === operationId);
}

/**
 * Get operations for a specific message
 */
export function getOperationsForMessage(
  state: AIUndoState | undefined,
  messageId: string
): AIOperationRecord[] {
  if (!state) return [];
  return state.operations.filter(op => op.messageId === messageId);
}

/**
 * Format operation for display
 */
export function formatOperationDescription(operation: AIOperationRecord): string {
  const time = new Date(operation.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const actionMap: Record<AIOperationType, string> = {
    'page:create': 'Created page',
    'page:update': 'Updated page',
    'page:delete': 'Deleted page',
    'component:add': 'Added component',
    'component:update': 'Updated component',
    'component:delete': 'Deleted component',
    'batch:update': 'Batch updated',
    'batch:add': 'Batch added',
    'batch:delete': 'Batch deleted',
  };

  const action = actionMap[operation.type] || operation.type;
  return `[${time}] AI: ${action} - ${operation.description}`;
}

/**
 * Group operations by message for batch undo
 */
export function groupOperationsByMessage(
  state: AIUndoState | undefined
): Map<string, AIOperationRecord[]> {
  const groups = new Map<string, AIOperationRecord[]>();

  if (!state) return groups;

  for (const op of state.operations) {
    const key = op.messageId || 'ungrouped';
    const existing = groups.get(key) || [];
    groups.set(key, [...existing, op]);
  }

  return groups;
}

/**
 * Check if there are AI operations that can be undone
 */
export function hasUndoableAIOperations(state: AIUndoState | undefined): boolean {
  if (!state) return false;
  return state.operations.some(op => op.beforeSnapshot !== undefined);
}

/**
 * Get summary of AI operations for context
 */
export function getAIOperationsSummary(state: AIUndoState | undefined): string {
  if (!state || state.operations.length === 0) {
    return 'No AI operations in this session.';
  }

  const counts: Record<string, number> = {};
  for (const op of state.operations) {
    const key = op.type.split(':')[0]; // page, component, batch
    counts[key] = (counts[key] || 0) + 1;
  }

  const parts: string[] = [];
  if (counts.page) parts.push(`${counts.page} page operation(s)`);
  if (counts.component) parts.push(`${counts.component} component operation(s)`);
  if (counts.batch) parts.push(`${counts.batch} batch operation(s)`);

  return `AI operations this session: ${parts.join(', ')}`;
}

/**
 * Clear AI undo state
 */
export function clearAIUndoState(): AIUndoState {
  return {
    operations: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper functions to create operation records from tool results
 */
export const operationHelpers = {
  pageCreated: (
    pageId: string,
    pageName: string,
    messageId?: string,
    toolCallId?: string,
    beforeSnapshot?: AIOperationRecord['beforeSnapshot']
  ): AIOperationRecord =>
    createAIOperationRecord(
      'page:create',
      `Created "${pageName}"`,
      [pageId],
      { messageId, toolCallId, beforeSnapshot }
    ),

  pageUpdated: (
    pageId: string,
    pageName: string,
    messageId?: string,
    toolCallId?: string
  ): AIOperationRecord =>
    createAIOperationRecord(
      'page:update',
      `Updated "${pageName}"`,
      [pageId],
      { messageId, toolCallId }
    ),

  pageDeleted: (
    pageId: string,
    pageName: string,
    messageId?: string,
    toolCallId?: string,
    beforeSnapshot?: AIOperationRecord['beforeSnapshot']
  ): AIOperationRecord =>
    createAIOperationRecord(
      'page:delete',
      `Deleted "${pageName}"`,
      [pageId],
      { messageId, toolCallId, beforeSnapshot }
    ),

  componentAdded: (
    componentIds: string[],
    pageId: string,
    messageId?: string,
    toolCallId?: string
  ): AIOperationRecord =>
    createAIOperationRecord(
      'component:add',
      `Added ${componentIds.length} component(s)`,
      componentIds,
      { messageId, toolCallId }
    ),

  componentUpdated: (
    componentIds: string[],
    properties: string[],
    messageId?: string,
    toolCallId?: string
  ): AIOperationRecord =>
    createAIOperationRecord(
      'component:update',
      `Updated ${componentIds.length} component(s): ${properties.join(', ')}`,
      componentIds,
      { messageId, toolCallId }
    ),

  componentDeleted: (
    componentIds: string[],
    messageId?: string,
    toolCallId?: string,
    beforeSnapshot?: AIOperationRecord['beforeSnapshot']
  ): AIOperationRecord =>
    createAIOperationRecord(
      'component:delete',
      `Deleted ${componentIds.length} component(s)`,
      componentIds,
      { messageId, toolCallId, beforeSnapshot }
    ),

  batchOperation: (
    type: 'batch:update' | 'batch:add' | 'batch:delete',
    count: number,
    resourceIds: string[],
    messageId?: string,
    toolCallId?: string
  ): AIOperationRecord =>
    createAIOperationRecord(
      type,
      `Batch ${type.split(':')[1]} ${count} item(s)`,
      resourceIds,
      { messageId, toolCallId }
    ),
};
