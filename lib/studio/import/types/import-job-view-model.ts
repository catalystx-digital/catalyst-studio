import type { ImportSessionMode, ImportTrackerStatus } from '@/lib/studio/stores/import-tracker-store'
import type { WebsiteMediaReference } from '@/types/api'

export interface ImportJobMetadata {
  sitemap?: {
    ordered?: string[]
    pending?: string[]
    processing?: string[]
    completed?: string[]
    failed?: string[]
    skipped?: string[]
    total?: number
  }
  pages?: Array<{
    url: string
    order: number
    status: string
    normalizedPageUrl?: string
    rawStatus?: string
    phase?: string
    title?: string | null
    committedPageId?: string | null
    error?: string
  }>
  progressSummary?: {
    processedCount?: number
    totalCount?: number
    currentUrl?: string | null
  }
  media?: {
    assetsDetected?: number
    ingestWarningCount?: number
    missingSrcCount?: number
    missingSrcByPage?: Array<{ pageUrl: string; count: number }>
    missingSrcEntries?: Array<{
      pageUrl?: string
      parentType: string
      field?: string
      childType?: string
      mediaId?: string
      message: string
    }>
  }
  [key: string]: unknown
}

export type ImportJobStage =
  | 'initializing'
  | 'fetching'
  | 'analyzing'
  | 'generating'
  | 'creating'
  | 'page_processing'
  | 'finalizing'
  | 'queued'
  | 'cancelled'
  | 'failed'
  | 'completed'
  | 'unknown'

export interface ImportJobViewModel {
  id: string
  websiteId: string
  url: string
  status: ImportTrackerStatus
  progress: number
  stage: ImportJobStage
  message: string | null
  state: 'active' | 'queued' | 'completed'
  mode: ImportSessionMode
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
  createdAt: string
  queuePosition?: number | null
  estimatedStartSeconds?: number | null
  metadata?: ImportJobMetadata
  rawStatus?: string | null
  productStatus?: 'success' | 'partial_success' | 'failed' | 'cancelled' | 'recoverable_stuck' | 'unknown' | 'active'
  website?: {
    id: string
    name: string | null
    icon: string | WebsiteMediaReference | null
  } | null
}
