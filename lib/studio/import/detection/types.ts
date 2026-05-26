import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PageCatalogSummary } from '@/lib/studio/ai/page-catalog'
import type { ResourcesSummary, SectionInfo, RedirectInfo } from '../services/web-tools'
import type { ProgressCallback } from '../types/progress.types'
import type { CheckpointSession, IImportCheckpointService } from '../types/checkpoint.types'
import type { GlobalSectionArtifactCache } from './global-section-cache'

export {} // ensure this file is treated as a module

export interface ComponentPattern {
  type: string
  confidence: number
  category?: string
  keywords?: string[]
  patterns?: string[]
  metadata?: {
    suggestedCategory?: string
    detectedPatterns?: string[]
    [key: string]: any
  }
  description?: string
  properties?: Array<{
    name: string
    type: string
    required: boolean
    description?: string
    allowedTypes?: string[]
  }>
}

export interface AIComponentMetadata {
  confidence?: number
  detectedPatterns?: string[]
  suggestedCategory?: string
  region?: string
  source?: string
  templateKey?: string
  fragments?: Array<{ name: string; confidence?: number }> | string[] | string
  variant?: string
  contentTypeTag?: string
  pageTag?: string
}

export interface DetectedComponent {
  component: string
  type: ComponentType
  confidence: number
  content: Record<string, any>
  location?: 'header' | 'hero' | 'main' | 'footer'
  metadata?: AIComponentMetadata
}

export interface InvalidDetectedComponent {
  index: number
  component: string
  type: string
  reason: string
}

export interface DetectedPageTemplate {
  templateKey: string
  confidence?: number
  reason?: string
  source?: 'model' | 'fallback' | 'redirect-detection'
}

export interface PageMetadata {
  title?: string
  description?: string
  keywords?: string[]
  canonicalUrl?: string
  language?: string
  pageType?: 'home' | 'about' | 'contact' | 'product' | 'blog' | 'landing' | 'other'
  primaryPurpose?: string
  targetAudience?: string
  openGraph?: { title?: string; description?: string; image?: string; type?: string }
  twitterCard?: { card?: string; site?: string; creator?: string }
  favicon?: string
  logo?: string
  primaryColors?: string[]
  fonts?: string[]
  visualStyle?: string
  schemaOrgData?: any
  contactInfo?: { email?: string; phone?: string; address?: string }
  socialLinks?: Record<string, string>
  robots?: string
  viewport?: string
  author?: string
  publishedDate?: string
  modifiedDate?: string
  pageTag?: string
  contentTypeTag?: string
}

export interface ImportDetectionResult {
  components: DetectedComponent[]
  pageTemplate?: DetectedPageTemplate
  pageMetadata?: PageMetadata
  processingTime: number
  modelUsed: string
  tokenUsage?: number
  promptTokens?: number
  completionTokens?: number
  cost?: number
  pageUrl: string
  accuracy?: number
  resourcesSummary?: ResourcesSummary
  outlineSections?: SectionInfo[]
  timingBreakdown?: ImportDetectionTimingBreakdown
  /** HTTP status returned by the source fetch, when known */
  sourceHttpStatus?: number
  /** Final URL after source fetch redirects, when known */
  sourceFinalUrl?: string
  /** Redirect info if this page is a redirect (external or internal) */
  redirectInfo?: RedirectInfo
  /** Whether this result represents a redirect page (skip content storage) */
  isRedirectPage?: boolean
  /** Internal marker: components have already passed post-processing/canonical validation before checkpoint save */
  postProcessed?: boolean
  /** Explicit detection failure details for pages that could not be imported */
  detectionError?: {
    stage: 'detection'
    message: string
  }
}

export interface ImportDetectionTimingBreakdown {
  totalDurationMs: number
  phaseTotals: Array<{
    phase: string
    count: number
    totalMs: number
    maxMs: number
    warningCount: number
  }>
  sectionTimings: Array<{
    sectionKey: string
    sectionOrder?: number
    role?: string
    durationMs: number
    extractionMode?: string
    cacheHit?: boolean
    requestCount?: number
    promptTokensEstimate?: number
    componentCount?: number
    originalBytes?: number
    summarizedBytes?: number
  }>
}

export interface ImportDetectionOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  includeContent?: boolean
  confidenceThreshold?: number
  /** Progress callback for reporting detection progress */
  onProgress?: ProgressCallback
  /** Optional checkpoint session used by the section-level detection harness */
  checkpointSession?: CheckpointSession
  /** Optional checkpoint service used by the section-level detection harness */
  checkpointService?: IImportCheckpointService
  /** Optional same-import cache for validated global header/footer section artifacts */
  globalSectionCache?: GlobalSectionArtifactCache
}

export interface DetectionPromptPayload {
  prompt: string
  components: ComponentPattern[]
  pageSummary: PageCatalogSummary
}
