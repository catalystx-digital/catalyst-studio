'use client';

import { useMemo, useState, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Activity, ChevronRight, Clock, ExternalLink, Loader2, MoreVertical, RefreshCw, Sparkles, Trash2 } from 'lucide-react';

import { useWebsites, useDeleteWebsite } from '@/lib/api/hooks/use-websites';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { useImportActivity, ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { Badge } from '@/components/ui/badge';
import { WebsiteIcon } from './website-icon';
import { WebsiteStatusBadge, getWebsiteStatus } from './website-status-badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteWebsiteDialog } from '@/components/ui/delete-website-dialog';
import { useToast } from '@/components/ui/use-toast';

interface RecentAppsProps {
  maxItems?: number;
  className?: string;
  isAuthenticated?: boolean;
}

function extractMetadata(website: { metadata?: Record<string, unknown> | null }): Record<string, unknown> {
  if (!website.metadata) {
    return {};
  }

  if (typeof website.metadata === 'object' && !Array.isArray(website.metadata)) {
    return website.metadata as Record<string, unknown>;
  }

  return {};
}

function formatStage(stage: string | undefined) {
  switch (stage) {
    case 'fetching':
      return 'Fetching source';
    case 'analyzing':
      return 'Analyzing structure';
    case 'generating':
      return 'Generating components';
    case 'creating':
      return 'Finalizing content';
    case 'cancelled':
      return 'Import cancelled';
    case 'failed':
      return 'Import failed';
    default:
      return 'Preparing import';
  }
}

function formatEta(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return '<1 minute';
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
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

export function RecentApps({ maxItems = 12, className = '', isAuthenticated = true }: RecentAppsProps) {
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const deleteWebsiteMutation = useDeleteWebsite();
  const [dialogWebsite, setDialogWebsite] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isManualRefreshInFlight, setManualRefreshInFlight] = useState(false);
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

  const sortedWebsites = useMemo(() => {
    return [...websites].sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
  }, [websites]);

  const handleWebsiteClick = useCallback((websiteId: string) => {
    const destination = getStudioWebsiteRoute(websiteId, { legacyView: 'overview' });
    router.push(destination);
  }, [router]);

  const handleCardKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, websiteId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleWebsiteClick(websiteId);
    }
  }, [handleWebsiteClick]);

  const handleDeleteRequest = useCallback((website: { id: string; name: string }) => {
    setDialogWebsite({ id: website.id, name: website.name });
    setDeleteDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDialogWebsite(null);
      deleteWebsiteMutation.reset();
    }
  }, [deleteWebsiteMutation]);

  const handleManualRefresh = useCallback(async () => {
    if (!shouldFetch || isManualRefreshInFlight) {
      return;
    }

    setManualRefreshInFlight(true);
    try {
      await Promise.allSettled([refetchWebsites(), refetchImportActivity()]);
    } finally {
      setManualRefreshInFlight(false);
    }
  }, [shouldFetch, isManualRefreshInFlight, refetchWebsites, refetchImportActivity]);

  const deleteErrorMessage = deleteWebsiteMutation.error instanceof Error
    ? deleteWebsiteMutation.error.message
    : undefined;

  const handleConfirmDelete = useCallback(async () => {
    if (!dialogWebsite) {
      return;
    }

    const websiteName = dialogWebsite.name;

    try {
      const result = await deleteWebsiteMutation.mutateAsync(dialogWebsite.id);
      toast({
        title: 'Website deleted',
        description: result?.message ?? `“${websiteName}” removed from your dashboard.`,
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

  const displayedWebsites = showAll ? sortedWebsites : sortedWebsites.slice(0, maxItems);
  const hasMoreWebsites = sortedWebsites.length > maxItems;

  const loading = shouldFetch && (isWebsitesLoading || isImportsLoading);
  const loadError = shouldFetch ? websitesError || importError : null;
  const hasActiveImports = shouldFetch && (importItems?.length ?? 0) > 0;
  const hasAiBuilds = shouldFetch && sortedWebsites.some((site) => Boolean((extractMetadata(site) as { createdViaAI?: unknown }).createdViaAI));
  const isEmpty = shouldFetch && sortedWebsites.length === 0 && !hasActiveImports;
  const isRefreshing = isManualRefreshInFlight || isWebsitesFetching || isImportsFetching;

  if (!shouldFetch) {
    return null;
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Recent Activity
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-secondary/50 rounded-lg p-4 h-40 space-y-3">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
                <div className="h-2 bg-secondary rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Unable to load recent activity.';
    return (
      <div className={className}>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          <h2 className="text-lg font-semibold mb-2">Unable to load recent activity</h2>
          <p className="text-sm text-red-100/80">{message}</p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/50 p-10 text-center text-gray-300">
          <h3 className="text-xl font-semibold mb-2">No recent imports yet</h3>
          <p className="text-sm text-gray-400">
            Start by importing a website or launching an AI build to see your activity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2 text-white">
          <Clock className="w-6 h-6 text-catalyst-orange" />
          Recent Activity
        </h2>
        <div className="flex items-center gap-3">
          {hasMoreWebsites && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-catalyst-orange hover:text-catalyst-orange-dark flex items-center gap-1"
            >
              View All ({sortedWebsites.length})
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="text-catalyst-orange hover:text-catalyst-orange-dark"
            >
              Show Less
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {(hasActiveImports || hasAiBuilds) && (
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          {hasActiveImports ? (
            <div className="flex items-center gap-2 text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{importItems?.length ?? 0} import{(importItems?.length ?? 0) === 1 ? '' : 's'} in progress</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <Activity className="h-4 w-4" />
              <span>No imports running right now.</span>
            </div>
          )}

          {hasAiBuilds && (
            <div className="flex items-center gap-2 text-cyan-300">
              <Sparkles className="h-4 w-4" />
              <span>AI builds are enabled for this account.</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayedWebsites.map((website) => {
          const metadata = extractMetadata(website);
          const createdViaAI = Boolean((metadata as { createdViaAI?: unknown }).createdViaAI);
          const targetAudienceValue = (metadata as { targetAudience?: unknown }).targetAudience;
          const targetAudience = typeof targetAudienceValue === 'string' ? targetAudienceValue : undefined;
          const importJob = importsByWebsite.get(website.id);
          const isQueued = importJob?.state === 'queued';
          const etaLabel = formatEta(importJob?.estimatedStartSeconds ?? null);
          const lastUpdated = formatDistanceToNow(new Date(website.updatedAt), { addSuffix: true });
          const isDeletingTarget = deleteWebsiteMutation.isPending && dialogWebsite?.id === website.id;

          // Determine website status (only show if no import in progress)
          const websiteStatus = !importJob ? getWebsiteStatus({
            publishedAt: (metadata as { publishedAt?: string | null }).publishedAt,
            updatedAt: website.updatedAt?.toString(),
            lastDeploymentStatus: (metadata as { lastDeploymentStatus?: string | null }).lastDeploymentStatus,
          }) : null;

          return (
            <div
              key={website.id}
              role="button"
              tabIndex={0}
              onClick={() => handleWebsiteClick(website.id)}
              onKeyDown={(event) => handleCardKeyDown(event, website.id)}
              className="group relative bg-gray-900 hover:bg-gray-800 rounded-lg p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-catalyst-orange border border-gray-700 cursor-pointer select-none"
            >
              {isDeletingTarget && (
                <div className="absolute inset-0 z-10 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}

              <div className="flex items-start justify-between mb-3 gap-2">
                <WebsiteIcon icon={website.icon} name={website.name} className="w-10 h-10" />
                <div className="flex items-center gap-2">
                  {importJob && (
                    <Badge
                      variant={isQueued ? 'outline' : 'secondary'}
                      className={
                        isQueued
                          ? 'border-amber-400/60 text-amber-200 bg-transparent'
                          : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      }
                    >
                      {isQueued
                        ? importJob.queuePosition && importJob.queuePosition > 0
                          ? `Queued • #${importJob.queuePosition}`
                          : 'Queued'
                        : importJob.progress === 100
                        ? 'Imported'
                        : `Importing • ${Math.round(importJob.progress)}%`}
                    </Badge>
                  )}
                  {!importJob && websiteStatus && (
                    <WebsiteStatusBadge status={websiteStatus} />
                  )}
                  {createdViaAI && (
                    <Badge variant="outline" className="text-cyan-200 border-cyan-400/40">
                      AI Build
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        aria-label={`Website actions for ${website.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-gray-900 border border-gray-700"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenuItem
                        className="cursor-pointer text-gray-200 focus:bg-gray-800 focus:text-white"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleWebsiteClick(website.id);
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Studio
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-red-400 focus:bg-gray-800 focus:text-red-300"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleDeleteRequest(website);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete website
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <h3 className="font-semibold text-base mb-1 line-clamp-1 text-white">
                {website.name}
              </h3>

              {website.description && (
                <p className="text-sm text-gray-400 line-clamp-2 mb-3" title={website.description}>
                  {website.description}
                </p>
              )}

              {importJob ? (
                isQueued ? (
                  <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-100">
                    <span>{importJob.message ?? 'Waiting for an available import slot'}</span>
                    {etaLabel && <p className="mt-1 text-amber-100/80">ETA about {etaLabel}</p>}
                  </div>
                ) : (
                  <div className="mb-3">
                    <Progress value={importJob.progress} className="h-2 bg-gray-800" indicatorClassName="bg-catalyst-orange" />
                    <p className="text-xs text-gray-400 mt-2">
                      {importJob.progress === 100
                        ? 'Import complete'
                        : importJob.message || formatStage(importJob.stage)}
                    </p>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2" title={targetAudience}>
                  {targetAudience ? `Audience: ${targetAudience}` : 'Ready to continue editing'}
                </p>
              )}

              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{lastUpdated}</span>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-catalyst-orange transition-colors absolute bottom-4 right-4" />
            </div>
          );
        })}
      </div>

      <DeleteWebsiteDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDialogOpenChange}
        websiteName={dialogWebsite?.name ?? 'this website'}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteWebsiteMutation.isPending}
        errorMessage={deleteErrorMessage}
      />
    </div>
  );
}














