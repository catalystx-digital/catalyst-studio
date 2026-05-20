import type { ComponentPattern, DetectedComponent, PageMetadata } from '../types'

export interface CanonicalSynthesizeParams {
  canonicalType: string
  region: string
  components: DetectedComponent[]
  pattern: ComponentPattern
  pageUrl?: string
  templateKey: string
  pageMetadata?: PageMetadata
  hints?: string[]
  requirementMetadata?: Record<string, unknown>
}

export interface CanonicalSynthesisResult {
  component: DetectedComponent
  insertIndex: number
}

export type CanonicalSynthesizer = (
  params: CanonicalSynthesizeParams
) => CanonicalSynthesisResult | null
