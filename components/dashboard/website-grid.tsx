'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Loader2, RefreshCw, LayoutGrid, List, Grid3X3, CheckSquare, Square, Trash2, X } from 'lucide-react';
import { useWebsites, useDeleteWebsite } from '@/lib/api/hooks/use-websites';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { useImportActivity, type ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteWebsiteDialog } from '@/components/ui/delete-website-dialog';
import { useToast } from '@/components/ui/use-toast';
import { WebsiteCard, type WebsiteAction } from './website-card';
import { useDensity, densityConfig, type DensityOption } from './density-context';
import { cn } from '@/lib/utils';

export type SortOption = 'recent' | 'name' | 'status';
export type FilterOption = 'all' | 'active' | 'importing' | 'draft';

interface Website {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  updatedAt: string | Date;
  metadata?: Record<string, unknown> | null;
}

interface WebsiteGridProps {
  searchQuery?: string;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  filterBy?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  isAuthenticated?: boolean;
  emptyState?: React.ReactNode;
}

function buildImportMap(activity: ImportActivityItem[] = []) {
  const map = new Map<string, ImportActivityItem>();
  for (const job of activity) {
    const existing = map.get(job.websiteId);
    if (!existing) {
      map.set(job.websiteId, job);
      continue;
    }
    const existingUpdated = new Date(existing.updatedAt).getTime();
    const jobUpdated = new Date(job.updatedAt).getTime();
    if (jobUpdated >= existingUpdated) {
      map.set(job.websiteId, job);
    }
  }
  return map;
}

function filterWebsitesBySearch(websites: Website[], searchQuery: string): Website[] {
  if (!searchQuery.trim()) return websites;
  const query = searchQuery.toLowerCase();
  return websites.filter((website) => {
    const name = website.name?.toLowerCase() ?? '';
    const description = website.description?.toLowerCase() ?? '';
    return name.includes(query) || description.includes(query);
  });
}

function filterWebsitesByStatus(
  websites: Website[],
  filterBy: FilterOption,
  importMap: Map<string, ImportActivityItem>
): Website[] {
  if (filterBy === 'all') return websites;

  return websites.filter((website) => {
    const importJob = importMap.get(website.id);
    // Match the active imports banner logic: must be active/queued AND progress < 100
    const isActiveState = importJob && (importJob.state === 'active' || importJob.state === 'queued');
    const isProcessingStatus = importJob && (importJob.status === 'processing' || importJob.status === 'pending');
    const isInProgress = importJob && importJob.progress < 100;
    const isImporting = (isActiveState || isProcessingStatus) && isInProgress;

    const metadata = website.metadata as { publishedAt?: string | null } | null;
    const isPublished = Boolean(metadata?.publishedAt);

    switch (filterBy) {
      case 'active':
        return isPublished && !isImporting;
      case 'importing':
        return isImporting;
      case 'draft':
        return !isPublished && !isImporting;
      default:
        return true;
    }
  });
}

const filterLabels: Record<FilterOption, string> = {
  all: 'All',
  active: 'Active',
  importing: 'Importing',
  draft: 'Draft',
};

function isActivelyImporting(importJob: ImportActivityItem | undefined): boolean {
  if (!importJob) return false;
  const isActiveState = importJob.state === 'active' || importJob.state === 'queued';
  const isProcessingStatus = importJob.status === 'processing' || importJob.status === 'pending';
  const isInProgress = importJob.progress < 100;
  return (isActiveState || isProcessingStatus) && isInProgress;
}

function sortWebsites(
  websites: Website[],
  sortBy: SortOption,
  importMap: Map<string, ImportActivityItem>
): Website[] {
  const sorted = [...websites];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'status':
      // Sort by: actively importing first, then by date
      return sorted.sort((a, b) => {
        const aImporting = isActivelyImporting(importMap.get(a.id));
        const bImporting = isActivelyImporting(importMap.get(b.id));
        if (aImporting && !bImporting) return -1;
        if (!aImporting && bImporting) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    case 'recent':
    default:
      return sorted.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
  }
}

const sortLabels: Record<SortOption, string> = {
  recent: 'Most Recent',
  name: 'Name (A-Z)',
  status: 'Status',
};

const densityIcons: Record<DensityOption, React.ReactNode> = {
  comfortable: <LayoutGrid className="h-4 w-4" />,
  compact: <Grid3X3 className="h-4 w-4" />,
  dense: <List className="h-4 w-4" />,
};

const densityLabels: Record<DensityOption, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
  dense: 'Dense',
};

