import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewport } from 'reactflow';
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store';

interface ViewportSyncOptions {
  websiteId: string;
  debounceMs?: number;
  bufferPx?: number;
  enabled?: boolean;
}

interface LoadingState {
  isLoading: boolean;
  region: { x: number; y: number; width: number; height: number } | null;
}

export function useViewportSync({
  websiteId,
  debounceMs = 150,
  bufferPx = 200,
  enabled = true,
}: ViewportSyncOptions) {
  const viewport = useViewport();
  const mergeNodes = useSiteBuilderStore((state) => state.mergeNodes);

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    region: null,
  });
  const [stats, setStats] = useState({
    loadedRegions: 0,
    totalLoaded: 0,
  });

  // Refs for tracking state without re-renders
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRegionsRef = useRef<Set<string>>(new Set());
  const panHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const lastFetchRef = useRef<{ x: number; y: number; zoom: number } | null>(null);

  // Calculate region key for deduplication
  const getRegionKey = useCallback((x: number, y: number, zoom: number): string => {
    const gridSize = 400; // Quantize to grid cells
    const gx = Math.floor(x / gridSize);
    const gy = Math.floor(y / gridSize);
    const gz = Math.round(zoom * 10) / 10;
    return `${gx},${gy},${gz}`;
  }, []);

  // Detect pan direction from history
  const getPanDirection = useCallback((): 'up' | 'down' | 'left' | 'right' | null => {
    const history = panHistoryRef.current;
    if (history.length < 3) return null;

    const recent = history.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const dx = last.x - first.x;
    const dy = last.y - first.y;

    if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return null;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }, []);

  // Check if viewport changed significantly
  const hasViewportChangedSignificantly = useCallback((
    current: { x: number; y: number; zoom: number }
  ): boolean => {
    const last = lastFetchRef.current;
    if (!last) return true;

    const threshold = 100; // pixels
    const zoomThreshold = 0.1;

    return (
      Math.abs(current.x - last.x) > threshold ||
      Math.abs(current.y - last.y) > threshold ||
      Math.abs(current.zoom - last.zoom) > zoomThreshold
    );
  }, []);

  // Fetch viewport nodes
  const fetchViewportNodes = useCallback(async () => {
    if (!websiteId || !enabled || !mergeNodes) return;

    // Calculate canvas coordinates from viewport
    const canvasX = -viewport.x / viewport.zoom;
    const canvasY = -viewport.y / viewport.zoom;
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;

    const currentViewport = { x: canvasX, y: canvasY, zoom: viewport.zoom };

    // Skip if not changed significantly
    if (!hasViewportChangedSignificantly(currentViewport)) {
      return;
    }

    // Check region cache
    const regionKey = getRegionKey(canvasX, canvasY, viewport.zoom);
    if (loadedRegionsRef.current.has(regionKey)) {
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoadingState({
      isLoading: true,
      region: { x: canvasX, y: canvasY, width, height },
    });

    try {
      const direction = getPanDirection();
      const params = new URLSearchParams({
        x: String(canvasX),
        y: String(canvasY),
        width: String(width),
        height: String(height),
        zoom: String(viewport.zoom),
        buffer: String(bufferPx),
        ...(direction && { direction }),
      });

      const response = await fetch(
        `/api/studio/sitemap/${websiteId}/viewport?${params}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`Viewport fetch failed: ${response.status}`);
      }

      const data = await response.json();

      // Get the actual detail level from the API response
      const responseDetailLevel = data.meta?.detailLevel || 'full';

      if (process.env.NODE_ENV === 'development' && data.visible?.length > 0) {
        console.log('[ViewportSync] Received data from viewport API:', {
          visibleCount: data.visible.length,
          detailLevel: responseDetailLevel,
          firstNode: data.visible[0] ? {
            id: data.visible[0].id,
            hasDataComponents: !!data.visible[0].data?.components,
            componentCount: data.visible[0].data?.components?.length || 0,
            _detailLevel: data.visible[0].data?._detailLevel,
            _needsDetailLoad: data.visible[0].data?._needsDetailLoad,
          } : null,
        });
      }

      // Merge nodes into store using the ACTUAL detail level from API response
      // This ensures we don't mark nodes as 'full' when they don't have component data
      if (data.visible?.length > 0) {
        mergeNodes(data.visible, responseDetailLevel as 'skeleton' | 'minimal' | 'standard' | 'full');
      }
      if (data.buffer?.length > 0) {
        mergeNodes(data.buffer, 'minimal');
      }

      // Update tracking
      loadedRegionsRef.current.add(regionKey);
      lastFetchRef.current = currentViewport;

      setStats(prev => ({
        loadedRegions: loadedRegionsRef.current.size,
        totalLoaded: prev.totalLoaded + (data.visible?.length || 0) + (data.buffer?.length || 0),
      }));

      // Background prefetch if moving fast
      if (data.prefetchHints?.length > 0 && direction) {
        setTimeout(() => prefetchNodes(data.prefetchHints), 300);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[ViewportSync] Fetch error:', error);
      }
    } finally {
      setLoadingState({ isLoading: false, region: null });
    }
  }, [
    websiteId,
    enabled,
    viewport.x,
    viewport.y,
    viewport.zoom,
    bufferPx,
    getRegionKey,
    getPanDirection,
    hasViewportChangedSignificantly,
    mergeNodes,
  ]);

  // Background prefetch
  const prefetchNodes = useCallback(async (nodeIds: string[]) => {
    if (!websiteId || nodeIds.length === 0 || !mergeNodes) return;

    try {
      const response = await fetch(
        `/api/studio/sitemap/${websiteId}/viewport?ids=${nodeIds.slice(0, 20).join(',')}&detail=minimal`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.visible?.length > 0) {
          mergeNodes(data.visible, 'minimal');
        }
      }
    } catch {
      // Silent prefetch failure
    }
  }, [websiteId, mergeNodes]);

  // Track pan history
  useEffect(() => {
    const canvasX = -viewport.x / viewport.zoom;
    const canvasY = -viewport.y / viewport.zoom;

    panHistoryRef.current.push({ x: canvasX, y: canvasY, time: Date.now() });
    if (panHistoryRef.current.length > 10) {
      panHistoryRef.current.shift();
    }
  }, [viewport.x, viewport.y, viewport.zoom]);

  // Debounced viewport fetch
  useEffect(() => {
    if (!enabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(fetchViewportNodes, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [viewport.x, viewport.y, viewport.zoom, enabled, debounceMs, fetchViewportNodes]);

  // Reset on websiteId change
  useEffect(() => {
    loadedRegionsRef.current.clear();
    lastFetchRef.current = null;
    panHistoryRef.current = [];
    setStats({ loadedRegions: 0, totalLoaded: 0 });
  }, [websiteId]);

  // Trigger initial fetch when viewport sync becomes enabled (after skeleton load)
  const wasEnabledRef = useRef(false);
  useEffect(() => {
    if (enabled && !wasEnabledRef.current && websiteId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ViewportSync] Initial fetch triggered after skeleton load');
      }
      // Small delay to ensure ReactFlow has set initial viewport
      const timer = setTimeout(() => {
        fetchViewportNodes();
      }, 100);
      wasEnabledRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!enabled) {
      wasEnabledRef.current = false;
    }
  }, [enabled, websiteId, fetchViewportNodes]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isLoading: loadingState.isLoading,
    loadingRegion: loadingState.region,
    stats,
    clearCache: useCallback(() => {
      loadedRegionsRef.current.clear();
      lastFetchRef.current = null;
      setStats({ loadedRegions: 0, totalLoaded: 0 });
    }, []),
  };
}
