'use client'

/**
 * ImportStatusCard Component
 *
 * A sticky status card that displays import progress. Replaces message spam
 * with a single, continuously-updated card showing:
 * - Overall progress bar
 * - Current stage and message
 * - Page counts (processed/total)
 * - Estimated time remaining
 * - Expandable details for skipped pages and errors
 *
 * @module import-status-card
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImportStage } from '@/lib/studio/import/types/progress.types'

export interface ImportStatusCardProps {
  // Progress data
  stage: ImportStage
  progress: number // 0-100
  stageProgress?: number // 0-100 within current stage
  message: string
  description?: string

  // Counts
  processedCount: number
  totalCount: number
  currentUrl?: string | null

  // Timing
  startedAt?: Date
  estimatedTimeRemaining?: number | null // seconds

  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial_success' | 'recoverable_stuck' | 'unknown' | 'cancelled'

  // Queue info
  queuePosition?: number | null
  estimatedStartSeconds?: number | null

  // Details
  skippedPages?: Array<{ url: string; reason: string }>
  errorCount?: number

  // Style
  className?: string
  sticky?: boolean

  // Job type
  /** Whether this is a greenfield (AI-created) job vs import job */
  isGreenfield?: boolean
}

// Stage labels in actual pipeline order
const STAGE_LABELS: Record<ImportStage, string> = {
  queued: 'Queued',
  initializing: 'Initializing',
  sitemap_discovery: 'Discovering Pages',
  page_processing: 'Processing Pages',
  component_detection: 'Detecting Components',
  design_extraction: 'Extracting Design',
  media_ingest: 'Processing Media',
  template_generation: 'Generating Templates',
  finalizing: 'Saving',
  completed: 'Completed',
  failed: 'Failed',
  unknown: 'Needs attention',
}

function formatTimeRemaining(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${Math.round(seconds)}s remaining`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${secs}s remaining`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m remaining`
}

function formatElapsedTime(startedAt: Date | undefined): string {
  if (!startedAt) return ''
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
  if (elapsed < 60) return `${elapsed}s elapsed`
  const minutes = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  if (minutes < 60) return `${minutes}m ${secs}s elapsed`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m elapsed`
}

function getStatusIcon(status: ImportStatusCardProps['status']) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case 'completed':
    case 'partial_success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'recoverable_stuck':
    case 'unknown':
    case 'cancelled':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />
  }
}

function getStatusBadgeVariant(status: ImportStatusCardProps['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'secondary'
    case 'running':
      return 'default'
    case 'completed':
    case 'partial_success':
      return 'outline'
    case 'recoverable_stuck':
    case 'unknown':
    case 'cancelled':
      return 'secondary'
    case 'failed':
      return 'destructive'
  }
}

export function ImportStatusCard({
  stage,
  progress,
  stageProgress,
  message,
  description,
  processedCount,
  totalCount,
  currentUrl,
  startedAt,
  estimatedTimeRemaining,
  status,
  queuePosition,
  estimatedStartSeconds,
  skippedPages,
  errorCount,
  className,
  sticky = true,
  isGreenfield = false,
}: ImportStatusCardProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const hasDetails = (skippedPages && skippedPages.length > 0) || (errorCount && errorCount > 0)

  return (
    <Card
      className={cn(
        'w-full border-primary/20 bg-card/95 backdrop-blur-sm',
        sticky && 'sticky top-4 z-10',
        status === 'completed' && 'border-green-500/20',
        status === 'partial_success' && 'border-yellow-500/20',
        (status === 'recoverable_stuck' || status === 'unknown' || status === 'cancelled') && 'border-yellow-500/20',
        status === 'failed' && 'border-destructive/20',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <CardTitle className="text-sm font-medium">
              {status === 'pending' && queuePosition
                ? `${isGreenfield ? 'Generation' : 'Import'} Queued (#${queuePosition})`
                : isGreenfield ? 'Generation Progress' : 'Import Progress'}
            </CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
            {STAGE_LABELS[stage]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress}%</span>
            {estimatedTimeRemaining ? (
              <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
            ) : startedAt && status === 'running' ? (
              <span>{formatElapsedTime(startedAt)}</span>
            ) : null}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1">
          <p className="text-sm font-medium">{message}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Counts */}
        {totalCount > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>
                {processedCount} / {totalCount} pages
              </span>
            </div>
            {currentUrl && (status === 'running' || status === 'recoverable_stuck') && (
              <div className="flex items-center gap-1 truncate max-w-[200px]">
                <Globe className="h-3 w-3 flex-shrink-0" />
                <span className="truncate" title={currentUrl}>
                  {currentUrl}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Queue info */}
        {status === 'pending' && queuePosition && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
            <Clock className="h-3 w-3" />
            <span>
              Position {queuePosition} in queue
              {estimatedStartSeconds
                ? ` - starting in ~${formatTimeRemaining(estimatedStartSeconds).replace(' remaining', '')}`
                : ''}
            </span>
          </div>
        )}

        {/* Stage progress (if different from overall) */}
        {stageProgress !== undefined && stageProgress !== progress && status === 'running' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Stage progress</span>
              <span>{Math.round(stageProgress)}%</span>
            </div>
            <Progress value={stageProgress} className="h-1" />
          </div>
        )}

        {/* Details section */}
        {hasDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs h-7"
              >
                <span className="flex items-center gap-2">
                  {errorCount && errorCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      {errorCount} errors
                    </span>
                  )}
                  {skippedPages && skippedPages.length > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle className="h-3 w-3" />
                      {skippedPages.length} skipped
                    </span>
                  )}
                </span>
                {detailsOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {skippedPages && skippedPages.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Skipped Pages
                  </p>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {skippedPages.slice(0, 10).map((skip, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5 text-yellow-600" />
                        <span className="truncate" title={skip.url}>
                          {skip.url}
                        </span>
                        <span className="text-yellow-600 flex-shrink-0">
                          ({skip.reason})
                        </span>
                      </li>
                    ))}
                    {skippedPages.length > 10 && (
                      <li className="text-muted-foreground">
                        ...and {skippedPages.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

export default ImportStatusCard
