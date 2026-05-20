'use client';

/**
 * Active Imports Banner (NEW-002 Enhancement)
 *
 * Shows import progress with individual site details.
 * Addresses user feedback: "Show me which sites are importing and their individual progress"
 *
 * Features:
 * - Expandable list showing all active imports with individual progress
 * - Site name and URL displayed for each import
 * - Stage information for each import
 * - Collapsible to save space
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, ChevronDown, ChevronUp, Globe, Clock, AlertCircle } from 'lucide-react';
import type { ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ActiveImportsBannerProps {
  imports: ImportActivityItem[];
  onDismiss?: () => void;
  className?: string;
}

function getActiveImports(imports: ImportActivityItem[]): ImportActivityItem[] {
  return imports.filter((job) => {
    const isActive = job.state === 'active' || job.state === 'queued';
    const isProcessing = job.status === 'processing' || job.status === 'pending';
    return (isActive || isProcessing) && job.progress < 100;
  });
}

function calculateAverageProgress(imports: ImportActivityItem[]): number {
  if (imports.length === 0) return 0;
  const total = imports.reduce((sum, job) => sum + job.progress, 0);
  return Math.round(total / imports.length);
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getWebsiteName(item: ImportActivityItem): string {
  return item.website?.name || new URL(item.url).hostname || 'Unknown site';
}

export function ActiveImportsBanner({
  imports,
  onDismiss,
  className,
}: ActiveImportsBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const activeImports = useMemo(() => getActiveImports(imports), [imports]);
  const averageProgress = useMemo(
    () => calculateAverageProgress(activeImports),
    [activeImports]
  );

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Don't render if no active imports or dismissed
  if (activeImports.length === 0 || isDismissed) {
    return null;
  }

  const importCount = activeImports.length;
  const importText = importCount === 1 ? '1 import' : `${importCount} imports`;
  const queuedCount = activeImports.filter((j) => j.state === 'queued').length;
  const processingCount = importCount - queuedCount;

  return (
    <div
      className={cn(
        'border-b border-amber-400/40 bg-amber-500/10',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Main Banner Row */}
      <div className="h-[50px] px-4 flex items-center justify-between gap-4">
        {/* Left: Icon + Count + Expand Toggle */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpand}
            className="flex items-center gap-2 text-amber-200 hover:text-amber-100 hover:bg-amber-500/20 px-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-medium whitespace-nowrap">
              {importText} in progress
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {queuedCount > 0 && (
            <span className="text-sm text-amber-200/70 hidden sm:inline">
              ({queuedCount} queued)
            </span>
          )}
        </div>

        {/* Center: Overall Progress */}
        <div className="flex-1 flex items-center justify-center gap-4 min-w-0 max-w-md">
          <div className="flex items-center gap-3 w-full">
            <span className="text-sm text-amber-200/70 whitespace-nowrap hidden sm:inline">
              Overall:
            </span>
            <Progress
              value={averageProgress}
              className="h-2 flex-1 bg-amber-900/30"
              indicatorClassName="bg-amber-400"
            />
            <span className="text-sm text-amber-200 tabular-nums whitespace-nowrap font-medium">
              {averageProgress}%
            </span>
          </div>
        </div>

        {/* Right: Dismiss Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-8 w-8 text-amber-200/70 hover:text-amber-100 hover:bg-amber-500/20 shrink-0"
          aria-label="Dismiss import progress banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded Individual Progress List */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-amber-400/20 pt-2">
          <div className="text-xs text-amber-200/60 uppercase tracking-wide font-medium mb-2">
            Individual Progress
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {activeImports.map((item) => (
              <ImportProgressRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Import Progress Row
 * Shows site name, URL, stage, and progress for a single import
 */
function ImportProgressRow({ item }: { item: ImportActivityItem }) {
  const siteName = getWebsiteName(item);
  const isQueued = item.state === 'queued';
  const stageText = formatStage(item.stage);

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded bg-amber-900/20">
      {/* Site Icon */}
      <Globe className="h-4 w-4 text-amber-300/70 flex-shrink-0" />

      {/* Site Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-amber-100 truncate">
            {siteName}
          </span>
          {isQueued && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-900/40 text-amber-300 rounded">
              <Clock className="h-3 w-3" />
              Queued
              {item.queuePosition && ` #${item.queuePosition}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-200/60">
          <span className="truncate max-w-[200px]">{item.url}</span>
          <span className="text-amber-400/60">•</span>
          <span>{stageText}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 w-32 flex-shrink-0">
        <Progress
          value={item.progress}
          className="h-1.5 flex-1 bg-amber-900/30"
          indicatorClassName={isQueued ? 'bg-amber-600' : 'bg-amber-400'}
        />
        <span className="text-xs text-amber-200 tabular-nums w-8 text-right">
          {item.progress}%
        </span>
      </div>
    </div>
  );
}
