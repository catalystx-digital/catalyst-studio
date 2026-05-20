/**
 * Change Tracker
 *
 * Tracks what changes the AI has made during a session.
 * Enables the AI to reference its previous actions and provides
 * context about the current state of the website.
 */

/**
 * Change types
 */
export type ChangeType =
  | 'page:created'
  | 'page:updated'
  | 'page:deleted'
  | 'component:added'
  | 'component:updated'
  | 'component:deleted'
  | 'content-type:created'
  | 'content-type:updated';

/**
 * Change record
 */
export interface ChangeRecord {
  id: string;
  type: ChangeType;
  target: {
    type: 'page' | 'component' | 'content-type';
    id: string;
    name?: string;
    parentId?: string;
  };
  details: Record<string, unknown>;
  timestamp: Date;
  messageId?: string;
  toolCallId?: string;
}

/**
 * Change summary for context
 */
export interface ChangeSummary {
  totalChanges: number;
  byType: Record<ChangeType, number>;
  recentChanges: ChangeRecord[];
  pagesCreated: string[];
  pagesUpdated: string[];
  pagesDeleted: string[];
  componentsModified: number;
}

/**
 * Change tracker state stored in metadata
 */
export interface ChangeTrackerState {
  changes: ChangeRecord[];
  startedAt: string;
  updatedAt: string;
}

/**
 * Generate unique change ID
 */
function generateChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new change record
 */
export function createChangeRecord(
  type: ChangeType,
  target: ChangeRecord['target'],
  details: Record<string, unknown> = {},
  messageId?: string,
  toolCallId?: string
): ChangeRecord {
  return {
    id: generateChangeId(),
    type,
    target,
    details,
    timestamp: new Date(),
    messageId,
    toolCallId,
  };
}

/**
 * Add a change to the tracker state
 */
export function addChange(
  state: ChangeTrackerState | undefined,
  change: ChangeRecord
): ChangeTrackerState {
  const now = new Date().toISOString();

  if (!state) {
    return {
      changes: [change],
      startedAt: now,
      updatedAt: now,
    };
  }

  return {
    ...state,
    changes: [...state.changes, change],
    updatedAt: now,
  };
}

/**
 * Get a summary of changes for context
 */
export function getChangeSummary(
  state: ChangeTrackerState | undefined,
  recentCount = 10
): ChangeSummary {
  if (!state || state.changes.length === 0) {
    return {
      totalChanges: 0,
      byType: {} as Record<ChangeType, number>,
      recentChanges: [],
      pagesCreated: [],
      pagesUpdated: [],
      pagesDeleted: [],
      componentsModified: 0,
    };
  }

  const byType: Record<string, number> = {};
  const pagesCreated: string[] = [];
  const pagesUpdated: string[] = [];
  const pagesDeleted: string[] = [];
  let componentsModified = 0;

  for (const change of state.changes) {
    // Count by type
    byType[change.type] = (byType[change.type] || 0) + 1;

    // Track pages
    if (change.type === 'page:created') {
      pagesCreated.push(change.target.name || change.target.id);
    } else if (change.type === 'page:updated') {
      if (!pagesUpdated.includes(change.target.name || change.target.id)) {
        pagesUpdated.push(change.target.name || change.target.id);
      }
    } else if (change.type === 'page:deleted') {
      pagesDeleted.push(change.target.name || change.target.id);
    }

    // Count component modifications
    if (change.type.startsWith('component:')) {
      componentsModified++;
    }
  }

  return {
    totalChanges: state.changes.length,
    byType: byType as Record<ChangeType, number>,
    recentChanges: state.changes.slice(-recentCount),
    pagesCreated,
    pagesUpdated,
    pagesDeleted,
    componentsModified,
  };
}

/**
 * Format changes as a context string for the AI
 */
