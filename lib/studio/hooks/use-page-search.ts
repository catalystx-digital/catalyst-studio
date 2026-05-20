'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useSiteBuilderStore } from '../stores/site-builder-store';

interface SearchResult {
  structureId: string;
  pageTitle: string | null;
  pageSlug: string;
  fullPath: string;
  position: { x: number; y: number };
  relevanceScore: number;
}

interface UsePageSearchResult {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  search: (query: string) => Promise<void>;
  openSearch: () => void;
  closeSearch: () => void;
  selectResult: (structureId: string) => void;
  // BUG-009 FIX: Viewport restoration
  restoreViewport: () => void;
}

/**
 * Hook for page search functionality
 * Provides search with position lookup for jump-to-node
 * BUG-009 FIX: Saves viewport state when search opens for restoration
 */
export function usePageSearch(): UsePageSearchResult {
  const websiteId = useSiteBuilderStore((state) => state.websiteId);
  const query = useSiteBuilderStore((state) => state.searchQuery);
  const results = useSiteBuilderStore((state) => state.searchResults);
  const isLoading = useSiteBuilderStore((state) => state.searchIsLoading);
  const isOpen = useSiteBuilderStore((state) => state.searchIsOpen);
  // BUG-009 FIX: Viewport state before search
  const viewportBeforeSearch = useSiteBuilderStore((state) => state.viewportBeforeSearch);

  const setSearchQuery = useSiteBuilderStore((state) => state.setSearchQuery);
  const setSearchResults = useSiteBuilderStore((state) => state.setSearchResults);
  const setSearchIsLoading = useSiteBuilderStore((state) => state.setSearchIsLoading);
  const storeOpenSearch = useSiteBuilderStore((state) => state.openSearch);
  const storeCloseSearch = useSiteBuilderStore((state) => state.closeSearch);
  const jumpToNode = useSiteBuilderStore((state) => state.jumpToNode);
  // BUG-009 FIX: Viewport save/restore actions
  const saveViewportBeforeSearch = useSiteBuilderStore((state) => state.saveViewportBeforeSearch);
  const clearViewportBeforeSearch = useSiteBuilderStore((state) => state.clearViewportBeforeSearch);

  // BUG-009 FIX: Access ReactFlow for viewport operations
  const { getViewport, setViewport } = useReactFlow();

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const search = useCallback(
    async (searchQuery: string) => {
      // Update query immediately for UI
      setSearchQuery(searchQuery);

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear previous debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Don't search for very short queries
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setSearchIsLoading(false);
        return;
      }

      if (!websiteId) {
        console.warn('[usePageSearch] No websiteId available');
        return;
      }

      // Debounce by 200ms
      debounceTimeoutRef.current = setTimeout(async () => {
        setSearchIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const response = await fetch(
            `/api/studio/sitemap/${websiteId}/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data = await response.json();
          setSearchResults(data.results || []);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            // Request was cancelled, ignore
            return;
          }
          console.error('[usePageSearch] Search error:', error);
          setSearchResults([]);
        } finally {
          setSearchIsLoading(false);
        }
      }, 200);
    },
    [websiteId, setSearchQuery, setSearchResults, setSearchIsLoading]
  );

  // BUG-009 FIX: Save viewport when search opens
  const openSearch = useCallback(() => {
    // Save current viewport state before opening search
    const currentViewport = getViewport();
    saveViewportBeforeSearch(currentViewport);
    storeOpenSearch();
  }, [storeOpenSearch, getViewport, saveViewportBeforeSearch]);

  const closeSearch = useCallback(() => {
    // Clear viewport state when closing (restoration handled separately)
    clearViewportBeforeSearch();
    storeCloseSearch();
  }, [storeCloseSearch, clearViewportBeforeSearch]);

  // BUG-009 FIX: Restore viewport to state before search opened
  const restoreViewport = useCallback(() => {
    if (viewportBeforeSearch) {
      setViewport(viewportBeforeSearch, { duration: 300 });
    }
  }, [viewportBeforeSearch, setViewport]);

  const selectResult = useCallback(
    (structureId: string) => {
      // Find the result to get its position
      const result = results.find((r) => r.structureId === structureId);
      if (result) {
        // Jump to the node (this navigates to a new position, don't restore viewport)
        jumpToNode(structureId);
        // Clear viewport state since we intentionally navigated somewhere
        clearViewportBeforeSearch();
        // Close search
        storeCloseSearch();
      }
    },
    [results, jumpToNode, clearViewportBeforeSearch, storeCloseSearch]
  );

  return {
    query,
    results,
    isLoading,
    isOpen,
    search,
    openSearch,
    closeSearch,
    selectResult,
    // BUG-009 FIX: Viewport restoration
    restoreViewport,
  };
}
