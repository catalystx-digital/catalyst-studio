import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PageTemplateRegionKey, PageTemplateRegistration } from './types'

export interface TemplateCanonicalRule {
  region: PageTemplateRegionKey
  enforce: boolean
  preferredCanonical: ComponentType
  allowedCanonicals?: ComponentType[]
  min?: number
  hints?: string[]
  metadata?: Record<string, unknown>
}

export type TemplateDetectionGuidance = string

export interface TemplateRegionPolicy {
  component: ComponentType
  allowedRegions?: PageTemplateRegionKey[]
  preferredRegion?: PageTemplateRegionKey
  behavior?: 'allow' | 'reassign' | 'drop'
  metadata?: Record<string, unknown>
}

export interface TemplateManifest {
  registration: PageTemplateRegistration
  canonical?: TemplateCanonicalRule[]
  detectionGuidance?: TemplateDetectionGuidance[]
  regionPolicies?: TemplateRegionPolicy[]
}

export type TemplateManifestMap = Map<string, TemplateManifest>
