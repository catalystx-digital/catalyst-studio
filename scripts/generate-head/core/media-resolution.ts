import { extractAltText } from '@/lib/services/export/helpers/media-reference-utils'
import { resolveUniversalMediaService } from '@/lib/services/export/helpers/media-service-loader'
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'
import type { GeneratorDiagnostic, SiteSnapshot } from './types'

type MediaResolutionSource = 'public' | 'original' | 'signed'

export interface MediaIngestWarningEntry {
  url: string
  reason: string
  normalizedUrl?: string
  pageUrl?: string
  componentType?: string
  fieldPath?: string
}

export interface ResolvedMediaEntry {
  mediaId: string
  url: string
  source: MediaResolutionSource
  pageId?: string
  pageTitle?: string
  pagePath?: string
  componentId?: string
  componentType?: string
  sharedComponentId?: string
  path: string
  renditionsAttached: boolean
  renditionCount: number
}

export interface UnresolvedMediaEntry {
  mediaId: string
  reason: 'service-unavailable' | 'asset-not-found' | 'missing-url'
  pageId?: string
  pageTitle?: string
  pagePath?: string
  componentId?: string
  componentType?: string
  sharedComponentId?: string
  path: string
  fallbackUrl?: string
}

export interface MediaDiagnosticsReport {
  summary: {
    references: number
    resolved: number
    unresolved: number
    serviceAvailable: boolean
    assetsLoaded: number
    placeholders: number
    resolvedWithStableUrl: number
    resolvedWithSignedFallback: number
    ingestWarnings: number
    referencesWithRenditions: number
    fallbackUrlUsage: number
  }
  resolved: ResolvedMediaEntry[]
  unresolved: UnresolvedMediaEntry[]
  placeholders: PlaceholderReplacement[]
  ingestWarnings: MediaIngestWarningEntry[]
}

export interface PlaceholderReplacement {
  originalMediaId?: string
  placeholderId: string
  url: string
  category: string
  pageId?: string
  pageTitle?: string
  pagePath?: string
  componentId?: string
  componentType?: string
  sharedComponentId?: string
  path: string
  attribution?: {
    text: string
    url: string
  }
}

export const createEmptyMediaDiagnosticsReport = (): MediaDiagnosticsReport => ({
  summary: {
    references: 0,
    resolved: 0,
    unresolved: 0,
    serviceAvailable: true,
    assetsLoaded: 0,
    placeholders: 0,
    resolvedWithStableUrl: 0,
    resolvedWithSignedFallback: 0,
    ingestWarnings: 0,
    referencesWithRenditions: 0,
    fallbackUrlUsage: 0
  },
  resolved: [],
  unresolved: [],
  placeholders: [],
  ingestWarnings: []
})

export interface MediaReferenceHandle {
  mediaId: string
  target: Record<string, unknown>
  path: string
  pageId?: string
  pageTitle?: string
  pagePath?: string
  componentId?: string
  componentType?: string
  sharedComponentId?: string
}

interface CollectContext {
  pageId?: string
  pageTitle?: string
  pagePath?: string
  componentId?: string
  componentType?: string
  sharedComponentId?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const joinPath = (parent: string | undefined, segment: string): string =>
  parent && parent.length > 0 ? `${parent}.${segment}` : segment

const joinArrayPath = (parent: string | undefined, index: number): string =>
  `${parent ?? ''}[${index}]`

const updateAltTextMap = (
  mediaId: string,
  record: Record<string, unknown>,
  altTextByMediaId: Map<string, string | null>
): void => {
  const altCandidate = extractAltText(record)
  if (!altTextByMediaId.has(mediaId)) {
    altTextByMediaId.set(mediaId, altCandidate ?? null)
  } else if (!altTextByMediaId.get(mediaId) && altCandidate) {
    altTextByMediaId.set(mediaId, altCandidate)
  }
}

const collectReferences = (
  value: unknown,
  context: CollectContext,
  references: MediaReferenceHandle[],
  altTextByMediaId: Map<string, string | null>,
  visited: WeakSet<object> = new WeakSet(),
  currentPath?: string
): void => {
  if (value === null || value === undefined) {
    return
  }
  if (typeof value !== 'object') {
    return
  }
  if (visited.has(value as object)) {
    return
  }
  visited.add(value as object)

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const nextPath = joinArrayPath(currentPath, index)
      collectReferences(entry, context, references, altTextByMediaId, visited, nextPath)
    })
    return
  }

  const record = value as Record<string, unknown>
  const mediaIdRaw = record.mediaId
  const mediaId = typeof mediaIdRaw === 'string' ? mediaIdRaw.trim() : ''
  if (mediaId) {
    updateAltTextMap(mediaId, record, altTextByMediaId)
    references.push({
      mediaId,
      target: record,
      path: currentPath ?? '',
      pageId: context.pageId,
      pageTitle: context.pageTitle,
      pagePath: context.pagePath,
      componentId: context.componentId,
      componentType: context.componentType,
      sharedComponentId: context.sharedComponentId
    })
  }

  Object.entries(record).forEach(([key, child]) => {
    const nextPath = joinPath(currentPath, key)
    collectReferences(child, context, references, altTextByMediaId, visited, nextPath)
  })
}