export function formatChangesForContext(
  state: ChangeTrackerState | undefined,
  maxChanges = 20
): string {
  if (!state || state.changes.length === 0) {
    return 'No changes have been made in this session yet.';
  }

  const summary = getChangeSummary(state, maxChanges);
  const parts: string[] = [];

  parts.push(`Session changes (${summary.totalChanges} total):`);

  if (summary.pagesCreated.length > 0) {
    parts.push(`- Pages created: ${summary.pagesCreated.join(', ')}`);
  }

  if (summary.pagesUpdated.length > 0) {
    parts.push(`- Pages updated: ${summary.pagesUpdated.join(', ')}`);
  }

  if (summary.pagesDeleted.length > 0) {
    parts.push(`- Pages deleted: ${summary.pagesDeleted.join(', ')}`);
  }

  if (summary.componentsModified > 0) {
    parts.push(`- Components modified: ${summary.componentsModified}`);
  }

  // Add recent changes with timestamps
  if (summary.recentChanges.length > 0) {
    parts.push('');
    parts.push('Recent actions:');
    for (const change of summary.recentChanges.slice(-5)) {
      const time = new Date(change.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const action = change.type.replace(':', ' ').replace('_', ' ');
      const target = change.target.name || change.target.id;
      parts.push(`  [${time}] ${action}: ${target}`);
    }
  }

  return parts.join('\n');
}

/**
 * Check if a specific page has been modified
 */
export function hasPageBeenModified(
  state: ChangeTrackerState | undefined,
  pageId: string
): boolean {
  if (!state) return false;

  return state.changes.some(
    c => c.target.id === pageId || c.target.parentId === pageId
  );
}

/**
 * Get all changes for a specific page
 */
export function getChangesForPage(
  state: ChangeTrackerState | undefined,
  pageId: string
): ChangeRecord[] {
  if (!state) return [];

  return state.changes.filter(
    c => c.target.id === pageId || c.target.parentId === pageId
  );
}

/**
 * Clear change history (e.g., on session end)
 */
export function clearChanges(): ChangeTrackerState {
  return {
    changes: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge two change tracker states (e.g., when loading from storage)
 */
export function mergeChangeStates(
  existing: ChangeTrackerState | undefined,
  incoming: ChangeTrackerState | undefined
): ChangeTrackerState {
  if (!existing && !incoming) {
    return clearChanges();
  }

  if (!existing) {
    return incoming!;
  }

  if (!incoming) {
    return existing;
  }

  // Deduplicate by ID
  const existingIds = new Set(existing.changes.map(c => c.id));
  const mergedChanges = [
    ...existing.changes,
    ...incoming.changes.filter(c => !existingIds.has(c.id)),
  ];

  // Sort by timestamp
  mergedChanges.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return {
    changes: mergedChanges,
    startedAt: existing.startedAt < incoming.startedAt
      ? existing.startedAt
      : incoming.startedAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to create page change records from tool results
 */
export const changeHelpers = {
  pageCreated: (
    pageId: string,
    pageName: string,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'page:created',
      { type: 'page', id: pageId, name: pageName },
      {},
      messageId,
      toolCallId
    ),

  pageUpdated: (
    pageId: string,
    pageName: string,
    updates: Record<string, unknown>,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'page:updated',
      { type: 'page', id: pageId, name: pageName },
      { updates },
      messageId,
      toolCallId
    ),

  pageDeleted: (
    pageId: string,
    pageName: string,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'page:deleted',
      { type: 'page', id: pageId, name: pageName },
      {},
      messageId,
      toolCallId
    ),

  componentAdded: (
    componentId: string,
    componentType: string,
    pageId: string,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'component:added',
      { type: 'component', id: componentId, name: componentType, parentId: pageId },
      {},
      messageId,
      toolCallId
    ),

  componentUpdated: (
    componentId: string,
    componentType: string,
    pageId: string,
    updates: Record<string, unknown>,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'component:updated',
      { type: 'component', id: componentId, name: componentType, parentId: pageId },
      { updates },
      messageId,
      toolCallId
    ),

  componentDeleted: (
    componentId: string,
    componentType: string,
    pageId: string,
    messageId?: string,
    toolCallId?: string
  ): ChangeRecord =>
    createChangeRecord(
      'component:deleted',
      { type: 'component', id: componentId, name: componentType, parentId: pageId },
      {},
      messageId,
      toolCallId
    ),
};
