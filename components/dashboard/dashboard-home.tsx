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
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Eye, Layers, Palette, Rocket, Sparkles, Key } from 'lucide-react';

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
      if (!pathname) {
        return;
      }

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
            {/* Demo Welcome Hero + Quick Feature Discovery */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-catalyst-orange/10 px-3 py-1 text-xs font-medium text-catalyst-orange mb-3">
                    <Sparkles className="h-3.5 w-3.5" />
                    SEE IT IN ACTION
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome to the Catalyst Studio demo</h1>
                  <p className="mt-2 max-w-2xl text-gray-400">
                    One command (<code className="font-mono text-catalyst-orange/90">npm run verify:quickstart</code>) gives you a fully functional seeded site.
                    Explore the visual builder + the headless GraphQL UCS API (one CMS model, visual edits + queryable live from any app) — no API keys required for the core demo.
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    This is a real, editable demo website. Changes you make in the builder are live immediately in preview and persist until the next seed.
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Try the headless side of the exact same CMS model: <Link href="/studio/settings?websiteId=test-website&tab=api" className="inline-flex items-center font-medium text-catalyst-orange hover:text-catalyst-orange/90 underline-offset-2 hover:underline">Explore Headless GraphQL (UCS) <ArrowRight className="ml-1 h-3 w-3" /></Link> — query live content from any app via the UCS endpoint used by preview &amp; builder.
                  </p>
                </div>
                <Button
                  onClick={handleNewWebsite}
                  className="shrink-0 bg-catalyst-orange hover:bg-catalyst-orange/90 text-gray-950 font-semibold"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create another with AI
                </Button>
              </div>

              {/* Prominent Quick Demo Links / Try These Features */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Rocket className="h-4 w-4 text-catalyst-orange" />
                  Try these features with the seeded demo site
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Visual Site Builder */}
                <Card className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-catalyst-orange" />
                      <CardTitle className="text-base text-white">Visual Site Builder</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm text-gray-400 mb-3">
                      Drag-and-drop hierarchy, 60 production CMS components, global shared components, rich props, undo/redo, and an in-canvas AI assistant.
                    </CardDescription>
                    <Link
                      href="/studio/site-builder?websiteId=test-website"
                      className="inline-flex items-center text-sm font-medium text-catalyst-orange hover:text-catalyst-orange/90 group-hover:underline"
                    >
                      Open the visual editor <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>

                {/* Live Preview */}
                <Card className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-catalyst-orange" />
                      <CardTitle className="text-base text-white">Live Database-Backed Preview</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm text-gray-400 mb-3">
                      Real renderer backed by the database — exactly what headless consumers and the public site see. Responsive, instant, no rebuilds.
                    </CardDescription>
                    <Link
                      href="/studio/preview?websiteId=test-website"
                      className="inline-flex items-center text-sm font-medium text-catalyst-orange hover:text-catalyst-orange/90 group-hover:underline"
                    >
                      Open live preview <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>

                {/* Content Types / CMS */}
                <Card className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-catalyst-orange" />
                      <CardTitle className="text-base text-white">Content Types &amp; CMS</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm text-gray-400 mb-3">
                      Model structured data with Content Types. Powers pages + reusable components. The same model drives preview, export, and the GraphQL headless API.
                    </CardDescription>
                    <Link
                      href="/studio/content-types?websiteId=test-website"
                      className="inline-flex items-center text-sm font-medium text-catalyst-orange hover:text-catalyst-orange/90 group-hover:underline"
                    >
                      Explore content modeling <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>

                {/* Export / Headless */}
                <Card className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-catalyst-orange" />
                      <CardTitle className="text-base text-white">Export &amp; Headless</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm text-gray-400 mb-3">
                      Model once in the visual builder (or Content Types). Push to Optimizely etc, or serve via built-in UCS GraphQL API. Same resolved content model you edit visually is available headlessly.
                    </CardDescription>
                    <Link
                      href="/studio/deployment?websiteId=test-website"
                      className="inline-flex items-center text-sm font-medium text-catalyst-orange hover:text-catalyst-orange/90 group-hover:underline"
                    >
                      View export &amp; headless <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                    <div className="mt-1.5">
                      <Link
                        href="/studio/settings?websiteId=test-website&tab=api"
                        className="inline-flex items-center text-xs font-medium text-catalyst-orange/90 hover:text-catalyst-orange group-hover:underline"
                      >
                        <Key className="mr-1 h-3 w-3" /> Explore Headless GraphQL (UCS) on seeded test site
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

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
