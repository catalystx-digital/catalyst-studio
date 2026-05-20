'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import type { SearchSuggestion, NavBarSearch } from './nav-bar.types';

const STORAGE_KEY = 'cms-navbar-search-recent';
const MAX_RECENT = 5;

function readStoredRecent(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function writeStoredRecent(values: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Silently ignore storage errors
  }
}

function sanitizeRecent(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const unique = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed || unique.has(trimmed)) {
      continue;
    }

    unique.add(trimmed);
    result.push(trimmed);

    if (result.length >= MAX_RECENT) {
      break;
    }
  }

  return result;
}

type SearchMetadata = {
  source?: 'input' | 'suggestion' | 'recent';
  suggestion?: SearchSuggestion;
  url?: string;
};

type SuggestionGroup = {
  heading: string;
  key: string;
  items: SearchSuggestion[];
};

function groupSuggestions(
  suggestions: SearchSuggestion[],
  defaultHeading: string,
): SuggestionGroup[] {
  if (suggestions.length === 0) {
    return [];
  }

  const groups = new Map<string, SearchSuggestion[]>();

  suggestions.forEach((suggestion) => {
    if (!suggestion || typeof suggestion.text !== 'string') {
      return;
    }

    const key = suggestion.category?.trim() || '__default__';
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)?.push(suggestion);
  });

  return Array.from(groups.entries()).map(([key, items]) => ({
    heading: key === '__default__' ? defaultHeading : key,
    key,
    items,
  }));
}

export interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  search: NavBarSearch;
  onInteraction?: (event: string, payload: Record<string, unknown>) => void;
}

export function SearchPanel({
  isOpen,
  onClose,
  search,
  onInteraction,
}: SearchPanelProps) {
  const {
    placeholder = 'Search...',
    action,
    suggestions: presetSuggestions,
    recentSearches: presetRecent,
    panelVariant = 'overlay',
  } = search;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const initialRecent = useMemo(() => sanitizeRecent(presetRecent), [presetRecent]);
  const [recentSearches, setRecentSearches] = useState<string[]>(initialRecent);
  const [query, setQuery] = useState('');

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = sanitizeRecent(readStoredRecent());
    if (stored.length === 0) {
      return;
    }

    setRecentSearches((prev) => {
      const combined = sanitizeRecent([...stored, ...prev]);
      return combined;
    });
  }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const suggestions = useMemo(() => {
    if (!Array.isArray(presetSuggestions)) {
      return [] as SearchSuggestion[];
    }

    return presetSuggestions.filter((suggestion): suggestion is SearchSuggestion => {
      return suggestion && typeof suggestion.text === 'string' && suggestion.text.trim().length > 0;
    });
  }, [presetSuggestions]);

  const filteredSuggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return suggestions;
    }

    return suggestions.filter((suggestion) => {
      const textMatch = suggestion.text.toLowerCase().includes(trimmed);
      const categoryMatch = suggestion.category
        ? suggestion.category.toLowerCase().includes(trimmed)
        : false;
      return textMatch || categoryMatch;
    });
  }, [suggestions, query]);

  const suggestionGroups = useMemo(() => {
    return groupSuggestions(filteredSuggestions, 'Suggestions');
  }, [filteredSuggestions]);

  const updateRecentSearches = useCallback((searchTerm: string) => {
    setRecentSearches((prev) => {
      const next = sanitizeRecent([searchTerm, ...prev]);
      writeStoredRecent(next);
      return next;
    });
  }, []);

  const handleSearch = useCallback(
    (rawQuery: string, metadata?: SearchMetadata) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) {
        return;
      }

      updateRecentSearches(trimmed);

      onInteraction?.('search_submit', {
        query: trimmed,
        source: metadata?.source ?? 'input',
        suggestion: metadata?.suggestion,
        url: metadata?.url,
      });

      // Navigate to URL if suggestion has one, otherwise use action URL
      if (metadata?.url) {
        window.location.href = metadata.url;
      } else if (action) {
        const url = `${action}${action.includes('?') ? '&' : '?'}q=${encodeURIComponent(trimmed)}`;
        window.location.href = url;
      }

      onClose();
    },
    [action, onClose, onInteraction, updateRecentSearches],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSearch(query, { source: 'input' });
    },
    [handleSearch, query],
  );

  if (!isOpen) {
    return null;
  }

  const renderSearchActionItem = query.trim().length > 0;
  const showRecentGroup = !query.trim() && recentSearches.length > 0;
  const showSuggestionGroups = suggestionGroups.length > 0;

  const panelContent = (
    <div
      ref={panelRef}
      className={cn(
        'bg-background border border-border rounded-xl shadow-2xl overflow-hidden',
        panelVariant === 'fullscreen' && 'w-full h-full',
        panelVariant === 'overlay' && 'w-full max-w-2xl mx-auto',
        panelVariant === 'dropdown' && 'w-96',
      )}
    >
      <form onSubmit={handleSubmit}>
        <Command className="relative">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <CommandInput
              ref={inputRef}
              placeholder={placeholder}
              value={query}
              onValueChange={setQuery}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 shrink-0"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CommandList className="max-h-80 overflow-y-auto p-2">
            {renderSearchActionItem && (
              <CommandItem
                value={`search-${query}`}
                onSelect={() => handleSearch(query, { source: 'input' })}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-lg"
              >
                <span>Search for &quot;{query}&quot;</span>
                <CommandShortcut>Enter</CommandShortcut>
              </CommandItem>
            )}

            {renderSearchActionItem && (showRecentGroup || showSuggestionGroups) && (
              <CommandSeparator className="my-2" />
            )}

            {showRecentGroup && (
              <CommandGroup heading="Recent searches">
                {recentSearches.map((recent) => (
                  <CommandItem
                    key={`recent-${recent}`}
                    value={recent}
                    onSelect={() => handleSearch(recent, { source: 'recent' })}
                    onMouseDown={(e) => e.preventDefault()}
                    className="rounded-lg"
                  >
                    <span>{recent}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showRecentGroup && showSuggestionGroups && (
              <CommandSeparator className="my-2" />
            )}

            {showSuggestionGroups &&
              suggestionGroups.map((group) => (
                <CommandGroup key={group.key} heading={group.heading}>
                  {group.items.map((suggestion) => (
                    <CommandItem
                      key={`${group.key}-${suggestion.text}`}
                      value={suggestion.text}
                      onSelect={() =>
                        handleSearch(suggestion.text, {
                          source: 'suggestion',
                          suggestion,
                          url: suggestion.url,
                        })
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      className="rounded-lg"
                    >
                      <div className="flex flex-col">
                        <span>{suggestion.text}</span>
                        {suggestion.category && (
                          <span className="text-xs text-muted-foreground">
                            {suggestion.category}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}

            {!renderSearchActionItem && !showRecentGroup && !showSuggestionGroups && (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search...
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </form>
    </div>
  );

  // Render based on variant
  if (panelVariant === 'dropdown') {
    return (
      <div className="absolute top-full right-0 mt-2 z-50">
        {panelContent}
      </div>
    );
  }

  // Overlay and fullscreen variants use a backdrop
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm',
        panelVariant === 'fullscreen' ? 'p-0' : 'pt-20 px-4',
      )}
    >
      {panelContent}
    </div>
  );
}
