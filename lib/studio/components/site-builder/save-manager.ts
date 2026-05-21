import { Operation, SaveRequest, SaveResponse } from './types';
import { NetworkError, SaveError, serializeError } from './errors';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type ComponentOperationType = 'COMPONENT_UPDATE' | 'COMPONENT_ADD' | 'COMPONENT_DELETE' | 'COMPONENT_REORDER';

export interface ComponentOperation {
  type: ComponentOperationType;
  nodeId: string;  // The page node containing the component
  componentId: string;
  data?: Record<string, any>;
  globalComponentId?: string;  // If updating a global component
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
    // Use componentId as key - later updates overwrite earlier ones
    const key = `${operation.nodeId}:${operation.componentId}`;
    this.pendingComponentOperations.set(key, operation);
    this.debounceComponentSave();
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

    // Group by global vs page-only
    const globalOps = operations.filter(op => op.globalComponentId);
    const pageOps = operations.filter(op => !op.globalComponentId);

    this.updateStatus('saving');

    try {
      // Save global component updates
      if (globalOps.length > 0) {
        await Promise.all(globalOps.map(op =>
          fetch(`/api/studio/site-builder/global-components/${op.globalComponentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-studio-session-id': getStudioSessionId() },
            body: JSON.stringify({ content: op.data })
          })
        ));
      }

      // Save page-only component updates
      if (pageOps.length > 0) {
        await Promise.all(pageOps.map(op =>
          fetch(`/api/studio/site-builder/page-components/${op.componentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-studio-session-id': getStudioSessionId() },
            body: JSON.stringify({
              pageId: op.nodeId,
              overrides: op.data
            })
          })
        ));
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
    this.callbacks = {};
  }
}

// Export singleton instance
export const saveManager = new SaveManager();
