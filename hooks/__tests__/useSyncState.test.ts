import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyncState } from '../useSyncState';

// Mock fetch
global.fetch = jest.fn();

describe('useSyncState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch sync states on mount', async () => {
    const mockStates = [
      {
        id: '1',
        typeKey: 'test_type_1',
        localHash: 'hash1',
        remoteHash: 'hash1',
        syncStatus: 'in_sync',
        conflictStatus: null
      },
      {
        id: '2',
        typeKey: 'test_type_2',
        localHash: 'hash2',
        remoteHash: 'hash3',
        syncStatus: 'modified',
        conflictStatus: null
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ states: mockStates })
    });

    const { result } = renderHook(() => useSyncState());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.states).toEqual(mockStates);
    expect(result.current.summary.total).toBe(2);
    expect(result.current.summary.synced).toBe(1);
    expect(result.current.summary.pending).toBe(1);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.states).toEqual([]);
  });

  it('should get specific sync state', async () => {
    const mockState = {
      id: '1',
      typeKey: 'test_type',
      localHash: 'hash1',
      remoteHash: 'hash1',
      syncStatus: 'in_sync'
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: mockState })
      });

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let state;
    await act(async () => {
      state = await result.current.getSyncState('test_type');
    });

    expect(state).toEqual(mockState);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sync/state?typeKey=test_type');
  });

  it('should update sync state', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] })
      });

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSyncState('test_type', {
        syncStatus: 'syncing'
      });
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sync/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        typeKey: 'test_type',
        state: { syncStatus: 'syncing' }
      })
    });
  });

  it('should get interrupted syncs', async () => {
    const mockTypes = ['type1', 'type2'];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ types: mockTypes })
      });

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let types;
    await act(async () => {
      types = await result.current.getInterruptedSyncs();
    });

    expect(types).toEqual(mockTypes);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sync/state?status=interrupted');
  });

  it('should get conflicted types', async () => {
    const mockTypes = ['type1', 'type2'];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ types: mockTypes })
      });

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let types;
    await act(async () => {
      types = await result.current.getConflictedTypes();
    });

    expect(types).toEqual(mockTypes);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/sync/state?status=conflicted');
  });

  it('should calculate summary correctly', async () => {
    const mockStates = [
      { typeKey: 'type1', syncStatus: 'in_sync', conflictStatus: null },
      { typeKey: 'type2', syncStatus: 'pending', conflictStatus: null },
      { typeKey: 'type3', syncStatus: 'syncing', conflictStatus: null },
      { typeKey: 'type4', syncStatus: 'failed', conflictStatus: null },
      { typeKey: 'type5', syncStatus: 'modified', conflictStatus: 'detected' }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ states: mockStates })
    });

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toEqual({
      total: 5,
      synced: 1,
      pending: 2, // pending + modified
      conflicted: 1,
      syncing: 1,
      failed: 1
    });
  });

  it('should auto-refresh when syncing', async () => {
    const mockStatesWithSyncing = [
      { typeKey: 'type1', syncStatus: 'syncing', conflictStatus: null }
    ];

    const mockStatesCompleted = [
      { typeKey: 'type1', syncStatus: 'in_sync', conflictStatus: null }
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: mockStatesWithSyncing })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: mockStatesCompleted })
      });

    jest.useFakeTimers();

    const { result } = renderHook(() => useSyncState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary.syncing).toBe(1);

    // Fast-forward time to trigger auto-refresh
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.summary.syncing).toBe(0);
    });

    expect(result.current.summary.synced).toBe(1);

    jest.useRealTimers();
  });
});