const resolveAssetUrl = (asset: UniversalMediaAsset | undefined): { url?: string; source?: MediaResolutionSource } => {
  if (!asset) {
    return {}
  }
  if (asset.publicUrl) {
    return { url: asset.publicUrl, source: 'public' }
  }
  if (asset.originalUrl) {
    return { url: asset.originalUrl, source: 'original' }
  }
  if (asset.signedUrl) {
    return { url: asset.signedUrl, source: 'signed' }
  }
  return {}
}

const normalizeFallbackUrl = (record: Record<string, unknown>): string | undefined => {
  const candidates: Array<unknown> = [
    record.src,
    record.originalUrl,
    record.url,
    record.href
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return undefined
}

export async function resolveSnapshotMedia(
  snapshot: SiteSnapshot,
  websiteId: string,
  options?: { ingestWarnings?: MediaIngestWarningEntry[] }
): Promise<{
  diagnostics: GeneratorDiagnostic[]
  report: MediaDiagnosticsReport
  unresolvedReferences: MediaReferenceHandle[]
}> {
  const references: MediaReferenceHandle[] = []
  const altTextByMediaId = new Map<string, string | null>()

  snapshot.pages.forEach(page => {
    page.components.forEach(component => {
      const baseContext: CollectContext = {
        pageId: page.id,
        pageTitle: page.title,
        pagePath: page.fullPath,
        componentId: component.id,
        componentType: component.componentType ?? component.type
      }
      collectReferences(component.props, baseContext, references, altTextByMediaId, new WeakSet(), 'props')
      collectReferences(component.content, baseContext, references, altTextByMediaId, new WeakSet(), 'content')
      collectReferences(component.metadata, baseContext, references, altTextByMediaId, new WeakSet(), 'metadata')
      collectReferences(component.styles, baseContext, references, altTextByMediaId, new WeakSet(), 'styles')
    })
  })

  snapshot.sharedComponents.forEach(sharedComponent => {
    const baseContext: CollectContext = {
      sharedComponentId: sharedComponent.id,
      componentType: sharedComponent.componentType,
      pageTitle: sharedComponent.name
    }
    collectReferences(sharedComponent.content, baseContext, references, altTextByMediaId, new WeakSet(), 'content')
    collectReferences(sharedComponent.config, baseContext, references, altTextByMediaId, new WeakSet(), 'config')
  })

  const ingestWarnings = options?.ingestWarnings ?? []

  if (references.length === 0) {
    return {
      diagnostics: [],
      report: {
        summary: {
          references: 0,
          resolved: 0,
          unresolved: 0,
          serviceAvailable: true,
          assetsLoaded: 0,
          placeholders: 0,
          resolvedWithStableUrl: 0,
          resolvedWithSignedFallback: 0,
          ingestWarnings: ingestWarnings.length,
          referencesWithRenditions: 0,
          fallbackUrlUsage: 0
        },
        resolved: [],
        unresolved: [],
        placeholders: [],
        ingestWarnings
      },
      unresolvedReferences: []
    }
  }

  const uniqueMediaIds = new Set(references.map(ref => ref.mediaId))
  const diagnostics: GeneratorDiagnostic[] = []
  const resolved: ResolvedMediaEntry[] = []
  const unresolved: UnresolvedMediaEntry[] = []
  const unresolvedReferenceHandles: MediaReferenceHandle[] = []
  let resolvedWithSignedFallback = 0
  let resolvedWithStableUrl = 0
  let referencesWithRenditions = 0
  let fallbackUrlUsage = 0

  const mediaService = await resolveUniversalMediaService()
  if (!mediaService) {
    diagnostics.push({
      level: 'warn',
      code: 'MEDIA_SERVICE_UNAVAILABLE',
      message: 'Universal media service is unavailable; media references will retain existing URLs.',
      context: {
        websiteId,
        referenceCount: references.length
      }
    })

    let fallbackFilled = 0
    references.forEach(reference => {
      const fallbackUrl = normalizeFallbackUrl(reference.target)
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
        fallbackFilled += 1
      }
      unresolved.push({
        mediaId: reference.mediaId,
        reason: 'service-unavailable',
        pageId: reference.pageId,
        pageTitle: reference.pageTitle,
        pagePath: reference.pagePath,
        componentId: reference.componentId,
        componentType: reference.componentType,
        sharedComponentId: reference.sharedComponentId,
        path: reference.path || '',
        fallbackUrl
      })
      unresolvedReferenceHandles.push(reference)
    })

    return {
      diagnostics,
      report: {
        summary: {
          references: references.length,
          resolved: 0,
          unresolved: references.length,
          serviceAvailable: false,
          assetsLoaded: 0,
          placeholders: 0,
          resolvedWithStableUrl: 0,
          resolvedWithSignedFallback: 0,
          ingestWarnings: ingestWarnings.length,
          referencesWithRenditions: 0,
          fallbackUrlUsage: fallbackFilled
        },
        resolved,
        unresolved,
        placeholders: [],
        ingestWarnings
      },
      unresolvedReferences: unresolvedReferenceHandles
    }
  }

  let assets: Map<string, UniversalMediaAsset> = new Map()
  try {
    assets = await mediaService.getAssetsForWebsiteByIds(websiteId, uniqueMediaIds, {
      altTextByMediaId: altTextByMediaId
    })
  } catch (error) {
    diagnostics.push({
      level: 'warn',
      code: 'MEDIA_ASSET_LOAD_FAILED',
      message: 'Failed to load media assets for snapshot; media references will retain existing URLs.',
      context: {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      }
    })

    let fallbackFilled = 0
    references.forEach(reference => {
      const fallbackUrl = normalizeFallbackUrl(reference.target)
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
        fallbackFilled += 1
      }
      unresolved.push({
        mediaId: reference.mediaId,
        reason: 'service-unavailable',
        pageId: reference.pageId,
        pageTitle: reference.pageTitle,
        pagePath: reference.pagePath,
        componentId: reference.componentId,
        componentType: reference.componentType,
        sharedComponentId: reference.sharedComponentId,
        path: reference.path || '',
        fallbackUrl
      })
      unresolvedReferenceHandles.push(reference)
    })

    return {
      diagnostics,
      report: {
        summary: {
          references: references.length,
          resolved: 0,
          unresolved: references.length,
          serviceAvailable: true,
          assetsLoaded: 0,
          placeholders: 0,
          resolvedWithStableUrl: 0,
          resolvedWithSignedFallback: 0,
          ingestWarnings: ingestWarnings.length,
          referencesWithRenditions: 0,
          fallbackUrlUsage: fallbackFilled
        },
        resolved,
        unresolved,
        placeholders: [],
        ingestWarnings
      },
      unresolvedReferences: unresolvedReferenceHandles
    }
  }

  references.forEach(reference => {
    const asset = assets.get(reference.mediaId)
    const { url, source } = resolveAssetUrl(asset)

    if (url && source) {
      let normalizedRenditions: Array<{ src: string; width: number | null; height: number | null }> = []
      reference.target.src = url
      if (!reference.target.originalUrl && asset?.originalUrl) {
        reference.target.originalUrl = asset.originalUrl
      }
      if (!reference.target.alt && asset?.altText) {
        reference.target.alt = asset.altText
      }
      if (Array.isArray(asset?.renditions) && asset.renditions.length > 0) {
        normalizedRenditions = asset.renditions
          .map(rendition => {
            const candidateUrl =
              typeof rendition.publicUrl === 'string' && rendition.publicUrl.trim().length > 0
                ? rendition.publicUrl.trim()
                : typeof rendition.signedUrl === 'string' && rendition.signedUrl.trim().length > 0
                  ? rendition.signedUrl.trim()
                  : undefined
            if (!candidateUrl) {
              return null
            }
            return {
              src: candidateUrl,
              width: typeof rendition.width === 'number' ? rendition.width : null,
              height: typeof rendition.height === 'number' ? rendition.height : null
            }
          })
          .filter((entry): entry is { src: string; width: number | null; height: number | null } => Boolean(entry))
        if (normalizedRenditions.length > 0) {
          reference.target.renditions = normalizedRenditions
        }
      }
      resolved.push({
        mediaId: reference.mediaId,
        url,
        source,
        pageId: reference.pageId,
        pageTitle: reference.pageTitle,
        pagePath: reference.pagePath,
        componentId: reference.componentId,
        componentType: reference.componentType,
        sharedComponentId: reference.sharedComponentId,
        path: reference.path || '',
        renditionsAttached: normalizedRenditions.length > 0,
        renditionCount: normalizedRenditions.length
      })
      if (normalizedRenditions.length > 0) {
        referencesWithRenditions += 1
      }
      if (source === 'signed') {
        resolvedWithSignedFallback += 1
        diagnostics.push({
          level: 'warn',
          code: 'MEDIA_SIGNED_URL_FALLBACK',
          message: 'Stable media URL unavailable; using signed URL that may expire.',
          context: {
            mediaId: reference.mediaId,
            pageId: reference.pageId,
            pageTitle: reference.pageTitle,
            pagePath: reference.pagePath,
            componentId: reference.componentId,
            componentType: reference.componentType,
            sharedComponentId: reference.sharedComponentId,
            path: reference.path,
            fallbackReason: 'missing-public-and-original-url',
            availableUrls: {
              public: asset?.publicUrl ?? null,
              original: asset?.originalUrl ?? null,
              signed: asset?.signedUrl ?? null
            }
          }
        })
      } else {
        resolvedWithStableUrl += 1
      }
      return
    }

    const fallbackUrl = normalizeFallbackUrl(reference.target)
    if (fallbackUrl && typeof reference.target.src !== 'string') {
      reference.target.src = fallbackUrl
      fallbackUrlUsage += 1
    }

    const reason: UnresolvedMediaEntry['reason'] = asset ? 'missing-url' : 'asset-not-found'
    unresolved.push({
      mediaId: reference.mediaId,
      reason,
      pageId: reference.pageId,
      pageTitle: reference.pageTitle,
      pagePath: reference.pagePath,
      componentId: reference.componentId,
      componentType: reference.componentType,
      sharedComponentId: reference.sharedComponentId,
      path: reference.path || '',
      fallbackUrl
    })
    unresolvedReferenceHandles.push(reference)

    diagnostics.push({
      level: 'warn',
      code: reason === 'asset-not-found' ? 'MEDIA_ASSET_MISSING' : 'MEDIA_URL_MISSING',
      message:
        reason === 'asset-not-found'
          ? 'Media asset could not be resolved for referenced mediaId.'
          : 'Media asset resolved without usable URL; falling back to existing source.',
      context: {
        mediaId: reference.mediaId,
        pageId: reference.pageId,
        pageTitle: reference.pageTitle,
        componentId: reference.componentId,
        componentType: reference.componentType,
        sharedComponentId: reference.sharedComponentId,
        path: reference.path,
        fallbackUrl
      }
    })
  })

  return {
    diagnostics,
    report: {
      summary: {
        references: references.length,
        resolved: resolved.length,
        unresolved: unresolved.length,
        serviceAvailable: true,
        assetsLoaded: assets.size,
        placeholders: 0,
        resolvedWithStableUrl,
        resolvedWithSignedFallback,
        ingestWarnings: ingestWarnings.length,
        referencesWithRenditions,
        fallbackUrlUsage
      },
      resolved,
      unresolved,
      placeholders: [],
      ingestWarnings
    },
    unresolvedReferences: unresolvedReferenceHandles
  }
}
