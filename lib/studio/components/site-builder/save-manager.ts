import { Operation, SaveRequest, SaveResponse } from './types';
import { NetworkError, SaveError, serializeError } from './errors';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type ComponentOperationType = 'COMPONENT_UPDATE' | 'COMPONENT_ADD' | 'COMPONENT_DELETE' | 'COMPONENT_REORDER';

export interface ComponentOperation {
  type: ComponentOperationType;
  nodeId: string;  // The page node containing the component
  componentId: string;
  data?: Record<string, any>;
  sharedComponentId?: string;  // If updating a shared component
}

export interface SaveManagerCallbacks {
  onStatusChange?: (status: SaveStatus) => void;
  onError?: (error: Error) => void;
  onSaveComplete?: (result: SaveResponse) => void;
  /** Called when server indicates layout was recalculated due to component changes affecting node heights */
  onLayoutRecalculated?: () => void;
  getWebsiteRevision?: () => number | null | undefined;
  onWebsiteRevisionChange?: (revision: number) => void;
}

const STUDIO_SESSION_STORAGE_KEY = 'studio-builder-session-id';

function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeComponentUpdateData(
  pendingData: Record<string, any> | undefined,
  nextData: Record<string, any> | undefined
): Record<string, any> | undefined {
  if (!pendingData) return nextData;
  if (!nextData) return pendingData;

  const hasNextProps = Object.prototype.hasOwnProperty.call(nextData, 'props');
  const merged = {
    ...pendingData,
    ...nextData,
  };

  if (isPlainObject(pendingData.props) && (!hasNextProps || isPlainObject(nextData.props))) {
    const nextProps = isPlainObject(nextData.props) ? nextData.props : {};
    merged.props = {
      ...pendingData.props,
      ...nextProps,
    };
  }

  return merged;
}

export function toPageComponentOverrides(data: unknown): Record<string, any> | null {
  if (!isPlainObject(data)) {
    throw new SaveError('Page component update payload must be an object');
  }

  if (isPlainObject(data.content)) {
    return data.content;
  }

  if (isPlainObject(data.props)) {
    if (
      Object.prototype.hasOwnProperty.call(data.props, 'content')
      || Object.prototype.hasOwnProperty.call(data.props, 'text')
    ) {
      throw new SaveError('Page component update payload contains malformed legacy content mirrors');
    }
  }

  return data;
}

function getStructuralComponents(op: ComponentOperation): unknown[] {
  const components = op.data?.components;
  if (!Array.isArray(components)) {
    throw new SaveError(`${op.type} requires data.components for structural page content persistence`);
  }
  return components;
}

function getStructuralIfUnchangedSince(op: ComponentOperation): string | undefined {
  const value = op.data?.ifUnchangedSince;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' ? value : undefined;
}

export function getStudioSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }
  const existing = window.localStorage.getItem(STUDIO_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(STUDIO_SESSION_STORAGE_KEY, generated);
  return generated;
}

/**
 * Manages debounced saves with exponential backoff retry
 * Singleton pattern for global save management
 */
class SaveManager {
  private pendingOperations: Operation[] = [];
  private saveTimeout: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly debounceMs = 1000;
  private websiteId: string | null = null;
  private callbacks: SaveManagerCallbacks = {};
  private currentStatus: SaveStatus = 'idle';
  private abortController: AbortController | null = null;
  private websiteRevision: number | null = null;
  private structuralPageUpdatedAt: Map<string, string> = new Map();

  // Component-specific debounce configuration
  private readonly componentDebounceMs = 500;  // Faster for component changes
  private componentSaveTimeout: NodeJS.Timeout | null = null;
  private pendingComponentOperations: Map<string, ComponentOperation> = new Map();
  
  /**
   * Initialize the save manager for a specific website
   */
  initialize(websiteId: string, callbacks?: SaveManagerCallbacks) {
    this.websiteId = websiteId;
    this.callbacks = callbacks || {};
    this.websiteRevision = callbacks?.getWebsiteRevision?.() ?? null;
    this.updateStatus('idle');
  }

