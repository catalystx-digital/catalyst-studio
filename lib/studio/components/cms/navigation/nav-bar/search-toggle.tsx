'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavBarSearch } from './nav-bar.types';
import { SearchPanel } from './search-panel';

interface SearchToggleProps {
  search: NavBarSearch;
  onInteraction?: (event: string, payload: Record<string, unknown>) => void;
}

export function SearchToggle({ search, onInteraction }: SearchToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onInteraction?.('search_open', {});
    if (!search.showSuggestions) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [onInteraction, search.showSuggestions]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    onInteraction?.('search_close', {});
  }, [onInteraction]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      onInteraction?.('search_submit', { query: trimmed });

      if (search.action) {
        const url = `${search.action}${search.action.includes('?') ? '&' : '?'}q=${encodeURIComponent(trimmed)}`;
        window.location.href = url;
      }

      handleClose();
    },
    [query, search.action, onInteraction, handleClose],
  );

  // Always show search icon button
  const searchButton = (
    <button
      type="button"
      onClick={handleOpen}
      className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      aria-label="Open search"
    >
      <Search className="h-5 w-5" />
    </button>
  );

  // If using rich search panel with suggestions
  if (search.showSuggestions) {
    return (
      <div className="relative">
        {searchButton}
        <SearchPanel
          isOpen={isOpen}
          onClose={handleClose}
          search={search}
          onInteraction={onInteraction}
        />
      </div>
    );
  }

  // Simple inline expand behavior (no suggestions)
  if (!isOpen) {
    return searchButton;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={search.placeholder || 'Search...'}
          className={cn(
            'h-9 w-48 rounded-full border border-border/50 bg-muted/40 pl-9 pr-4',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:w-64 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30',
            'transition-[width,border-color,box-shadow] duration-200',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleClose();
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="rounded-full p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        aria-label="Close search"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
