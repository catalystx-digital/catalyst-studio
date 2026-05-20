import type {
  DataSourceKind,
  GeneratorDiagnostic,
  GraphqlProviderOptions,
  OptimizelyProviderOptions,
  PagePayload,
  ProviderContextSnapshot,
  ProviderRequestContext,
  RedirectPayload,
  SharedComponentPayload,
  SiteSnapshot,
  SlugSegments,
  UmbracoComposeProviderOptions
} from './types'

export interface HeadDataProvider {
  readonly name: string
  readonly supportsLiveData: boolean
  loadSnapshot(): Promise<ProviderContextSnapshot | SiteSnapshot>
  resolvePageBySlug(slug: SlugSegments, context: ProviderRequestContext): Promise<PagePayload | null>
  /** Resolve a redirect by source path. Returns null if no redirect exists. */
  resolveRedirectByPath?(path: string, context: ProviderRequestContext): Promise<RedirectPayload | null>
  preloadSharedComponents?(
    ids: string[],
    context: ProviderRequestContext
  ): Promise<Record<string, SharedComponentPayload>>
  getDiagnostics?(): GeneratorDiagnostic[] | Promise<GeneratorDiagnostic[]>
}

export interface ProviderFactoryContext {
  websiteId?: string
  templateOverrideKey?: string
  designConcept?: string
  dataSource?: DataSourceKind
  graphql?: GraphqlProviderOptions
  optimizely?: OptimizelyProviderOptions
  umbracoCompose?: UmbracoComposeProviderOptions
}

export type ProviderFactory = (context: ProviderFactoryContext) => HeadDataProvider
