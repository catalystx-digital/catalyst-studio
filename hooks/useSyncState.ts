import { useState, useEffect, useCallback, useRef } from 'react';

export interface SyncState {
  id: string;
  typeKey: string;
  localHash: string | null;
  remoteHash: string | null;
  lastSyncedHash: string | null;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  conflictStatus: string | null;
  syncProgress: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStateSummary {
  total: number;
  synced: number;
  pending: number;
  conflicted: number;
  syncing: number;
  failed: number;
}

export interface UseSyncStateReturn {
  states: SyncState[];
  summary: SyncStateSummary;
  loading: boolean;
  error: string | null;
  refreshStates: () => Promise<void>;
  getSyncState: (typeKey: string) => Promise<SyncState | null>;
  updateSyncState: (typeKey: string, state: Partial<SyncState>) => Promise<void>;
  getInterruptedSyncs: () => Promise<string[]>;
  getConflictedTypes: () => Promise<string[]>;
  getPendingSyncTypes: () => Promise<string[]>;
}

export function useSyncState(): UseSyncStateReturn {
  const [states, setStates] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<number>(2_000);
  const previousSyncingRef = useRef<number>(0);

  const clearScheduledPoll = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const fetchStates = useCallback(async (options?: { suppressLoading?: boolean }) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    if (!options?.suppressLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const response = await fetch('/api/v1/sync/state', {
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sync states');
      }
      
      const data = await response.json();
      
      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setStates(data.states || []);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching sync states:', err);
      }
    } finally {
      if (!abortController.signal.aborted && !options?.suppressLoading) {
        setLoading(false);
      }
    }
  }, []);

  const getSyncState = useCallback(async (typeKey: string): Promise<SyncState | null> => {
    try {
      const response = await fetch(`/api/v1/sync/state?typeKey=${encodeURIComponent(typeKey)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch sync state');
      }
      
      const data = await response.json();
      return data.state;
    } catch (err) {
      console.error(`Error fetching sync state for ${typeKey}:`, err);
      return null;
    }
  }, []);

  const updateSyncState = useCallback(async (typeKey: string, state: Partial<SyncState>) => {
    try {
      const response = await fetch('/api/v1/sync/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ typeKey, state })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update sync state');
      }
      
      // Refresh states after update
      await fetchStates();
    } catch (err) {
      console.error(`Error updating sync state for ${typeKey}:`, err);
      throw err;
    }
  }, [fetchStates]);

  const getInterruptedSyncs = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/v1/sync/state?status=interrupted');
      if (!response.ok) {
        throw new Error('Failed to fetch interrupted syncs');
      }
      
      const data = await response.json();
      return data.types || [];
    } catch (err) {
      console.error('Error fetching interrupted syncs:', err);
      return [];
    }
  }, []);

  const getConflictedTypes = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/v1/sync/state?status=conflicted');
      if (!response.ok) {
        throw new Error('Failed to fetch conflicted types');
      }
      
      const data = await response.json();
      return data.types || [];
    } catch (err) {
      console.error('Error fetching conflicted types:', err);
      return [];
    }
  }, []);

  const getPendingSyncTypes = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/v1/sync/state?status=pending');
      if (!response.ok) {
        throw new Error('Failed to fetch pending sync types');
      }
      
      const data = await response.json();
      return data.types || [];
    } catch (err) {
      console.error('Error fetching pending sync types:', err);
      return [];
    }
  }, []);

  // Calculate summary from states
  const summary: SyncStateSummary = {
    total: states.length,
    synced: states.filter(s => s.syncStatus === 'in_sync').length,
    pending: states.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'new' || s.syncStatus === 'modified').length,
    conflicted: states.filter(s => s.conflictStatus === 'detected').length,
    syncing: states.filter(s => s.syncStatus === 'syncing').length,
    failed: states.filter(s => s.syncStatus === 'failed').length
  };

  // Initial fetch
  useEffect(() => {
    fetchStates();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearScheduledPoll();
    };
  }, [fetchStates, clearScheduledPoll]);

  useEffect(() => {
    const previousSyncing = previousSyncingRef.current;
    previousSyncingRef.current = summary.syncing;

    if (summary.syncing > 0) {
      if (previousSyncing === 0) {
        pollIntervalRef.current = 2_000;
      }

      const timeoutId = setTimeout(() => {
        fetchStates({ suppressLoading: true });
      }, pollIntervalRef.current);

      pollTimeoutRef.current = timeoutId;
      pollIntervalRef.current = Math.min(pollIntervalRef.current * 2, 60_000);

      return () => {
        clearTimeout(timeoutId);
        if (pollTimeoutRef.current === timeoutId) {
          pollTimeoutRef.current = null;
        }
      };
    }

    pollIntervalRef.current = 2_000;
    clearScheduledPoll();
  }, [summary.syncing, fetchStates, clearScheduledPoll]);

  const refreshStates = useCallback(async () => {
    pollIntervalRef.current = 2_000;
    clearScheduledPoll();
    await fetchStates();
  }, [fetchStates, clearScheduledPoll]);

  return {
    states,
    summary,
    loading,
    error,
    refreshStates,
    getSyncState,
    updateSyncState,
    getInterruptedSyncs,
    getConflictedTypes,
    getPendingSyncTypes
  };
}
