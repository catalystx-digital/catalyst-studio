'use client';

/**
 * Studio Studio Layout
 *
 * Shared layout for all /studio/* pages.
 * Provides website context and navigation.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WebsiteContextProvider } from '@/lib/context/website-context';
import { ContentTypeProvider } from '@/lib/context/content-type-context';
import { StudioNavigationSidebar } from '@/lib/studio/components/navigation/studio-navigation-sidebar';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function StudioStudioLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const websiteId = searchParams.get('websiteId');

  // If no websiteId, render without website context (account-level view)
  if (!websiteId) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <StudioNavigationSidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <WebsiteContextProvider websiteId={websiteId}>
      <ContentTypeProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <StudioNavigationSidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </ContentTypeProvider>
    </WebsiteContextProvider>
  );
}

export default function StudioStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <StudioStudioLayoutContent>{children}</StudioStudioLayoutContent>
    </Suspense>
  );
}
