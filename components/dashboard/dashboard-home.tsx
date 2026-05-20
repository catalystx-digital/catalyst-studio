'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useImportActivity, type ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { DashboardTopBar } from './dashboard-top-bar';
import { ActiveImportsBanner } from './active-imports-banner';
import { WebsiteGrid, type SortOption, type FilterOption } from './website-grid';
import { CreateWebsiteModal } from './create-website-modal';
import { EmptyState } from './empty-state';
import { CommandPalette } from './command-palette';

interface DashboardHomeProps {
  isAuthenticated: boolean;
}

function getActiveImportsCount(imports: ImportActivityItem[]): number {
  return imports.filter((job) => {
    const isActive = job.state === 'active' || job.state === 'queued';
    const isProcessing = job.status === 'processing' || job.status === 'pending';
    return (isActive || isProcessing) && job.progress < 100;
  }).length;
}

export function DashboardHome({ isAuthenticated }: DashboardHomeProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Modal state
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createModalDefaultTab, setCreateModalDefaultTab] = useState<'ai' | 'import' | 'templates'>('ai');
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Import banner dismiss state
  const [isImportBannerDismissed, setImportBannerDismissed] = useState(false);

  // Fetch import activity for the banner
  const { data: importActivity = [] } = useImportActivity({ enabled: isAuthenticated });
  const activeImportsCount = useMemo(
    () => getActiveImportsCount(importActivity as ImportActivityItem[]),
    [importActivity]
  );

  // Show import banner if there are active imports and not dismissed
  const showImportBanner = isAuthenticated && activeImportsCount > 0 && !isImportBannerDismissed;

  // Reset banner dismiss state when new imports start
  useEffect(() => {
    if (activeImportsCount > 0) {
      setImportBannerDismissed(false);
    }
  }, [activeImportsCount]);

  // Command palette keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show welcome toast after accepting an invitation
  useEffect(() => {
    const welcome = searchParams?.get('welcome');
    const websiteName = searchParams?.get('website');

    if (welcome === 'invited') {
      toast({
        title: 'Welcome to the team!',
        description: `You now have access to ${websiteName || 'the team'}. Check your websites below.`,
      });
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, toast]);

  // Sync search query with URL params
  useEffect(() => {
    const urlQuery = searchParams?.get('q') ?? '';
    const urlSort = searchParams?.get('sort') as SortOption | null;
    const urlFilter = searchParams?.get('filter') as FilterOption | null;

    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
    if (urlSort && ['recent', 'name', 'status'].includes(urlSort)) {
      setSortBy(urlSort);
    }
    if (urlFilter && ['all', 'active', 'importing', 'draft'].includes(urlFilter)) {
      setFilterBy(urlFilter);
    }
  }, [searchParams]);

  // Update URL when search/sort/filter changes
  const updateUrlParams = useCallback(
    (query: string, sort: SortOption, filter: FilterOption) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (sort !== 'recent') params.set('sort', sort);
      if (filter !== 'all') params.set('filter', filter);

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.replace(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrlParams(query, sortBy, filterBy);
    },
    [sortBy, filterBy, updateUrlParams]
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      setSortBy(sort);
      updateUrlParams(searchQuery, sort, filterBy);
    },
    [searchQuery, filterBy, updateUrlParams]
  );

  const handleFilterChange = useCallback(
    (filter: FilterOption) => {
      setFilterBy(filter);
      updateUrlParams(searchQuery, sortBy, filter);
    },
    [searchQuery, sortBy, updateUrlParams]
  );

  const handleNewWebsite = useCallback(() => {
    setCreateModalDefaultTab('ai');
    setCreateModalOpen(true);
  }, []);

  const handleImportWebsite = useCallback(() => {
    setCreateModalDefaultTab('import');
    setCreateModalOpen(true);
  }, []);

  const handleWebsiteCreated = useCallback((websiteId: string) => {
    // Optionally track created website or perform actions
    console.log('Website created:', websiteId);
  }, []);

  const handleDismissImportBanner = useCallback(() => {
    setImportBannerDismissed(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Bar - 60px */}
      <DashboardTopBar
        onNewWebsite={handleNewWebsite}
        onImportWebsite={handleImportWebsite}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        isAuthenticated={isAuthenticated}
      />

      {/* Import Banner - 50px (conditional) */}
      {showImportBanner && (
        <ActiveImportsBanner
          imports={importActivity as ImportActivityItem[]}
          onDismiss={handleDismissImportBanner}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 px-4 lg:px-6 py-6',
          !isAuthenticated && 'flex items-center justify-center'
        )}
        aria-label="Dashboard content"
      >
        {isAuthenticated ? (
          <div className="mx-auto max-w-7xl">
            <WebsiteGrid
              searchQuery={searchQuery}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              filterBy={filterBy}
              onFilterChange={handleFilterChange}
              isAuthenticated={isAuthenticated}
              emptyState={
                <EmptyState
                  onNewWebsite={handleNewWebsite}
                  onImportWebsite={handleImportWebsite}
                />
              }
            />
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <p>Please sign in to view your websites.</p>
          </div>
        )}
      </main>

      {/* Create Website Modal */}
      <CreateWebsiteModal
        open={isCreateModalOpen}
        onOpenChange={setCreateModalOpen}
        defaultTab={createModalDefaultTab}
        onWebsiteCreated={handleWebsiteCreated}
      />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNewWebsite={handleNewWebsite}
        onImportWebsite={handleImportWebsite}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
