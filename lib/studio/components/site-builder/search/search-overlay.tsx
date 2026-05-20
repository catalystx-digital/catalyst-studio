'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Command as CommandPrimitive } from 'cmdk';
import { usePageSearch } from '@/lib/studio/hooks/use-page-search';
import { useJumpToNode } from '@/lib/studio/hooks/use-jump-to-node';
import { cn } from '@/lib/utils';

interface SearchOverlayProps {
  className?: string;
}

/**
 * Search overlay for site-builder canvas
 * Opens with Ctrl+K / Cmd+K, allows searching and jumping to pages
 * SEARCH INTEGRATION: Uses server-side search with jump-to-node for viewport animation
 * BUG-009 FIX: Stores viewport state before search for restoration
 * UX-003 FIX: Includes clear (X) button on search input
 */
export function SearchOverlay({ className }: SearchOverlayProps) {
  const { query, results, isLoading, isOpen, search, closeSearch, restoreViewport } = usePageSearch();
  const { jumpToHome, jumpToNode } = useJumpToNode();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle selection - uses useJumpToNode for proper viewport animation
  const handleSelect = React.useCallback(
    (structureId: string) => {
      if (structureId === '__home__') {
        jumpToHome();
        closeSearch();
      } else {
        // Use jumpToNode from useJumpToNode hook for proper viewport animation
        jumpToNode(structureId);
        closeSearch();
      }
    },
    [jumpToNode, jumpToHome, closeSearch]
  );

  // UX-003 FIX: Handle clear button click
  const handleClear = React.useCallback(() => {
    search('');
    inputRef.current?.focus();
  }, [search]);

  // BUG-009 FIX: Handle close without selection - restore viewport
  const handleClose = React.useCallback(() => {
    restoreViewport();
    closeSearch();
  }, [restoreViewport, closeSearch]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={cn(
          'overflow-hidden p-0 shadow-lg max-w-xl [&>button]:hidden',
          className
        )}
      >
        {/* Visually hidden title for screen reader accessibility */}
        <DialogTitle className="sr-only">Search pages</DialogTitle>
        <Command className="border-0" shouldFilter={false}>
          {/* UX-003 FIX: Custom search input with clear button */}
          <div className="flex items-center border-b border-border px-3">
            <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
              ref={inputRef}
              placeholder="Search pages..."
              value={query}
              onValueChange={search}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-2 rounded-sm opacity-50 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Clear search"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <CommandList className="max-h-[300px]">
            {/* Loading state */}
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {/* Empty state */}
            {!isLoading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No pages found.</CommandEmpty>
            )}

            {/* Quick actions - show when no query */}
            {query.length < 2 && (
              <CommandGroup heading="Quick Actions">
                <CommandItem onSelect={() => handleSelect('__home__')}>
                  <HomeIcon className="mr-2 h-4 w-4" />
                  <span>Jump to Home</span>
                  <CommandShortcut>Ctrl+H</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}

            {/* Search results */}
            {!isLoading && results.length > 0 && (
              <CommandGroup heading="Pages">
                {results.map((result) => (
                  <CommandItem
                    key={result.structureId}
                    value={result.structureId}
                    onSelect={() => handleSelect(result.structureId)}
                  >
                    <PageIcon className="mr-2 h-4 w-4 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate font-medium">
                        {result.pageTitle || result.pageSlug || 'Untitled'}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {result.fullPath || '/'}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <div className="flex gap-4">
              <span>
                <kbd className="rounded bg-muted px-1 font-mono">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="rounded bg-muted px-1 font-mono">↵</kbd> select
              </span>
              <span>
                <kbd className="rounded bg-muted px-1 font-mono">esc</kbd> close
              </span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Simple icon components
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// UX-003 FIX: Search icon for input
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// UX-003 FIX: X icon for clear button
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
