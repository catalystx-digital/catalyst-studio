'use client';

/**
 * Site Builder Panel
 *
 * Slide-over panel container with pin/close functionality.
 * Width: 280px
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pin, PinOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SiteBuilderPanelProps {
  isOpen: boolean;
  isPinned: boolean;
  onClose: () => void;
  onPinToggle: () => void;
  title: string;
  children: React.ReactNode;
  /** Disable pinning (e.g., on smaller screens) */
  allowPin?: boolean;
}

export function SiteBuilderPanel({
  isOpen,
  isPinned,
  onClose,
  onPinToggle,
  title,
  children,
  allowPin = true,
}: SiteBuilderPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap for floating panel
  useEffect(() => {
    if (isOpen && !isPinned && panelRef.current) {
      // Focus the panel when it opens in floating mode
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen, isPinned]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (!isPinned) {
      onClose();
    }
  }, [isPinned, onClose]);

  // Announce panel state to screen readers
  useEffect(() => {
    if (isOpen) {
      const message = `${title} panel opened`;
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - only shown when floating (not pinned) */}
      {!isPinned && (
        <div
          className={cn(
            'fixed inset-0 z-30 bg-black/20 transition-opacity duration-150',
            'motion-reduce:transition-none'
          )}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'z-40 h-full w-[280px] bg-card border-r border-border flex flex-col',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          isPinned ? 'relative' : 'fixed left-11 top-12 bottom-10 shadow-xl',
          isOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        )}
        role={isPinned ? 'complementary' : 'dialog'}
        aria-modal={!isPinned}
        aria-label={title}
      >
        {/* Panel Header */}
        <div className="h-11 border-b border-border flex items-center justify-between px-3 flex-shrink-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {allowPin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={onPinToggle}
                      aria-label={isPinned ? 'Unpin panel' : 'Pin panel'}
                      aria-pressed={isPinned}
                    >
                      {isPinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{isPinned ? 'Unpin panel' : 'Pin panel'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Close panel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
