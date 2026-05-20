import { PrismaClient } from '@/lib/generated/prisma'
import { buildUcsSiteSnapshot } from '@/lib/studio/headless/ucs/snapshot-builder'
import { loadSharedComponentsById, resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver'
import type { HeadDataProvider, ProviderFactory } from '../core/provider'
import type {
  GeneratorDiagnostic,
  PagePayload,
  PageStructurePayload,
  ProviderContextSnapshot,
  ProviderRequestContext,
  RedirectPayload,
  SharedComponentPayload,
  SiteSnapshot,
  SlugSegments
} from '../core/types'
import type { SnapshotSharedComponent } from '@/lib/studio/headless/site-snapshot/types'
import { ensureCliEnvLoaded } from '../utils/env'
import {
  canonicalizeSlugSegments,
  sanitizeSlugSegments
} from '@/lib/studio/utils/slug-canonicalizer'
import { UcsGraphqlHeadDataProvider } from './ucs-graphql-provider'
import { resolveContentReferences } from '@/lib/services/export/helpers/resolve-content-references'
import { createMediaUrlLoader } from '@/lib/services/content-reference/media-url-loader'
import { createPagePathLoader } from '@/lib/services/content-reference/page-path-loader'

function getPrismaClient(): PrismaClient {
  const globalForPrisma = globalThis as unknown as { __ucsProviderPrisma?: PrismaClient }
  if (!globalForPrisma.__ucsProviderPrisma) {
    globalForPrisma.__ucsProviderPrisma = new PrismaClient()
  }
  return globalForPrisma.__ucsProviderPrisma
}

class UcsHeadDataProvider implements HeadDataProvider {
  readonly name = 'ucs'
  readonly supportsLiveData = true
  private diagnostics: GeneratorDiagnostic[] = []
  // Note: We deliberately do NOT cache page payloads at the instance level.
  // Module-level/instance caches persist across ISR revalidations in warm serverless instances,
  // causing stale content to be served even after database updates.
  // Next.js ISR and unstable_cache provide the caching layer instead.
  private readonly sharedComponentCache = new Map<string, SnapshotSharedComponent>()
  private assetOrigin?: string

  constructor(
    private readonly websiteId: string,
    private readonly templateOverrideKey?: string,
    private readonly designConcept?: string
  ) {}

  private clonePagePayload(payload: PagePayload): PagePayload {
    return JSON.parse(JSON.stringify(payload)) as PagePayload
  }

  async loadSnapshot(): Promise<ProviderContextSnapshot> {
    ensureCliEnvLoaded()
    const prisma = getPrismaClient()

    // Skip loading page content during export - pages are fetched at runtime via resolvePageBySlug()
    // This provider has supportsLiveData = true, so pages are loaded on-demand
    const { snapshot, diagnostics } = await buildUcsSiteSnapshot({
      prisma,
      websiteId: this.websiteId,
      templateOverrideKey: this.templateOverrideKey,
      designConcept: this.designConcept,
      skipPageContent: true
    })
    this.diagnostics = diagnostics.slice()
    this.assetOrigin = snapshot.site.origin
    this.cacheSharedComponents(snapshot)
    return { ...snapshot, diagnostics }
  }

  private cacheSharedComponents(snapshot: SiteSnapshot): void {
    this.sharedComponentCache.clear()
    snapshot.sharedComponents.forEach(component => {
      this.sharedComponentCache.set(
        component.id,
        JSON.parse(JSON.stringify(component)) as SnapshotSharedComponent
      )
    })
  }

  async resolvePageBySlug(slug: SlugSegments, _context: ProviderRequestContext): Promise<PagePayload | null> {
    ensureCliEnvLoaded()
    const requestedSlug = sanitizeSlugSegments(slug)
    const canonicalSlug = canonicalizeSlugSegments(requestedSlug)

    const prisma = getPrismaClient()

    try {
      const result = await resolveUcsPageBySlug({
        prisma,
        websiteId: this.websiteId,
        slug: canonicalSlug,
        originalSlug: requestedSlug,
        sharedComponentCache: this.sharedComponentCache,
        assetOrigin: this.assetOrigin
      })

      if (result.diagnostics.length > 0) {
        this.diagnostics.push(
          ...result.diagnostics.map(diagnostic => ({
            level: diagnostic.level,
            code: diagnostic.code,
            message: diagnostic.message,
            context: diagnostic.context
          }))
        )
      }

      if (!result.payload) {
        return null
      }

      const payload: PagePayload = {
        page: JSON.parse(JSON.stringify(result.payload.page)),
        structure: result.payload.structure
          ? (JSON.parse(JSON.stringify(result.payload.structure)) as PageStructurePayload)
          : undefined,
        sharedComponents: result.payload.sharedComponents.map(component =>
          JSON.parse(JSON.stringify(component)) as SharedComponentPayload
        ),
        diagnostics: result.payload.diagnostics.map(diagnostic => ({
          level: diagnostic.level,
          code: diagnostic.code,
          message: diagnostic.message,
          context: diagnostic.context
        }))
      }

      // Resolve content references (media and page references) in page components and shared components
      const mediaLoader = createMediaUrlLoader()
      const pageLoader = createPagePathLoader()
      await resolveContentReferences(payload.page, { mediaLoader, pageLoader })
      await Promise.all(
        payload.sharedComponents.map(component =>
          resolveContentReferences(component, { mediaLoader, pageLoader })
        )
      )

      return this.clonePagePayload(payload)
    } catch (error) {
      this.diagnostics.push({
        level: 'error',
        code: 'UCS_SLUG_RESOLUTION_ERROR',
        message: 'Failed to resolve slug via UCS provider',
        context: {
          requestedSlug,
          canonicalSlug,
          slugKey,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return null
    }
  }

  async preloadSharedComponents(
    ids: string[],
    _context: ProviderRequestContext
  ): Promise<Record<string, SharedComponentPayload>> {
    ensureCliEnvLoaded()
    if (ids.length === 0) {
      return {}
    }
    const prisma = getPrismaClient()

    try {
      const components = await loadSharedComponentsById(
        prisma,
        this.websiteId,
        ids,
        this.sharedComponentCache
      )
      return components.reduce<Record<string, SharedComponentPayload>>((acc, component) => {
        acc[component.id] = JSON.parse(JSON.stringify(component)) as SharedComponentPayload
        return acc
      }, {})
    } catch (error) {
      this.diagnostics.push({
        level: 'error',
        code: 'UCS_SHARED_COMPONENT_PRELOAD_ERROR',
        message: 'Failed to preload shared components',
        context: {
          componentIds: ids,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return {}
    }
  }

  async getDiagnostics(): Promise<GeneratorDiagnostic[]> {
    return this.diagnostics.map(entry => ({
      level: entry.level,
      code: entry.code,
      message: entry.message,
      context: entry.context ? { ...entry.context } : undefined
    }))
  }

  /**
   * Resolve a redirect by source path from the database.
   * Returns null if no active redirect exists for the given path.
   */
  async resolveRedirectByPath(path: string, _context: ProviderRequestContext): Promise<RedirectPayload | null> {
    ensureCliEnvLoaded()
    const prisma = getPrismaClient()

    // Normalize the path for lookup (lowercase, no leading/trailing slashes)
    const normalizedPath = path.toLowerCase().replace(/^\/+|\/+$/g, '')

    try {
      const redirect = await prisma.redirect.findFirst({
        where: {
          websiteId: this.websiteId,
          isActive: true,
          sourcePath: {
            in: [
              normalizedPath,
              `/${normalizedPath}`,
              normalizedPath === '' ? '/' : normalizedPath
            ]
          }
        }
      })

      if (!redirect) {
        return null
      }

      return {
        id: redirect.id,
        sourcePath: redirect.sourcePath,
        targetPath: redirect.targetPath,
        redirectType: redirect.redirectType,
        isActive: redirect.isActive,
        isExternal: redirect.isExternal,
        showInNav: redirect.showInNav,
        navLabel: redirect.navLabel ?? undefined,
        openInNewTab: redirect.openInNewTab
      }
    } catch (error) {
      this.diagnostics.push({
        level: 'error',
        code: 'UCS_REDIRECT_RESOLUTION_ERROR',
        message: 'Failed to resolve redirect via UCS provider',
        context: {
          path,
          normalizedPath,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return null
    }
  }
}

export const createUcsProvider: ProviderFactory = context => {
  const websiteId = context.websiteId
  if (!websiteId) {
    throw new Error('The --website-id flag is required when using the UCS provider')
  }

  if (context.dataSource === 'graphql') {
    if (!context.graphql?.endpoint) {
      throw new Error('GraphQL endpoint is required when --data-source graphql is selected')
    }
    const hasManualApiKey = typeof context.graphql?.apiKey === 'string' && context.graphql.apiKey.trim().length > 0
    const wantsAuto = Boolean(context.graphql?.autoManageKeys)
    const hasAutomationIdentity =
      typeof context.graphql?.apiAccess?.encodedUser === 'string' && context.graphql.apiAccess.encodedUser.trim().length > 0
        ? true
        : Boolean(context.graphql?.apiAccess?.cookies && context.graphql.apiAccess.cookies.trim().length > 0)

    if (!hasManualApiKey && !wantsAuto) {
      throw new Error('Provide graphql.apiKey or enable graphql.autoManageKeys when using the GraphQL data source')
    }

    if (wantsAuto && !hasAutomationIdentity) {
      throw new Error(
        'graphql.autoManageKeys requires apiAccess.encodedUser (preferred) or apiAccess.cookies for API Access authentication'
      )
    }

    return new UcsGraphqlHeadDataProvider({
      websiteId,
      templateOverrideKey: context.templateOverrideKey,
      designConcept: context.designConcept,
      graphql: context.graphql
    })
  }

  return new UcsHeadDataProvider(websiteId, context.templateOverrideKey, context.designConcept)
}
