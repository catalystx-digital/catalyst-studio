'use client';

import { useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Edit3,
  ExternalLink,
  Loader2,
  MoreVertical,
  Palette,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import type { ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WebsiteIcon } from './website-icon';
import { getWebsiteStatus, type WebsiteStatus } from './website-status-badge';
import { densityConfig, type DensityOption } from './density-context';
import { cn } from '@/lib/utils';

export type WebsiteAction = 'edit' | 'team' | 'settings' | 'design' | 'preview' | 'delete';

interface Website {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  updatedAt: string | Date;
  metadata?: Record<string, unknown> | null;
}

interface WebsiteCardProps {
  website: Website;
  importJob?: ImportActivityItem;
  onCardClick?: () => void;
  onAction: (action: WebsiteAction) => void;
  isDeleting?: boolean;
  density?: DensityOption;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  showCheckbox?: boolean;
}

function extractMetadata(website: Website): Record<string, unknown> {
  if (!website.metadata) return {};
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
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return null;
  if (seconds < 60) return '<1 minute';
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// Status dot colors matching the PRD
const statusDotColors: Record<WebsiteStatus | 'importing' | 'queued' | 'failed', string> = {
  published: 'bg-green-400',
  draft: 'bg-blue-400',
  pending: 'bg-yellow-400',
  error: 'bg-red-400',
  importing: 'bg-amber-400',
  queued: 'bg-amber-400',
  failed: 'bg-red-400',
};

export function WebsiteCard({
  website,
  importJob,
  onCardClick,
  onAction,
  isDeleting = false,
  density = 'comfortable',
  isSelected = false,
  onSelectionChange,
  showCheckbox = false,
}: WebsiteCardProps) {
  const router = useRouter();
  const metadata = extractMetadata(website);
  const config = densityConfig[density];
  const createdViaAI = Boolean((metadata as { createdViaAI?: unknown }).createdViaAI);
  const targetAudience = (metadata as { targetAudience?: string }).targetAudience;
  const lastUpdated = formatDistanceToNow(new Date(website.updatedAt), { addSuffix: true });

  const isQueued = importJob?.state === 'queued';
  const isImporting = importJob && !isQueued && importJob.progress < 100;
  const importFailed = importJob?.state === 'failed';
  const etaLabel = formatEta(importJob?.estimatedStartSeconds ?? null);

  // Determine status
  let displayStatus: WebsiteStatus | 'importing' | 'queued' | 'failed' = 'draft';
  if (importFailed) {
    displayStatus = 'failed';
  } else if (isQueued) {
    displayStatus = 'queued';
  } else if (isImporting) {
    displayStatus = 'importing';
  } else if (!importJob) {
    displayStatus = getWebsiteStatus({
      publishedAt: (metadata as { publishedAt?: string | null }).publishedAt,
      updatedAt: website.updatedAt?.toString(),
      lastDeploymentStatus: (metadata as { lastDeploymentStatus?: string | null }).lastDeploymentStatus,
    });
  }

  const handleCardClick = useCallback(() => {
    if (onCardClick) {
      onCardClick();
    } else {
      const destination = getStudioWebsiteRoute(website.id, { legacyView: 'overview' });
      router.push(destination);
    }
  }, [onCardClick, website.id, router]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCardClick();
      }
    },
    [handleCardClick]
  );

  const handleQuickAction = useCallback(
    (action: WebsiteAction, e: React.MouseEvent) => {
      e.stopPropagation();
      onAction(action);
    },
    [onAction]
  );

  const handleCheckboxChange = useCallback(
    (checked: boolean | 'indeterminate', e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (typeof checked === 'boolean' && onSelectionChange) {
        onSelectionChange(checked);
      }
    },
    [onSelectionChange]
  );

  const statusLabel = {
    published: 'Published',
    draft: 'Draft',
    pending: 'Changes pending',
    error: 'Error',
    importing: `Importing ${Math.round(importJob?.progress ?? 0)}%`,
    queued: importJob?.queuePosition ? `Queued #${importJob.queuePosition}` : 'Queued',
    failed: 'Import failed',
  }[displayStatus];

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={cn(
          'group relative bg-gray-900 rounded-lg border border-gray-700',
          'transition-all duration-200 cursor-pointer select-none',
          'hover:bg-gray-800 hover:border-gray-600 hover:shadow-lg',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-catalyst-orange'
        )}
      >
        {/* Deleting overlay */}
        {isDeleting && (
          <div className="absolute inset-0 z-10 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}

        {/* Card Content */}
        <div className={config.cardPadding}>
          {/* Header: Checkbox, Icon, Name, More Menu */}
          <div className={cn('flex items-start justify-between gap-2', density === 'dense' ? 'mb-1' : 'mb-3')}>
            <div className="flex items-center gap-3 min-w-0">
              {/* Selection checkbox */}
              {showCheckbox && (
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={handleCheckboxChange}
                    className="data-[state=checked]:bg-catalyst-orange data-[state=checked]:border-catalyst-orange"
                    aria-label={`Select ${website.name}`}
                  />
                </div>
              )}
              <WebsiteIcon icon={website.icon} name={website.name} className={cn(config.iconSize, 'shrink-0')} />
              <div className="min-w-0">
                <h3 className={cn('font-semibold text-white truncate', config.fontSize)}>{website.name}</h3>
              </div>
            </div>

            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label={`More actions for ${website.name}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-gray-900 border border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="cursor-pointer text-gray-200 focus:bg-gray-800 focus:text-white"
                  onClick={(e) => handleQuickAction('design', e)}
                >
                  <Palette className="mr-2 h-4 w-4" />
                  Design System
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem
                  className="cursor-pointer text-red-400 focus:bg-gray-800 focus:text-red-300"
                  onClick={(e) => handleQuickAction('delete', e)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete website
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status Line */}
          <div className={cn('flex items-center gap-2', density === 'dense' ? 'mb-1' : 'mb-3')}>
            <span className={cn('w-2 h-2 rounded-full', statusDotColors[displayStatus])} />
            <span className={cn('text-gray-400', density === 'dense' ? 'text-xs' : 'text-sm')}>{statusLabel}</span>
            {density !== 'dense' && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-sm text-gray-500">{lastUpdated}</span>
              </>
            )}
          </div>

          {/* Import Progress / Metadata - hidden in dense mode */}
          {config.showDescription && importJob && (isQueued || isImporting) ? (
            isQueued ? (
              <div className="mb-3 p-2 rounded-md border border-amber-400/40 bg-amber-500/10 text-xs text-amber-100">
                <span>{importJob.message ?? 'Waiting for an available import slot'}</span>
                {etaLabel && <p className="mt-1 text-amber-100/80">ETA about {etaLabel}</p>}
              </div>
            ) : (
              <div className="mb-3">
                <Progress
                  value={importJob.progress}
                  className="h-2 bg-gray-800"
                  indicatorClassName="bg-catalyst-orange"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {importJob.message || formatStage(importJob.stage)}
                </p>
              </div>
            )
          ) : config.showDescription && targetAudience ? (
            <p className="text-sm text-gray-400 mb-3 truncate" title={targetAudience}>
              Audience: {targetAudience}
            </p>
          ) : null}

          {/* Badges - hidden in dense mode */}
          {config.showDescription && createdViaAI && !importJob && (
            <Badge variant="outline" className="text-cyan-200 border-cyan-400/40 mb-3">
              AI Build
            </Badge>
          )}
        </div>

        {/* Quick Actions Footer - Always Visible */}
        <div className={cn(
          'border-t border-gray-700 flex items-center justify-between bg-gray-900/50 rounded-b-lg',
          density === 'dense' ? 'px-1 py-1' : 'px-2 py-2'
        )}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-gray-400 hover:text-white hover:bg-gray-700',
                    density === 'dense' ? 'h-6 px-2' : 'h-8 px-3'
                  )}
                  onClick={(e) => handleQuickAction('edit', e)}
                >
                  <Edit3 className={density === 'dense' ? 'h-3 w-3' : 'h-4 w-4'} />
                  {density !== 'dense' && <span className="ml-1.5 hidden sm:inline">Edit</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in editor</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-gray-400 hover:text-white hover:bg-gray-700',
                    density === 'dense' ? 'h-6 px-1.5' : 'h-8 px-2'
                  )}
                  onClick={(e) => handleQuickAction('team', e)}
                >
                  <Users className={density === 'dense' ? 'h-3 w-3' : 'h-4 w-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Team access</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-gray-400 hover:text-white hover:bg-gray-700',
                    density === 'dense' ? 'h-6 px-1.5' : 'h-8 px-2'
                  )}
                  onClick={(e) => handleQuickAction('settings', e)}
                >
                  <Settings className={density === 'dense' ? 'h-3 w-3' : 'h-4 w-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Website settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-gray-400 hover:text-white hover:bg-gray-700',
                    density === 'dense' ? 'h-6 px-1.5' : 'h-8 px-2'
                  )}
                  onClick={(e) => handleQuickAction('preview', e)}
                >
                  <ExternalLink className={density === 'dense' ? 'h-3 w-3' : 'h-4 w-4'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