export function WebsiteGrid({
  searchQuery = '',
  sortBy = 'recent',
  onSortChange,
  filterBy = 'all',
  onFilterChange,
  isAuthenticated = true,
  emptyState,
}: WebsiteGridProps) {
  const router = useRouter();
  const { toast } = useToast();
  const deleteWebsiteMutation = useDeleteWebsite();
  const { density, setDensity } = useDensity();
  const currentDensityConfig = densityConfig[density];

  const [dialogWebsite, setDialogWebsite] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isManualRefreshInFlight, setManualRefreshInFlight] = useState(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const shouldFetch = isAuthenticated;

  const {
    data: websites = [],
    isLoading: isWebsitesLoading,
    isFetching: isWebsitesFetching,
    error: websitesError,
    refetch: refetchWebsites,
  } = useWebsites({ refetchInterval: 60_000, enabled: shouldFetch });

  const {
    data: importActivity = [],
    isLoading: isImportsLoading,
    isFetching: isImportsFetching,
    error: importError,
    refetch: refetchImportActivity,
  } = useImportActivity({ enabled: shouldFetch });

  const importItems = importActivity as ImportActivityItem[] | undefined;
  const importsByWebsite = useMemo(() => buildImportMap(importItems), [importItems]);

  // Filter and sort websites
  const processedWebsites = useMemo(() => {
    const searchFiltered = filterWebsitesBySearch(websites as Website[], searchQuery);
    const statusFiltered = filterWebsitesByStatus(searchFiltered, filterBy, importsByWebsite);
    return sortWebsites(statusFiltered, sortBy, importsByWebsite);
  }, [websites, searchQuery, filterBy, sortBy, importsByWebsite]);

  const handleWebsiteClick = useCallback(
    (websiteId: string) => {
      const destination = getStudioWebsiteRoute(websiteId, { legacyView: 'overview' });
      router.push(destination);
    },
    [router]
  );

  const handleWebsiteAction = useCallback(
    (websiteId: string, action: WebsiteAction) => {
      const website = websites.find((w) => w.id === websiteId);
      switch (action) {
        case 'edit':
          router.push(getStudioWebsiteRoute(websiteId, { legacyView: 'overview' }));
          break;
        case 'team':
          router.push(`/studio/team?websiteId=${websiteId}`);
          break;
        case 'settings':
          router.push(`/studio/settings?websiteId=${websiteId}`);
          break;
        case 'design':
          router.push(getStudioWebsiteRoute(websiteId, { legacyView: 'design' }));
          break;
        case 'preview':
          router.push(`/studio/preview?websiteId=${websiteId}`);
          break;
        case 'delete':
          if (website) {
            setDialogWebsite({ id: website.id, name: website.name });
            setDeleteDialogOpen(true);
          }
          break;
      }
    },
    [router, websites]
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setDeleteDialogOpen(open);
      if (!open) {
        setDialogWebsite(null);
        deleteWebsiteMutation.reset();
      }
    },
    [deleteWebsiteMutation]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!dialogWebsite) return;

    const websiteName = dialogWebsite.name;

    try {
      const result = await deleteWebsiteMutation.mutateAsync(dialogWebsite.id);
      toast({
        title: 'Website deleted',
        description: result?.message ?? `"${websiteName}" removed from your dashboard.`,
      });
      handleDialogOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({
        title: 'Unable to delete website',
        description,
        variant: 'destructive',
      });
    }
  }, [deleteWebsiteMutation, dialogWebsite, toast, handleDialogOpenChange]);

  const handleManualRefresh = useCallback(async () => {
    if (!shouldFetch || isManualRefreshInFlight) return;

    setManualRefreshInFlight(true);
    try {
      await Promise.allSettled([refetchWebsites(), refetchImportActivity()]);
    } finally {
      setManualRefreshInFlight(false);
    }
  }, [shouldFetch, isManualRefreshInFlight, refetchWebsites, refetchImportActivity]);

  // Bulk selection handlers
  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Exiting selection mode - clear selections
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const handleToggleWebsiteSelection = useCallback((websiteId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(websiteId);
      } else {
        next.delete(websiteId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(processedWebsites.map((w) => w.id));
    setSelectedIds(allIds);
  }, [processedWebsites]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsBulkDeleting(true);
    const idsToDelete = Array.from(selectedIds);
    const results = await Promise.allSettled(
      idsToDelete.map((id) => deleteWebsiteMutation.mutateAsync(id))
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.filter((r) => r.status === 'rejected').length;

    if (successCount > 0) {
      toast({
        title: `${successCount} website${successCount > 1 ? 's' : ''} deleted`,
        description: failCount > 0 ? `${failCount} failed to delete.` : undefined,
      });
    }

    if (failCount > 0 && successCount === 0) {
      toast({
        title: 'Failed to delete websites',
        description: 'An error occurred while deleting.',
        variant: 'destructive',
      });
    }

    setIsBulkDeleting(false);
    setIsBulkDeleteDialogOpen(false);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [selectedIds, deleteWebsiteMutation, toast]);

  const selectedCount = selectedIds.size;
  const allSelected = processedWebsites.length > 0 && selectedCount === processedWebsites.length;

  const deleteErrorMessage =
    deleteWebsiteMutation.error instanceof Error
      ? deleteWebsiteMutation.error.message
      : undefined;

  const loading = shouldFetch && (isWebsitesLoading || isImportsLoading);
  const loadError = shouldFetch ? websitesError || importError : null;
  const isEmpty = shouldFetch && processedWebsites.length === 0;
  const isRefreshing = isManualRefreshInFlight || isWebsitesFetching || isImportsFetching;
  const isSearchEmpty = searchQuery && processedWebsites.length === 0 && websites.length > 0;
  const isFilterEmpty = !searchQuery && filterBy !== 'all' && processedWebsites.length === 0 && websites.length > 0;

  if (!shouldFetch) {
    return null;
  }

  // Loading State
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Your Websites</h2>
          </div>
          <Button variant="outline" size="sm" disabled className="text-gray-400">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 h-48 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-800 rounded" />
                  <div className="h-4 bg-gray-800 rounded w-2/3" />
                </div>
                <div className="h-3 bg-gray-800 rounded w-1/2" />
                <div className="h-2 bg-gray-800 rounded w-full" />
                <div className="flex gap-2 mt-auto pt-4">
                  <div className="h-8 bg-gray-800 rounded w-16" />
                  <div className="h-8 bg-gray-800 rounded w-8" />
                  <div className="h-8 bg-gray-800 rounded w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Unable to load websites.';
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-red-200">
        <h2 className="text-lg font-semibold mb-2">Unable to load websites</h2>
        <p className="text-sm text-red-100/80">{message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          className="mt-4 border-red-500/40 text-red-200 hover:bg-red-500/10"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // Empty State (no websites at all) - show create/import options
  if (isEmpty && !searchQuery && !isFilterEmpty) {
    return emptyState ?? null;
  }

  // Search Empty State
  if (isSearchEmpty) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">
              Your Websites <span className="text-gray-500">({websites.length})</span>
            </h2>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/50 p-10 text-center">
          <p className="text-gray-400">
            No websites match "<span className="text-white">{searchQuery}</span>"
          </p>
          <p className="text-sm text-gray-500 mt-2">Try a different search term</p>
        </div>
      </div>
    );
  }

  // Filter Empty State - has websites but none match the selected filter
  if (isFilterEmpty) {
    const filterMessages: Record<FilterOption, { title: string; description: string }> = {
      all: { title: '', description: '' },
      active: {
        title: 'No active websites',
        description: 'Publish a website to see it here. Active websites are live and accessible to visitors.',
      },
      importing: {
        title: 'No imports in progress',
        description: 'All imports have completed. Start a new import to see progress here.',
      },
      draft: {
        title: 'No draft websites',
        description: 'All your websites are either published or currently importing.',
      },
    };

    const message = filterMessages[filterBy];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">
              Your Websites <span className="text-gray-500">({websites.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter Chips */}
            {onFilterChange && (
              <div className="flex items-center gap-1">
                {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                  <Button
                    key={option}
                    variant={filterBy === option ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onFilterChange(option)}
                    className={
                      filterBy === option
                        ? 'bg-catalyst-orange text-gray-950 hover:bg-catalyst-orange/90'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  >
                    {filterLabels[option]}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/50 p-10 text-center">
          <p className="text-gray-400">{message.title}</p>
          <p className="text-sm text-gray-500 mt-2">{message.description}</p>
          {onFilterChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange('all')}
              className="mt-4 text-catalyst-orange hover:text-catalyst-orange/90 hover:bg-gray-800"
            >
              View all websites
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {isSelectionMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSelectionMode}
                className="text-gray-400 hover:text-white hover:bg-gray-800"
                aria-label="Exit selection mode"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <span className="text-white font-medium">
                {selectedCount} selected
              </span>
            </>
          ) : (
            <h2 className="text-xl font-semibold text-white">
              Your Websites{' '}
              <span className="text-gray-500">({processedWebsites.length})</span>
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Selection Actions */}
          {isSelectionMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={allSelected ? handleDeselectAll : handleSelectAll}
                className="text-gray-300 hover:text-white hover:bg-gray-800"
              >
                {allSelected ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                disabled={selectedCount === 0 || isBulkDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isBulkDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete ({selectedCount})
              </Button>
            </>
          ) : (
            <>
              {/* Filter Chips */}
              {onFilterChange && (
                <div className="flex items-center gap-1 mr-2">
                  {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                    <Button
                      key={option}
                      variant={filterBy === option ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onFilterChange(option)}
                      className={
                        filterBy === option
                          ? 'bg-catalyst-orange text-gray-950 hover:bg-catalyst-orange/90'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                    >
                      {filterLabels[option]}
                    </Button>
                  ))}
                </div>
              )}

          {/* Sort Dropdown */}
          {onSortChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {sortLabels[sortBy]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-gray-900 border-gray-700"
              >
                {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => onSortChange(option)}
                    className={`cursor-pointer ${
                      sortBy === option
                        ? 'text-catalyst-orange'
                        : 'text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    {sortLabels[option]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Density Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                aria-label="Change grid density"
              >
                {densityIcons[density]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-gray-900 border-gray-700"
            >
              {(Object.keys(densityLabels) as DensityOption[]).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setDensity(option)}
                  className={`cursor-pointer ${
                    density === option
                      ? 'text-catalyst-orange'
                      : 'text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <span className="mr-2">{densityIcons[option]}</span>
                  {densityLabels[option]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>

              {/* Select Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectionMode}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                aria-label="Enter selection mode"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className={cn('grid', currentDensityConfig.gridCols, currentDensityConfig.cardGap)}>
        {processedWebsites.map((website) => (
          <WebsiteCard
            key={website.id}
            website={website}
            importJob={importsByWebsite.get(website.id)}
            onCardClick={() => handleWebsiteClick(website.id)}
            onAction={(action) => handleWebsiteAction(website.id, action)}
            isDeleting={deleteWebsiteMutation.isPending && dialogWebsite?.id === website.id}
            density={density}
            showCheckbox={isSelectionMode}
            isSelected={selectedIds.has(website.id)}
            onSelectionChange={(selected) => handleToggleWebsiteSelection(website.id, selected)}
          />
        ))}
      </div>

      {/* Single Delete Dialog */}
      <DeleteWebsiteDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDialogOpenChange}
        websiteName={dialogWebsite?.name ?? 'this website'}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteWebsiteMutation.isPending}
        errorMessage={deleteErrorMessage}
      />

      {/* Bulk Delete Dialog */}
      <DeleteWebsiteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        websiteName={`${selectedCount} website${selectedCount === 1 ? '' : 's'}`}
        onConfirm={handleBulkDelete}
        isDeleting={isBulkDeleting}
      />
    </div>
  );
}