  setWebsiteRevision(revision: number | null | undefined) {
    this.websiteRevision = typeof revision === 'number' ? revision : null;
  }
  
  /**
   * Add an operation to the pending queue
   */
  addOperation(operation: Operation) {
    this.pendingOperations.push(operation);
    this.debounceSave();
  }
  
  /**
   * Add multiple operations at once
   */
  addOperations(operations: Operation[]) {
    this.pendingOperations.push(...operations);
    this.debounceSave();
  }

  /**
   * Add a component operation with component-specific debouncing
   * Uses componentId as key to dedupe rapid updates to same component
   */
  addComponentOperation(operation: ComponentOperation) {
    const structuralKey = `${operation.nodeId}:__structure`;

    if (operation.type !== 'COMPONENT_UPDATE') {
      this.pendingComponentOperations.set(structuralKey, operation);

      for (const [key, pending] of this.pendingComponentOperations.entries()) {
        if (key !== structuralKey && pending.nodeId === operation.nodeId && !pending.sharedComponentId) {
          this.pendingComponentOperations.delete(key);
        }
      }
      this.debounceComponentSave();
      return;
    }

    const pendingStructural = this.pendingComponentOperations.get(structuralKey);
    if (pendingStructural && !operation.sharedComponentId) {
      const components = getStructuralComponents(pendingStructural).map(component => {
        if (
          component &&
          typeof component === 'object' &&
          !Array.isArray(component) &&
          (component as Record<string, unknown>).id === operation.componentId
        ) {
          return mergeComponentUpdateData(
            component as Record<string, any>,
            operation.data
          ) || component;
        }
        return component;
      });

      this.pendingComponentOperations.set(structuralKey, {
        ...pendingStructural,
        data: {
          ...(pendingStructural.data || {}),
          components,
        },
      });
      this.debounceComponentSave();
      return;
    }

    const key = `${operation.nodeId}:${operation.componentId}`;
    const pendingUpdate = this.pendingComponentOperations.get(key);
    this.pendingComponentOperations.set(key, pendingUpdate?.type === 'COMPONENT_UPDATE'
      && !pendingUpdate.sharedComponentId
      && !operation.sharedComponentId
      ? {
          ...pendingUpdate,
          ...operation,
          data: mergeComponentUpdateData(pendingUpdate.data, operation.data),
        }
      : operation);
    this.debounceComponentSave();
  }

  private getStructuralIfUnchangedSinceForPage(op: ComponentOperation): string | undefined {
    return this.structuralPageUpdatedAt.get(op.nodeId) ?? getStructuralIfUnchangedSince(op);
  }

  private debounceComponentSave() {
    if (this.componentSaveTimeout) {
      clearTimeout(this.componentSaveTimeout);
    }

    this.componentSaveTimeout = setTimeout(() => {
      this.saveComponentOperations();
    }, this.componentDebounceMs);
  }

