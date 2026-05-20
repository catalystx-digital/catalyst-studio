import { useEffect, useRef, useCallback, useState } from 'react';
import { useSiteBuilderStore } from '../stores/site-builder-store';
import { saveManager, SaveStatus } from '../components/site-builder/save-manager';

export interface UseAutoSaveOptions {
  enabled?: boolean;
  warnOnUnload?: boolean;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

/**
 * Hook to automatically save changes and prevent data loss
 * Uses unified status from saveManager for accurate tracking of all save paths
 */
export function useAutoSave(options: UseAutoSaveOptions = {}) {
  const {
    enabled = true,
    warnOnUnload = true,
    onSaveStart,
    onSaveComplete,
    onSaveError
  } = options;

  const { nodes, edges, isLoading } = useSiteBuilderStore();
  const storeStatus = useSiteBuilderStore(state => state.saveStatus);

  // Get unified status that includes both sitemap and component operations
  const [unifiedStatus, setUnifiedStatus] = useState<SaveStatus>(() => saveManager.getUnifiedStatus());
  const previousNodesRef = useRef(nodes);
  const previousEdgesRef = useRef(edges);
  const isInitializedRef = useRef(false);
  const previousStatusRef = useRef<SaveStatus>(unifiedStatus);

  // Poll unified status periodically to catch component save state changes
  // This is needed because component operations have their own debounce
  useEffect(() => {
    if (!enabled) return;

    const checkStatus = () => {
      const newStatus = saveManager.getUnifiedStatus();
      if (newStatus !== unifiedStatus) {
        setUnifiedStatus(newStatus);
      }
    };

    // Check immediately and then poll every 100ms
    checkStatus();
    const interval = setInterval(checkStatus, 100);

    return () => clearInterval(interval);
  }, [enabled, unifiedStatus]);

  // Mark as initialized once initial data is loaded
  useEffect(() => {
    if (!isLoading && (nodes.length > 0 || edges.length > 0)) {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        previousNodesRef.current = nodes;
        previousEdgesRef.current = edges;
      }
    }
  }, [nodes, edges, isLoading]);

  // Track changes
  useEffect(() => {
    if (!enabled) return;
    if (!isInitializedRef.current) return;

    // Check if nodes or edges have changed
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(previousNodesRef.current);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(previousEdgesRef.current);

    if (nodesChanged || edgesChanged) {
      previousNodesRef.current = nodes;
      previousEdgesRef.current = edges;
      // Changes are tracked by saveManager automatically
    }
  }, [nodes, edges, enabled]);

  // Fire callbacks based on unified status changes
  useEffect(() => {
    const prevStatus = previousStatusRef.current;
    previousStatusRef.current = unifiedStatus;

    if (prevStatus === unifiedStatus) return;

    if (unifiedStatus === 'saved' && prevStatus === 'saving') {
      onSaveComplete?.();
    } else if (unifiedStatus === 'saving' && prevStatus !== 'saving') {
      onSaveStart?.();
    } else if (unifiedStatus === 'error') {
      onSaveError?.(new Error('Failed to save changes'));
    }
  }, [unifiedStatus, onSaveComplete, onSaveStart, onSaveError]);
  
  // Handle beforeunload event to warn about unsaved changes
  useEffect(() => {
    if (!warnOnUnload) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Use unified hasUnsavedChanges from saveManager
      if (saveManager.hasUnsavedChanges()) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.preventDefault();
        event.returnValue = message; // For Chrome
        return message; // For other browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [warnOnUnload]);

  // Force save on component unmount
  useEffect(() => {
    return () => {
      if (saveManager.hasUnsavedChanges()) {
        // Try to save immediately before unmount
        saveManager.saveNow().catch(console.error);
      }
    };
  }, []);

  // Manual save function
  const saveNow = useCallback(async () => {
    try {
      await saveManager.saveNow();
    } catch (error) {
      console.error('Manual save failed:', error);
      throw error;
    }
  }, []);

  // Retry failed saves
  const retry = useCallback(() => {
    saveManager.retry();
  }, []);

  return {
    // Use unified status from saveManager for accurate tracking
    hasUnsavedChanges: saveManager.hasUnsavedChanges(),
    saveStatus: unifiedStatus,
    pendingOperations: saveManager.getPendingCount(),
    saveNow,
    retry
  };
}