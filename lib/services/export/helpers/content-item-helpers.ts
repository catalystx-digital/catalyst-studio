import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'

import FieldShapeDetector from '../detection/field-shape-detector'
import type { ContentItemExport } from '../types'
import type { UnifiedContent } from '../content-orchestrator'
import { collectMediaReferences } from './media-reference-utils'
import { isMediaResolutionEnabled } from './media-feature-flags'
import { resolveUniversalMediaService } from './media-service-loader'
import type { UniversalMediaService } from './media-service-loader'

export const generateSlugFromTitle = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const transformUnifiedContentToExport = (
  unifiedContent: UnifiedContent[]
): ContentItemExport[] => {
  const rawMode = String(process.env.EXPORT_DETECTION_MODE || 'off').toLowerCase()
  const normalizedMode: 'off' | 'dry-run' = rawMode === 'off' ? 'off' : 'dry-run'
  const minConfidence = (() => {
    const v = Number(process.env.EXPORT_DETECTION_MIN_CONFIDENCE)
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6
  })()

  const detector = normalizedMode === 'off'
    ? null
    : new FieldShapeDetector({ mode: 'dry-run', minConfidence, logger: () => {} })

  const maybeDetectAndLog = (itemId: string, value: unknown, path: string) => {
    if (!detector) return
    try {
      const result = detector.detect(value, path)
      if (result.mode === 'dry-run' && result.meetsThreshold) {
        console.log('[DETECTION] FieldShape', {
          id: itemId,
          path,
          classification: result.classification,
          confidence: Number(result.confidence.toFixed(3)),
          threshold: minConfidence,
          action: 'log-only'
        })
      }
    } catch (err) {
      console.warn('FieldShape detection failed for path', path, err)
    }
  }

  return unifiedContent.map(item => {
    if (detector) {
      const basePath = 'content'
      maybeDetectAndLog(item.id, item.content, basePath)
      if (item && item.content && typeof item.content === 'object') {
        try {
          const obj = item.content as Record<string, unknown>
          for (const key of Object.keys(obj)) {
            const subPath = `${basePath}.${key}`
            maybeDetectAndLog(item.id, obj[key], subPath)
          }
        } catch {}
      }
    }

    const slug = item.url
      ? item.url.replace(/^\//, '').replace(/\$/, '') || 'home'
      : generateSlugFromTitle(item.title)

    return {
      id: item.id,
      contentTypeId: item.contentTypeId,
      title: item.title,
      slug,
      content: item.content,
      metadata: {
        ...item.metadata,
        publishedAt: item.publishedAt
      }
    } satisfies ContentItemExport
  })
}

export interface MediaAttachmentOptions {
  mediaService?: UniversalMediaService
}

export const attachMediaAssetsToContentItems = async (
  unifiedContent: UnifiedContent[],
  contentItems: ContentItemExport[],
  options?: MediaAttachmentOptions
): Promise<ContentItemExport[]> => {
  if (contentItems.length === 0) {
    return contentItems
  }

  if (!isMediaResolutionEnabled()) {
    return contentItems
  }

  const mediaService = options?.mediaService ?? await resolveUniversalMediaService()
  if (!mediaService) {
    return contentItems
  }

  const result = contentItems.map(item => ({ ...item }))
  const resultById = new Map(result.map(item => [item.id, item]))

  const mediaRefsByItem = new Map<string, { websiteId: string; refs: Map<string, { altText?: string | null }> }>()
  const mediaIdsByWebsite = new Map<string, Set<string>>()
  const altTextByWebsite = new Map<string, Map<string, string | null>>()

  for (const item of unifiedContent) {
    const target = resultById.get(item.id)
    if (!target || !item.websiteId) {
      continue
    }

    const references = new Map<string, { altText?: string | null }>()
    collectMediaReferences(item.content, references)
    if (references.size === 0) {
      continue
    }

    mediaRefsByItem.set(item.id, { websiteId: item.websiteId, refs: references })

    let idSet = mediaIdsByWebsite.get(item.websiteId)
    if (!idSet) {
      idSet = new Set<string>()
      mediaIdsByWebsite.set(item.websiteId, idSet)
    }

    let altMap = altTextByWebsite.get(item.websiteId)
    if (!altMap) {
      altMap = new Map<string, string | null>()
      altTextByWebsite.set(item.websiteId, altMap)
    }

    for (const [mediaId, ref] of references.entries()) {
      idSet.add(mediaId)
      if (ref.altText && (!altMap.has(mediaId) || !altMap.get(mediaId))) {
        altMap.set(mediaId, ref.altText)
      }
    }
  }

  if (mediaRefsByItem.size === 0) {
    return result
  }

  const assetsByWebsite = new Map<string, Map<string, UniversalMediaAsset>>()
  for (const [websiteId, mediaIds] of mediaIdsByWebsite.entries()) {
    try {
      const altContext = altTextByWebsite.get(websiteId)
      const assets = await mediaService.getAssetsForWebsiteByIds(
        websiteId,
        mediaIds,
        altContext ? { altTextByMediaId: altContext } : undefined
      )
      assetsByWebsite.set(websiteId, assets)
    } catch (error) {
      console.warn('attachMediaAssetsToContentItems: failed to resolve media assets', {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  for (const [itemId, refData] of mediaRefsByItem.entries()) {
    const target = resultById.get(itemId)
    if (!target) {
      continue
    }
    const assetsForWebsite = assetsByWebsite.get(refData.websiteId)
    if (!assetsForWebsite) {
      continue
    }

    const mediaAssets: UniversalMediaAsset[] = []
    for (const [mediaId, ref] of refData.refs.entries()) {
      const baseAsset = assetsForWebsite.get(mediaId)
      if (!baseAsset) {
        continue
      }
      const enriched: UniversalMediaAsset = { ...baseAsset }
      if ((!enriched.altText || enriched.altText.length === 0) && ref.altText) {
        enriched.altText = ref.altText
      }
      mediaAssets.push(enriched)
    }

    if (mediaAssets.length > 0) {
      target.mediaAssets = mediaAssets
    }
  }

  return result
}

