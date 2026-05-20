import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { coerceComponentType } from '../../core/component-mapper'
import type { ComponentMappingSummary } from '../../core/component-mapper'
import type {
  ComponentManifestEntry,
  GenerationManifest,
  ProviderKind,
  RouteDefinition,
  SiteSnapshot
} from '../../core/types'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'

export function buildManifest(
  snapshot: SiteSnapshot,
  provider: ProviderKind,
  routes: RouteDefinition[],
  componentSummary: ComponentMappingSummary
): GenerationManifest {
  const componentManifestByPage = new Map<string, { components: ComponentManifestEntry[]; loaderKeys: Set<string> }>()
  const loaderUsage = new Map<string, {
    componentTypes: Set<ComponentType>
    componentIds: Set<string>
    pageIds: Set<string>
  }>()
  const routeByPageId = new Map(routes.map(route => [route.pageId, route]))

  const normalizeLoaderKey = (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  componentSummary.pages.forEach(page => {
    const loaderKeys = new Set<string>()
    const entries: ComponentManifestEntry[] = page.components.map(component => {
      const propKeys = Object.keys(component.props ?? {}).sort()
      const loaderKey = normalizeLoaderKey(component.loaderKey)
      if (loaderKey) {
        loaderKeys.add(loaderKey)
        const usage = loaderUsage.get(loaderKey) ?? {
          componentTypes: new Set<ComponentType>(),
          componentIds: new Set<string>(),
          pageIds: new Set<string>()
        }
        if (component.componentType) {
          usage.componentTypes.add(component.componentType)
        }
        usage.componentIds.add(component.id)
        usage.pageIds.add(page.pageId)
        loaderUsage.set(loaderKey, usage)
      }

      return {
        id: component.id,
        componentType: component.componentType,
        region: component.region,
        propKeys,
        loaderKey: loaderKey ?? undefined
      }
    })
    componentManifestByPage.set(page.pageId, { components: entries, loaderKeys })
  })

  return {
    siteId: snapshot.site.id,
    siteName: snapshot.site.name,
    provider,
    generatedAt: new Date().toISOString(),
    pages: snapshot.pages.map(page => {
      const manifestEntry = componentManifestByPage.get(page.id)
      const routeEntry = routeByPageId.get(page.id)
      const slugSegments = routeEntry?.segments ?? page.fullPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
      const canonicalSlugSegments =
        routeEntry?.canonicalSegments ??
        slugSegments.map(segment => segment.toLowerCase())
      const canonicalFullPath = routeEntry?.canonicalFullPath ?? (
        canonicalSlugSegments.length > 0 ? `/${canonicalSlugSegments.join('/')}` : '/'
      )

      return {
        pageId: page.id,
        fullPath: page.fullPath,
        canonicalFullPath,
        templateKey: page.templateKey,
        componentTypes: manifestEntry ? manifestEntry.components.map(component => component.componentType).filter((type): type is ComponentType => type !== undefined) : [],
        regionSummary: page.regions,
        title: page.title,
        slugSegments,
        canonicalSlugSegments,
        loaders: manifestEntry ? Array.from(manifestEntry.loaderKeys).sort() : [],
        components: manifestEntry ? manifestEntry.components : []
      }
    }),
    sharedComponents: snapshot.sharedComponents.map(shared => {
      const normalizedType = coerceComponentType(shared.componentType)
      return {
        sharedComponentId: shared.id,
        name: shared.name,
        componentType: normalizedType ?? ComponentType.TextBlock, // Fallback for unrecognized types
        componentTypeId: shared.componentTypeId,
        usageCount: snapshot.pages.reduce((count, page) => {
          return (
            count +
            page.components.filter(component => resolveSharedComponentReference(component) === shared.id).length
          )
        }, 0),
        payload: shared.content ?? null,
        config: shared.config
      }
    }),
    routes: routes.map(route => ({
      pageId: route.pageId,
      fullPath: route.fullPath,
      canonicalFullPath: route.canonicalFullPath,
      routePath: route.routePath,
      canonicalRoutePath: route.canonicalRoutePath,
      segments: route.segments,
      canonicalSegments: route.canonicalSegments,
      title: route.title
    })),
    loaders: Array.from(loaderUsage.entries()).map(([loaderKey, usage]) => ({
      loaderKey,
      componentTypes: Array.from(usage.componentTypes).sort(),
      componentIds: Array.from(usage.componentIds).sort(),
      pageIds: Array.from(usage.pageIds).sort(),
      usageCount: usage.componentIds.size
    })).sort((a, b) => a.loaderKey.localeCompare(b.loaderKey))
  }
}
