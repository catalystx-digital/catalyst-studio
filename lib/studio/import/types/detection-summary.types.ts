import type { WebsiteMediaReference } from '@/types/api';
export interface DetectionComponentSummary {
  component: string
  type: string
  confidence?: number
  location?: string
  textPreview?: string
}

type BrandingAssetReference = string | WebsiteMediaReference | null;

export interface NormalizationWarningSummary {
  issue: string
  message: string
  field?: string
  childType?: string
  parentType: string
  details?: Record<string, unknown>
}

export interface DetectionPageSummary {
  pageUrl: string
  title?: string
  componentCount: number
  highConfidenceCount: number
  templateKey?: string
  accuracy?: number
  status: 'import-ready' | 'import-error' | 'import-invalid' | 'import-skipped' | 'import-processing' | 'import-pending'
  error?: string
  metadata?: {
    pageType?: string
    primaryColors?: string[]
    fonts?: string[]
    hasBranding?: boolean
    logo?: BrandingAssetReference
    favicon?: BrandingAssetReference
    visualStyle?: string | null
    importStatus?: 'invalid' | 'error'
    importIssues?: unknown
    normalizationWarnings?: NormalizationWarningSummary[]
  }
  components: DetectionComponentSummary[]
}

export interface DetectionSummaryMetadata {
  totalComponentsDetected: number
  autoApprovedComponents: number
  processingTime: number
  detectionResults: number
  failedPages: number
  pipelineSuccess: boolean
  readyPages?: number
  skippedPages?: number
  invalidPages?: number
  totalPages?: number
  mediaAssets?: number
  mediaWarnings?: number
  mediaMissingSrc?: number
  mediaMissingSrcPages?: number
}
