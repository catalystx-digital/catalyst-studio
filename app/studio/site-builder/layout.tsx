'use client';

/**
 * Site Builder Layout
 *
 * Layout for /studio/site-builder pages.
 * Provides website context and canvas-focused navigation.
 */

import { Suspense, useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WebsiteContextProvider } from '@/lib/context/website-context';
import { ContentTypeProvider } from '@/lib/context/content-type-context';
import { SiteBuilderNavLayout } from '@/lib/studio/components/site-builder/navigation';
import { Monitor, Smartphone } from 'lucide-react';

// Minimum viewport width for Site Builder (1024px = tablet landscape / small desktop)
const MIN_VIEWPORT_WIDTH = 1024;

/**
 * SB-LOAD-05: Desktop Required Overlay
 * Shows a blocking overlay on mobile/small screens
 */
function DesktopRequiredOverlay() {
  const [isTooSmall, setIsTooSmall] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkViewport = () => {
      setIsTooSmall(window.innerWidth < MIN_VIEWPORT_WIDTH);
    };

    // Initial check
    checkViewport();

    // Listen for resize
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Don't render during SSR or if viewport is large enough
  if (!mounted || !isTooSmall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        {/* Icon comparison */}
        <div className="flex items-center justify-center gap-4">
          <div className="relative">
            <Smartphone className="h-12 w-12 text-muted-foreground" />
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-destructive-foreground text-xs font-bold">✕</span>
            </div>
          </div>
          <span className="text-2xl text-muted-foreground">→</span>
          <div className="relative">
            <Monitor className="h-16 w-16 text-primary" />
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground">
          Desktop Required
        </h1>

        {/* Description */}
        <p className="text-muted-foreground">
          The Site Builder is designed for desktop use. Please switch to a device with a larger screen (at least {MIN_VIEWPORT_WIDTH}px wide) for the best experience.
        </p>

        {/* Current viewport info */}
        <div className="text-sm text-muted-foreground/70 bg-muted/50 rounded-lg p-3">
          <p>Current viewport: <span className="font-mono">{typeof window !== 'undefined' ? window.innerWidth : 0}px</span></p>
          <p>Required: <span className="font-mono">{MIN_VIEWPORT_WIDTH}px</span> or wider</p>
        </div>

        {/* Suggestion */}
        <p className="text-sm text-muted-foreground">
          Tip: You can also rotate your tablet to landscape mode or zoom out your browser.
        </p>
      </div>
    </div>
  );
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface LayoutContentProps {
  children: React.ReactNode;
  websiteId: string | null;
}

function NavLayoutContent({ children, websiteId }: LayoutContentProps) {
  const router = useRouter();
  const [autoLayoutEnabled, setAutoLayoutEnabled] = useState(true);
  const hasAutoLayoutToggleMounted = useRef(false);

  const handleHelpClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-help'));
  }, []);

  const handleShortcutsClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sitebuilder:open-shortcuts'));
  }, []);

  const handleOpenHistory = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sitebuilder:open-history'));
  }, []);

  const handleOpenContentTypes = useCallback(() => {
    const path = websiteId
      ? `/studio/content-types?websiteId=${websiteId}`
      : '/studio/content-types';
    router.push(path);
  }, [router, websiteId]);

  const handleGenerateProposal = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sitebuilder:export-proposal'));
  }, []);

  const handleAISuggestions = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sitebuilder:ai-suggestions'));
  }, []);

  const handleAutoLayoutToggle = useCallback(() => {
    setAutoLayoutEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!hasAutoLayoutToggleMounted.current) {
      hasAutoLayoutToggleMounted.current = true;
      return;
    }

    window.dispatchEvent(
      new CustomEvent('sitebuilder:auto-layout-toggle', {
        detail: { enabled: autoLayoutEnabled },
      })
    );
  }, [autoLayoutEnabled]);

  return (
    <SiteBuilderNavLayout
      websiteId={websiteId}
      onHelpClick={handleHelpClick}
      onShortcutsClick={handleShortcutsClick}
      onOpenHistory={handleOpenHistory}
      onOpenContentTypes={handleOpenContentTypes}
      onGenerateProposal={handleGenerateProposal}
      onAISuggestions={handleAISuggestions}
      autoLayoutEnabled={autoLayoutEnabled}
      onAutoLayoutToggle={handleAutoLayoutToggle}
    >
      {children}
    </SiteBuilderNavLayout>
  );
}

function SiteBuilderLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const websiteId = searchParams.get('websiteId');

  // If no websiteId, render without website context
  if (!websiteId) {
    return (
      <NavLayoutContent websiteId={null}>
        {children}
      </NavLayoutContent>
    );
  }

  // With website context
  return (
    <WebsiteContextProvider websiteId={websiteId}>
      <ContentTypeProvider>
        <NavLayoutContent websiteId={websiteId}>
          {children}
        </NavLayoutContent>
      </ContentTypeProvider>
    </WebsiteContextProvider>
  );
}

export default function SiteBuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* SB-LOAD-05: Desktop Required viewport overlay */}
      <DesktopRequiredOverlay />
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }>
        <SiteBuilderLayoutContent>{children}</SiteBuilderLayoutContent>
      </Suspense>
    </>
  );
}
