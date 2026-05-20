import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PageTemplateRegionKey, PageTemplateRegistration } from '@/lib/studio/pages/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type {
  DiagnosticLevel,
  DiagnosticsSummary,
  GeneratorDiagnostic,
  SiteSnapshot,
  SnapshotPage,
  SnapshotPageMetadata,
  SnapshotRedirect,
  SnapshotRegionSummary,
  SnapshotSharedComponent,
  SnapshotSiteInfo,
  SnapshotStructureNode
} from '@/lib/studio/headless/site-snapshot/types'
import type { MediaDiagnosticsReport } from './media-resolution'
import type { ApiKeyEvent } from '../utils/api-key-manager'

export type {
  DiagnosticLevel,
  DiagnosticsSummary,
  GeneratorDiagnostic,
  SiteSnapshot,
  SnapshotPage,
  SnapshotPageMetadata,
  SnapshotRedirect,
  SnapshotRegionSummary,
  SnapshotSharedComponent,
  SnapshotSiteInfo,
  SnapshotStructureNode
} from '@/lib/studio/headless/site-snapshot/types'
export type {
  MediaDiagnosticsReport,
  ResolvedMediaEntry,
  UnresolvedMediaEntry,
  MediaReferenceHandle,
  MediaIngestWarningEntry
} from './media-resolution'
export { createEmptyMediaDiagnosticsReport } from './media-resolution'

export type ProviderKind = 'stub' | 'ucs' | 'static' | 'optimizely' | 'standalone' | 'umbraco-compose'
export type DataSourceKind = 'prisma' | 'graphql'

export interface ApiAccessUserOptions {
  encodedUser?: string
  cookies?: string
}

export interface GraphqlProviderOptions {
  endpoint?: string
  apiKey?: string
  autoManageKeys?: boolean
  apiKeyLabel?: string
  persistKeyPath?: string
  maxRetries?: number
  apiAccess?: ApiAccessUserOptions
  onApiKeyEvent?: (event: ApiKeyEvent) => void
}

export interface ProviderContextSnapshot extends SiteSnapshot {
  diagnostics: GeneratorDiagnostic[]
}

export type SlugSegments = string[]

export interface SlugRegistryEntry {
  pageId: string
  slug: SlugSegments
  canonicalSlug: SlugSegments
  canonicalFullPath: string
  originalSlug: SlugSegments
  originalFullPath: string
  fullPath: string
  templateKey: string | null
  title: string
  aliasOf?: string | null
  structureId?: string | null
  parentId?: string | null
}

export interface PageStructurePayload {
  current: SnapshotStructureNode | null
  ancestors: SnapshotStructureNode[]
  children: SnapshotStructureNode[]
}

export interface SharedComponentPayload extends SnapshotSharedComponent {}

export interface PagePayload {
  page: SnapshotPage
  structure?: PageStructurePayload
  sharedComponents: SharedComponentPayload[]
  diagnostics: GeneratorDiagnostic[]
}

/**
 * Redirect payload returned by provider's resolveRedirectByPath.
 * Contains all information needed to perform the redirect.
 */
export interface RedirectPayload {
  id: string
  sourcePath: string
  targetPath: string
  redirectType: number // 301 or 302
  isActive: boolean
  isExternal: boolean
  showInNav: boolean
  navLabel?: string
  openInNewTab: boolean
}

export interface ProviderRequestContext {
  requestId?: string
  headers?: Record<string, string>
  searchParams?: Record<string, string | string[]>
  previewToken?: string | null
  signal?: AbortSignal
}

/**
 * Options for fetching design system from Catalyst Studio GraphQL API.
 * Used by non-UCS providers (like Optimizely) to bake design system at build time.
 */
export interface DesignSystemSourceOptions {
  /** Catalyst Studio website ID to fetch design system from */
  websiteId: string
  /** Design concept name, slug, or ID (optional - uses default if not specified) */
  designConcept?: string
  /** GraphQL API options for authentication */
  graphql: GraphqlProviderOptions
}

export interface OptimizelyProviderOptions {
  /** GraphQL gateway URL (default: https://cg.optimizely.com) */
  gateway?: string
  /** Single Key for published content (required) */
  singleKey: string
  /** App Key for HMAC authentication (optional, for draft content) */
  appKey?: string
  /** Secret for HMAC authentication */
  secret?: string
  /** Default locale (default: 'en') */
  locale?: string
  /** Starting point page ID in Optimizely (the website root) */
  startPageId?: string
  /** Map Optimizely block types to component types */
  componentTypeMap?: Record<string, string>
  /** Map Optimizely page types to template keys */
  templateMap?: Record<string, string>
  /** Strip locale prefix from paths (default: true) */
  stripLocalePrefix?: boolean
  /** Include raw Optimizely data in props (for debugging) */
  includeRawData?: boolean
  /** Enable debug logging */
  debug?: boolean
  /**
   * Source configuration to fetch design system from Catalyst Studio GraphQL API.
   * When provided, design system tokens will be fetched from Catalyst Studio at build time
   * and baked into the generated export.
   */
  designSystemSource?: DesignSystemSourceOptions
}

