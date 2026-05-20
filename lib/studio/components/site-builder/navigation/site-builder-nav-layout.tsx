'use client';

/**
 * Site Builder Navigation Layout
 *
 * Main layout wrapper that replaces the standard sidebar for site-builder routes.
 * Provides top bar, icon rail, panels, and bottom bar.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PanelProvider, usePanelState } from './panel-provider';
import { SiteBuilderTopBar } from './site-builder-top-bar';
import { SiteBuilderIconRail } from './site-builder-icon-rail';
import { SiteBuilderPanel } from './site-builder-panel';
import { SiteBuilderBottomBar } from './site-builder-bottom-bar';
import { PagesPanel } from './pages-panel';

interface SiteBuilderNavLayoutProps {
  children: React.ReactNode;
  websiteId: string | null;
  /** Called when Help is clicked */
  onHelpClick?: () => void;
  /** Called when Shortcuts is clicked */
  onShortcutsClick?: () => void;
  /** Called when History is clicked */
  onOpenHistory?: () => void;
  /** Called when Content Types is clicked */
  onOpenContentTypes?: () => void;
  /** Called when Generate Proposal is clicked */
  onGenerateProposal?: () => void;
  /** Called when AI Suggestions is clicked */
  onAISuggestions?: () => void;
  /** Current zoom level */
  zoom?: number;
  /** Zoom control callbacks */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onZoomTo?: (level: number) => void;
  /** Whether auto layout is enabled */
  autoLayoutEnabled?: boolean;
  /** Toggle auto layout */
  onAutoLayoutToggle?: () => void;
}

function SiteBuilderNavLayoutInner({
  children,
  websiteId,
  onHelpClick,
  onShortcutsClick,
  onOpenHistory,
  onOpenContentTypes,
  onGenerateProposal,
  onAISuggestions,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onZoomTo,
  autoLayoutEnabled,
  onAutoLayoutToggle,
}: SiteBuilderNavLayoutProps) {
  const {
    activePanel,
    isPinned,
    isFullCanvasMode,
    closePanel,
    togglePin,
    togglePanel,
    toggleFullCanvasMode,
  } = usePanelState();

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine responsive state
  const responsiveState = useMemo(() => {
    if (windowWidth < 1024) return 'mobile';
    if (windowWidth < 1280) return 'compact';
    if (windowWidth < 1440) return 'medium';
    return 'full';
  }, [windowWidth]);

  // Allow pinning only on larger screens
  const allowPin = responsiveState === 'full';

  // Force unpin on smaller screens
  useEffect(() => {
    if (!allowPin && isPinned) {
      togglePin();
    }
  }, [allowPin, isPinned, togglePin]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMod = event.ctrlKey || event.metaKey;

      // Ctrl/Cmd + B: Toggle Pages panel
      if (isMod && event.key === 'b') {
        event.preventDefault();
        togglePanel('pages');
      }

      // Ctrl/Cmd + \: Toggle full canvas mode
      if (isMod && event.key === '\\') {
        event.preventDefault();
        toggleFullCanvasMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel, toggleFullCanvasMode]);

  // Show desktop required message for small screens
  if (responsiveState === 'mobile') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Desktop Required</h1>
          <p className="text-muted-foreground mb-4">
            The Site Builder requires a larger screen to function properly.
            Please use a device with a minimum width of 1024 pixels.
          </p>
          <p className="text-sm text-muted-foreground">
            Current width: {windowWidth}px
          </p>
        </div>
      </div>
    );
  }

  const showIconRail = !isFullCanvasMode;
  const showTopBar = !isFullCanvasMode;
  const showBottomBar = !isFullCanvasMode;
  const isPanelOpen = activePanel === 'pages';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      {showTopBar && (
        <SiteBuilderTopBar
          websiteId={websiteId}
          onHelpClick={onHelpClick}
          onShortcutsClick={onShortcutsClick}
          onGenerateProposal={onGenerateProposal}
          onAISuggestions={onAISuggestions}
        />
      )}

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon Rail */}
        {showIconRail && (
          <SiteBuilderIconRail
            websiteId={websiteId}
            onHelpClick={onHelpClick}
          />
        )}

        {/* Panel (conditionally rendered) */}
        {isPinned && isPanelOpen && (
          <SiteBuilderPanel
            isOpen={isPanelOpen}
            isPinned={isPinned}
            onClose={closePanel}
            onPinToggle={togglePin}
            title="Pages"
            allowPin={allowPin}
          >
            <PagesPanel
              onSelectPage={(pageId) => {
                // Let the canvas handle the selection
              }}
            />
          </SiteBuilderPanel>
        )}

        {/* Canvas Area */}
        <main
          className={cn(
            'flex-1 overflow-hidden relative',
            'transition-all duration-200 motion-reduce:transition-none'
          )}
        >
          {children}
        </main>

        {/* Floating Panel (when not pinned) */}
        {!isPinned && (
          <SiteBuilderPanel
            isOpen={isPanelOpen}
            isPinned={isPinned}
            onClose={closePanel}
            onPinToggle={togglePin}
            title="Pages"
            allowPin={allowPin}
          >
            <PagesPanel
              onSelectPage={(pageId) => {
                // Let the canvas handle the selection
              }}
            />
          </SiteBuilderPanel>
        )}
      </div>

      {/* Bottom Bar */}
      {showBottomBar && (
        <SiteBuilderBottomBar
          onOpenContentTypes={onOpenContentTypes}
          onOpenHistory={onOpenHistory}
          onOpenShortcuts={onShortcutsClick}
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFitView={onFitView}
          onZoomTo={onZoomTo}
          autoLayoutEnabled={autoLayoutEnabled}
          onAutoLayoutToggle={onAutoLayoutToggle}
        />
      )}
    </div>
  );
}

export function SiteBuilderNavLayout(props: SiteBuilderNavLayoutProps) {
  return (
    <PanelProvider>
      <SiteBuilderNavLayoutInner {...props} />
    </PanelProvider>
  );
}