  private async saveComponentOperations() {
    // TKT-040 FIX: Clear timeout so hasUnsavedChanges() returns false after save
    this.componentSaveTimeout = null;
    if (this.pendingComponentOperations.size === 0) return;

    const operations = Array.from(this.pendingComponentOperations.values());
    this.pendingComponentOperations.clear();

    const updateOps = operations.filter(op => op.type === 'COMPONENT_UPDATE');
    const structuralOps = operations.filter(op => op.type !== 'COMPONENT_UPDATE');
    // Group update operations by global vs page-only. Structural operations always
    // persist the canonical WebsitePage.content JSON for the page.
    const globalOps = updateOps.filter(op => op.sharedComponentId);
    const pageUpdateOps = updateOps.filter(op => !op.sharedComponentId);

    this.updateStatus('saving');

    try {
      // Save global component updates
      if (globalOps.length > 0) {
        await Promise.all(globalOps.map(async op => {
          const response = await fetch(`/api/studio/site-builder/global-components/${op.sharedComponentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-studio-session-id': getStudioSessionId() },
            body: JSON.stringify({ content: op.data })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new SaveError(errorData.error || `Global component save failed: ${response.statusText}`);
          }
        }));
      }

      // Save page-only component override updates. Only COMPONENT_UPDATE may call
      // the page-component override PATCH endpoint.
      if (pageUpdateOps.length > 0) {
        await Promise.all(pageUpdateOps.map(async op => {
          const overrides = toPageComponentOverrides(op.data);

          const response = await fetch(`/api/studio/site-builder/page-components/${op.componentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-studio-session-id': getStudioSessionId() },
            body: JSON.stringify({
              pageId: op.nodeId,
              overrides
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new SaveError(errorData.error || `Component save failed: ${response.statusText}`);
          }
        }));
      }

      if (structuralOps.length > 0) {
        const latestStructuralByPage = new Map<string, ComponentOperation>();
        for (const op of structuralOps) {
          getStructuralComponents(op);
          latestStructuralByPage.set(op.nodeId, op);
        }

        await Promise.all(Array.from(latestStructuralByPage.values()).map(async op => {
          const ifUnchangedSince = this.getStructuralIfUnchangedSinceForPage(op);
          const response = await fetch(`/api/studio/site-builder/pages/${op.nodeId}/components`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-studio-session-id': getStudioSessionId() },
            body: JSON.stringify({
              pageId: op.nodeId,
              components: getStructuralComponents(op),
              ...(ifUnchangedSince ? { ifUnchangedSince } : {})
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new SaveError(errorData.error || `Structural component save failed: ${response.statusText}`);
          }

          const result = await response.json().catch(() => ({}));
          if (typeof result.updatedAt === 'string') {
            this.structuralPageUpdatedAt.set(op.nodeId, result.updatedAt);
          }
        }));
      }

      this.updateStatus('saved');
      setTimeout(() => {
        if (this.currentStatus === 'saved') {
          this.updateStatus('idle');
        }
      }, 2000);

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Component save failed:', error);
      }
      this.updateStatus('error');
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Clear all pending operations
   */
  clearPending() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.componentSaveTimeout) {
      clearTimeout(this.componentSaveTimeout);
      this.componentSaveTimeout = null;
    }
    this.pendingOperations = [];
    this.pendingComponentOperations.clear();
    this.structuralPageUpdatedAt.clear();
    this.retryCount = 0;
    this.updateStatus('idle');
  }
  
  /**
   * Force immediate save of pending operations
   */
  async saveNow(): Promise<void> {
    // Clear both timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.componentSaveTimeout) {
      clearTimeout(this.componentSaveTimeout);
      this.componentSaveTimeout = null;
    }

    // Save both pending operations and component operations
    const promises: Promise<void>[] = [];

    if (this.pendingOperations.length > 0) {
      promises.push(this.save());
    }
    if (this.pendingComponentOperations.size > 0) {
      promises.push(this.saveComponentOperations());
    }

    await Promise.all(promises);
  }
  
  /**
   * Get current save status
   */
  getStatus(): SaveStatus {
    return this.currentStatus;
  }
  
  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.pendingOperations.length + this.pendingComponentOperations.size;
  }

  /**
   * Get unified status considering all operation types
   */
  getUnifiedStatus(): SaveStatus {
    const hasPending = this.pendingOperations.length > 0 ||
                       this.pendingComponentOperations.size > 0;

    if (this.currentStatus === 'saving') return 'saving';
    if (this.currentStatus === 'error') return 'error';
    if (hasPending) return 'saving';  // About to save (in debounce window)
    return this.currentStatus;
  }

  /**
   * Check if there are any unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.pendingOperations.length > 0 ||
           this.pendingComponentOperations.size > 0 ||
           this.saveTimeout !== null ||
           this.componentSaveTimeout !== null;
  }
  
  private updateStatus(status: SaveStatus) {
    this.currentStatus = status;
    this.callbacks.onStatusChange?.(status);
  }
  
  private debounceSave() {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // Set new timeout
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, this.debounceMs);
  }
  
  private async save() {
    // TKT-040 FIX: Clear timeout so hasUnsavedChanges() returns false after save
    this.saveTimeout = null;
    if (!this.websiteId || this.pendingOperations.length === 0) {
      return;
    }
    
    // Move operations to a local variable and clear pending
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];
    
    this.updateStatus('saving');
    
    // Cancel any previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    try {
      const response = await fetch('/api/studio/sitemap/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-studio-session-id': getStudioSessionId(),
        },
        body: JSON.stringify({
          websiteId: this.websiteId,
          operations,
          baseWebsiteRevision: this.callbacks.getWebsiteRevision?.() ?? this.websiteRevision,
        } as SaveRequest),
        signal: this.abortController.signal
      });
      
      if (!response || !response.ok) {
        if (response) {
          const errorData = await response.json();
          if (typeof errorData.currentWebsiteRevision === 'number') {
            this.websiteRevision = errorData.currentWebsiteRevision;
            this.callbacks.onWebsiteRevisionChange?.(errorData.currentWebsiteRevision);
          }
          
          // Check if this is a retryable error
          if (errorData.retryable || response.status === 409) {
            throw new SaveError(errorData.error || 'Save failed - retrying');
          }
          
          throw new SaveError(errorData.error || `Save failed: ${response.statusText}`);
        } else {
          throw new NetworkError();
        }
      }
      
      const result: SaveResponse = await response.json();
      if (!result.success) {
        throw new SaveError(result.error || 'Save failed');
      }

      if (typeof result.currentWebsiteRevision === 'number') {
        this.websiteRevision = result.currentWebsiteRevision;
        this.callbacks.onWebsiteRevisionChange?.(result.currentWebsiteRevision);
      }

      // Reset retry count on success
      this.retryCount = 0;
      this.updateStatus('saved');
      this.callbacks.onSaveComplete?.(result);

      // Check if layout was recalculated due to component changes affecting node heights
      // Client needs to refresh positions to prevent overlap
      if ((result as any).layoutRecalculated) {
        if (process.env.NODE_ENV === 'development') {
        console.log('[SaveManager] Layout was recalculated - triggering position refresh');
        }
        this.callbacks.onLayoutRecalculated?.();
      }

      // Auto-reset status after a delay
      setTimeout(() => {
        if (this.currentStatus === 'saved') {
          this.updateStatus('idle');
        }
      }, 2000);
      
    } catch (error) {
      // Handle abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, operations will be in new save
        return;
      }
      
      // Handle network errors
      if (!navigator.onLine || (error instanceof TypeError && error.message.includes('fetch'))) {
        error = new NetworkError();
      }
      
      if (process.env.NODE_ENV === 'development') {
      console.error('Save failed:', error);
      }
      
      // Attempt retry with exponential backoff
      if (this.retryCount < this.maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, this.retryCount), 6000); // 2s, 4s, 6s max
        this.retryCount++;
        
        if (process.env.NODE_ENV === 'development') {
        console.log(`Retrying save in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        // Re-add operations to pending for retry
        this.pendingOperations.unshift(...operations);
        
        setTimeout(() => {
          this.save();
        }, delay);
      } else {
        // Max retries reached
        this.updateStatus('error');
        this.callbacks.onError?.(error as Error);
        
        // Keep operations in pending for manual retry
        this.pendingOperations.unshift(...operations);
      }
    } finally {
      this.abortController = null;
    }
  }
  
  /**
   * Manual retry after error
   */
  async retry() {
    this.retryCount = 0;
    this.updateStatus('idle');
    await this.save();
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.componentSaveTimeout) {
      clearTimeout(this.componentSaveTimeout);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.pendingOperations = [];
    this.pendingComponentOperations.clear();
    this.structuralPageUpdatedAt.clear();
    this.callbacks = {};
  }
}

// Export singleton instance
export const saveManager = new SaveManager();
