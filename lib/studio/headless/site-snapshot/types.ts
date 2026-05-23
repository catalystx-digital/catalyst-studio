import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PageTemplateRegionKey } from '@/lib/studio/pages/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { DesignSystemAliases } from '@/lib/studio/import/types/design-system.types'
import type { ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export interface GeneratorDiagnostic {
  code: string
  level: DiagnosticLevel
  message: string
  context?: Record<string, unknown>
}

export interface DiagnosticsSummary {
  infoCount: number
  warnCount: number
  errorCount: number
}

export interface SnapshotSiteInfo {
  id: string
  name: string
  description?: string
  origin?: string
}

export interface SnapshotRegionSummary {
  region: PageTemplateRegionKey
  componentTypes: ComponentType[]
}

export interface SnapshotPageMetadata {
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[] | null
  ogImage?: string | null
  draft?: boolean
  [key: string]: unknown
}

export interface SnapshotPage {
  id: string
  title: string
  fullPath: string
  templateKey: string | null
  templateProps: Record<string, unknown>
  regions: SnapshotRegionSummary[]
  components: ComponentInstance[]
  metadata: SnapshotPageMetadata
  sharedComponentIds?: string[]
}

export interface SnapshotStructureNode {
  id: string
  websitePageId: string | null
  parentId: string | null
  slug: string
  fullPath: string
  position: number
  isFolder: boolean
  title?: string
}

export interface SnapshotSharedComponent {
  id: string
  name: string
  componentType: ComponentType
  componentTypeId?: string
  content: Record<string, unknown> | null
  config: Record<string, unknown>
}

export interface SnapshotDesignSystem {
  tokens: ShadcnDesignSystemTokens
  aliases?: DesignSystemAliases
  conceptId?: string
  conceptName?: string
}

/**
 * Redirect entry for the site snapshot.
 * Supports both internal and external redirects.
 */
export interface SnapshotRedirect {
  id: string
  sourcePath: string
  targetPath: string
  redirectType: number // 301 or 302
  isActive: boolean
  /** Whether this redirects to an external URL */
  isExternal: boolean
  /** Whether to show in navigation */
  showInNav: boolean
  /** Navigation label (if showInNav is true) */
  navLabel?: string
  /** Whether to open in new tab (external links) */
  openInNewTab: boolean
  /** Source of the redirect (e.g., "import", "manual") */
  source?: string
  /** Description of the redirect */
  description?: string
}

export interface SiteSnapshot {
  site: SnapshotSiteInfo
  pages: SnapshotPage[]
  structure: SnapshotStructureNode[]
  sharedComponents: SnapshotSharedComponent[]
  capturedAt: string
  designSystem?: SnapshotDesignSystem | null
  /** Redirects for the site (both internal and external) */
  redirects?: SnapshotRedirect[]
}