export interface UmbracoComposeProviderOptions {
  /** Umbraco Compose project alias (e.g., 'royal-childrens-hospital') */
  projectAlias: string
  /** Umbraco Compose region (e.g., 'germanywestcentral') */
  region: string
  /** Environment (default: 'production') */
  environment?: string
  /** Personal Access Token for GraphQL authentication */
  personalAccessToken: string
  /** Collection to query (default: 'pages') */
  collection?: string
  /** Map Umbraco type schema aliases to component types */
  componentTypeMap?: Record<string, string>
  /** Map Umbraco page types to template keys */
  templateMap?: Record<string, string>
  /** Enable debug logging */
  debug?: boolean
}

export interface GeneratorOptions {
  outputDir: string
  provider: ProviderKind
  websiteId?: string
  dataSource?: DataSourceKind
  dryRun?: boolean
  templateKey?: string
  designConcept?: string
  force?: boolean
  copyEnv?: boolean
  useStockMedia?: boolean
  graphql?: GraphqlProviderOptions
  /** Optimizely provider options (required when provider is 'optimizely') */
  optimizely?: OptimizelyProviderOptions
  /** Umbraco Compose provider options (required when provider is 'umbraco-compose') */
  umbracoCompose?: UmbracoComposeProviderOptions
  /** Include data/site.ts static snapshot for debugging. Default: false (skipped for UCS provider) */
  includeStaticSnapshot?: boolean
  /** Enable verbose logging for internal operations like directory cleanup */
  verbose?: boolean
}

export interface GeneratedFile {
  path: string
  contents: string | Buffer
  mode?: number
}

export interface ComponentManifestEntry {
  id: string
  componentType?: ComponentType
  region?: PageTemplateRegionKey
  propKeys: string[]
  loaderKey?: string | null
}

export interface PageManifestEntry {
  pageId: string
  fullPath: string
  canonicalFullPath: string
  templateKey: string | null
  componentTypes: ComponentType[]
  regionSummary: SnapshotRegionSummary[]
  title: string
  slugSegments: string[]
  canonicalSlugSegments: string[]
  loaders: string[]
  components: ComponentManifestEntry[]
}

export interface SharedComponentManifestEntry {
  sharedComponentId: string
  name: string
  componentType: ComponentType
  componentTypeId?: string
  usageCount: number
  payload: SnapshotSharedComponent['content'] | null
  config: SnapshotSharedComponent['config']
}

export interface RouteManifestEntry {
  pageId: string
  fullPath: string
  canonicalFullPath: string
  routePath: string
  canonicalRoutePath: string
  segments: string[]
  canonicalSegments: string[]
  title: string
}

export interface LoaderManifestEntry {
  loaderKey: string
  componentTypes: ComponentType[]
  componentIds: string[]
  pageIds: string[]
  usageCount: number
}

export interface GenerationManifest {
  siteId: string
  siteName: string
  provider: ProviderKind
  generatedAt: string
  pages: PageManifestEntry[]
  sharedComponents: SharedComponentManifestEntry[]
  routes: RouteManifestEntry[]
  loaders: LoaderManifestEntry[]
}

export interface GenerationResult {
  files: GeneratedFile[]
  snapshot: SiteSnapshot
  diagnostics: GeneratorDiagnostic[]
  manifest: GenerationManifest
  diagnosticSummary: DiagnosticsSummary
  routes: RouteDefinition[]
  slugRegistry: SlugRegistryEntry[]
  overwroteOutput: boolean
  mediaDiagnostics: MediaDiagnosticsReport
}

export interface ComponentRendererDefinition {
  id: string
  componentType: ComponentType
  region?: PageTemplateRegionKey
  importName: string
  propsIdentifier: string
  propsLiteral: string
}

export interface MappedComponentDefinition {
  id: string
  componentType?: ComponentType
  importName?: string
  props: Record<string, unknown>
  region?: PageTemplateRegionKey
  loaderKey?: string | null
  original: ComponentInstance
  diagnostics: GeneratorDiagnostic[]
}

export interface MappedPageDefinition {
  pageId: string
  fullPath: string
  templateKey: string | null
  template?: PageTemplateRegistration
  components: MappedComponentDefinition[]
}

export interface RouteDefinition {
  pageId: string
  fullPath: string
  canonicalFullPath: string
  routePath: string
  canonicalRoutePath: string
  segments: string[]
  canonicalSegments: string[]
  title: string
  templateKey: string | null
}
