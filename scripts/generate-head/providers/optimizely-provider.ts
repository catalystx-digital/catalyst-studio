/**
 * Optimizely Provider - Build-time snapshot generation with runtime page resolution
 *
 * This provider queries the Optimizely Graph API at build time to:
 * 1. Discover all pages and build a slug registry for SSG
 * 2. Extract site structure for navigation and breadcrumbs
 * 3. Populate shared component cache
 *
 * At runtime, pages are resolved via GraphQL for full component content.
 *
 * Design System:
 * Unlike UCS provider, Optimizely doesn't have its own design system.
 * To apply Catalyst Studio's design system, provide a `designSystemSource` option
 * that fetches the design system from a Catalyst Studio website via GraphQL.
 */

import type { HeadDataProvider, ProviderFactory } from '../core/provider'
import type {
  DesignSystemSourceOptions,
  GeneratorDiagnostic,
  PagePayload,
  PageStructurePayload,
  ProviderContextSnapshot,
  ProviderRequestContext,
  SharedComponentPayload,
  SlugSegments,
  SnapshotSharedComponent
} from '../core/types'
import {
  buildOptimelySiteSnapshot,
  OptimizelyPageResolver
} from '@/lib/studio/headless/optimizely'
import {
  canonicalSlugKey,
  canonicalizeSlugSegments,
  sanitizeSlugSegments
} from '@/lib/studio/utils/slug-canonicalizer'
import { fetchDesignSystemFromGraphql } from '../utils/design-system-fetcher'
import { logger } from '../utils/logger'

class OptimizelyHeadDataProvider implements HeadDataProvider {
  readonly name = 'optimizely'
  readonly supportsLiveData = true
  private diagnostics: GeneratorDiagnostic[] = []
  private readonly slugCache = new Map<string, PagePayload>()
  private readonly sharedComponentCache = new Map<string, SnapshotSharedComponent>()
  private pageResolver: OptimizelyPageResolver | null = null
  private readonly designSystemSource?: DesignSystemSourceOptions

  constructor(
    private readonly gateway: string,
    private readonly singleKey: string,
    private readonly startPageId?: string,
    private readonly locale?: string,
    private readonly debug?: boolean,
    designSystemSource?: DesignSystemSourceOptions
  ) {
    this.designSystemSource = designSystemSource
    const endpoint = gateway.endsWith('/content/v2') ? gateway : `${gateway}/content/v2`
    this.pageResolver = new OptimizelyPageResolver({
      endpoint,
      singleKey,
      locale,
      stripLocalePrefix: true,
      debug
    })
  }

  private clonePayload<T>(payload: T): T {
    return JSON.parse(JSON.stringify(payload)) as T
  }

  async loadSnapshot(): Promise<ProviderContextSnapshot> {
    this.slugCache.clear()
    this.diagnostics = []

    try {
      // Fetch design system from Catalyst Studio GraphQL if source is configured
      let designSystem: import('@/lib/studio/import/types/design-system.types').DesignSystem | undefined

      if (this.designSystemSource) {
        logger.info('Fetching design system from Catalyst Studio', {
          websiteId: this.designSystemSource.websiteId,
          designConcept: this.designSystemSource.designConcept ?? '(default)'
        })

        const result = await fetchDesignSystemFromGraphql(this.designSystemSource)

        // Merge design system diagnostics
        this.diagnostics.push(...result.diagnostics)

        if (result.designSystem) {
          designSystem = result.designSystem
          logger.info('Design system fetched successfully', {
            conceptId: result.conceptId,
            conceptName: result.conceptName,
            hasPalette: Boolean(result.designSystem.palette),
            hasTypography: Boolean(result.designSystem.typography)
          })
        } else {
          logger.warn('No design system found, using defaults', {
            websiteId: this.designSystemSource.websiteId
          })
        }
      }

      const { snapshot, diagnostics } = await buildOptimelySiteSnapshot({
        gateway: this.gateway,
        singleKey: this.singleKey,
        startPageId: this.startPageId,
        locale: this.locale ?? 'en',
        debug: this.debug,
        designSystem
      })

      this.diagnostics = [...this.diagnostics, ...diagnostics]

      // Cache shared components
      snapshot.sharedComponents.forEach(component => {
        this.sharedComponentCache.set(component.id, this.clonePayload(component))
      })

      return {
        ...snapshot,
        diagnostics: this.diagnostics
      }
    } catch (error) {
      this.diagnostics.push({
        level: 'error',
        code: 'OPTIMIZELY_SNAPSHOT_ERROR',
        message: 'Failed to build Optimizely site snapshot',
        context: {
          gateway: this.gateway,
          error: error instanceof Error ? error.message : String(error)
        }
      })

      // Return minimal snapshot on error
      return {
        site: {
          id: 'optimizely-site',
          name: 'Optimizely Site (Error)',
          description: 'Failed to load from Optimizely Graph'
        },
        pages: [],
        structure: [],
        sharedComponents: [],
        capturedAt: new Date().toISOString(),
        designSystem: null,
        diagnostics: this.diagnostics
      }
    }
  }

  async resolvePageBySlug(
    slug: SlugSegments,
    _context: ProviderRequestContext
  ): Promise<PagePayload | null> {
    const sanitized = sanitizeSlugSegments(slug)
    const canonical = canonicalizeSlugSegments(sanitized)
    const slugKey = canonicalSlugKey(canonical)

    // Check cache first
    if (this.slugCache.has(slugKey)) {
      const cached = this.slugCache.get(slugKey)
      return cached ? this.clonePayload(cached) : null
    }

    if (!this.pageResolver) {
      return null
    }

    try {
      const result = await this.pageResolver.resolvePageBySlug(canonical)

      if (!result) {
        this.slugCache.set(slugKey, null as unknown as PagePayload)
        return null
      }

      // Merge resolver diagnostics
      this.diagnostics.push(...result.diagnostics)

      // Update shared component cache
      result.sharedComponents.forEach(component => {
        this.sharedComponentCache.set(component.id, this.clonePayload(component))
      })

      // Build structure payload from page info
      const structure: PageStructurePayload | undefined = undefined

      const payload: PagePayload = {
        page: this.clonePayload(result.page),
        structure,
        sharedComponents: result.sharedComponents.map(c => this.clonePayload(c)),
        diagnostics: result.diagnostics
      }

      this.slugCache.set(slugKey, this.clonePayload(payload))
      return this.clonePayload(payload)
    } catch (error) {
      this.diagnostics.push({
        level: 'error',
        code: 'OPTIMIZELY_PAGE_RESOLVE_ERROR',
        message: 'Failed to resolve page from Optimizely',
        context: {
          slug: canonical,
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
    const result: Record<string, SharedComponentPayload> = {}

    ids.forEach(id => {
      const cached = this.sharedComponentCache.get(id)
      if (cached) {
        result[id] = this.clonePayload(cached)
      }
    })

    return result
  }

  async getDiagnostics(): Promise<GeneratorDiagnostic[]> {
    return this.diagnostics.map(d => ({ ...d }))
  }
}

export const createOptimizelyProvider: ProviderFactory = (context): HeadDataProvider => {
  const optimizely = context.optimizely
  if (!optimizely?.singleKey) {
    throw new Error(
      'The --optimizely-key flag is required when using the Optimizely provider'
    )
  }

  const gateway = optimizely.gateway ?? 'https://cg.optimizely.com'

  return new OptimizelyHeadDataProvider(
    gateway,
    optimizely.singleKey,
    optimizely.startPageId,
    optimizely.locale,
    optimizely.debug,
    optimizely.designSystemSource
  )
}
