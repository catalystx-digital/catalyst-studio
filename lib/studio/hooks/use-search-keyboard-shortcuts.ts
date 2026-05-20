'use client';

import { useEffect, useCallback } from 'react';
import { useSiteBuilderStore } from '../stores/site-builder-store';

interface UseSearchKeyboardShortcutsOptions {
  enabled?: boolean;
  onJumpToHome?: () => void;
}

/**
 * Hook to handle keyboard shortcuts for search functionality
 * - Ctrl+K / Cmd+K: Open search overlay
 * - Ctrl+H / Cmd+H: Jump to home page
 * - Escape: Close search overlay
 */
export function useSearchKeyboardShortcuts(options: UseSearchKeyboardShortcutsOptions = {}) {
  const { enabled = true, onJumpToHome } = options;

  const searchIsOpen = useSiteBuilderStore((state) => state.searchIsOpen);
  const openSearch = useSiteBuilderStore((state) => state.openSearch);
  const closeSearch = useSiteBuilderStore((state) => state.closeSearch);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl+K / Cmd+K: Toggle search
      if (modifier && event.key === 'k') {
        event.preventDefault();
        if (searchIsOpen) {
          closeSearch();
        } else {
          openSearch();
        }
        return;
      }

      // Ctrl+H / Cmd+H: Jump to home (only when search is open)
      if (modifier && event.key === 'h' && searchIsOpen) {
        event.preventDefault();
        onJumpToHome?.();
        closeSearch();
        return;
      }

      // Escape: Close search
      if (event.key === 'Escape' && searchIsOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }
    },
    [enabled, searchIsOpen, openSearch, closeSearch, onJumpToHome]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    openSearch,
    closeSearch,
    isSearchOpen: searchIsOpen,
  };
}
