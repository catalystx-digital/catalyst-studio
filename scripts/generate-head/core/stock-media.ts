import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MediaDiagnosticsReport, MediaReferenceHandle, PlaceholderReplacement } from './types'

interface StockMediaEntry {
  id: string
  url: string
  alt: string
  attribution?: {
    text: string
    url: string
  }
  license?: string
  orientation?: 'landscape' | 'portrait' | 'square'
}

type StockMediaCatalog = Record<string, StockMediaEntry[]>

let cachedCatalog: StockMediaCatalog | null = null

const loadCatalog = (): StockMediaCatalog => {
  if (cachedCatalog) {
    return cachedCatalog
  }
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const catalogPath = resolve(currentDir, '../assets/stock-media.json')
  const raw = readFileSync(catalogPath, 'utf-8')
  cachedCatalog = JSON.parse(raw) as StockMediaCatalog
  return cachedCatalog
}

const buildReferenceKey = (mediaId: string | undefined, path: string | undefined): string => {
  const idPart = mediaId ?? 'unknown'
  const pathPart = path ?? 'root'
  return `${idPart}::${pathPart}`
}

const determineCategory = (reference: MediaReferenceHandle): keyof StockMediaCatalog => {
  const type = (reference.componentType ?? '').toLowerCase()
  const path = (reference.path ?? '').toLowerCase()

  if (type.includes('hero')) {
    return 'hero'
  }
  if (type.includes('gallery') || path.includes('gallery') || path.includes('carousel')) {
    return 'gallery'
  }
  if (type.includes('card') || type.includes('feature') || path.includes('card')) {
    return 'card'
  }
  return 'general'
}

const selectAsset = (
  catalog: StockMediaCatalog,
  category: keyof StockMediaCatalog,
  usageTracker: Map<string, number>
): StockMediaEntry | null => {
  const entries = catalog[category] ?? catalog.general
  if (!entries || entries.length === 0) {
    return null
  }
  const current = usageTracker.get(category as string) ?? 0
  usageTracker.set(category as string, current + 1)
  return entries[current % entries.length]
}

interface ApplyFallbackParams {
  references: MediaReferenceHandle[]
  mediaDiagnostics: MediaDiagnosticsReport
}

export const applyStockMediaFallback = ({
  references,
  mediaDiagnostics
}: ApplyFallbackParams): PlaceholderReplacement[] => {
  if (references.length === 0) {
    return []
  }

  const catalog = loadCatalog()
  const usageTracker = new Map<string, number>()
  const replacements: PlaceholderReplacement[] = []
  const replacedKeys = new Set<string>()

  references.forEach(reference => {
    const existingSrc = typeof reference.target.src === 'string' ? reference.target.src.trim() : ''
    if (existingSrc) {
      return
    }

    const category = determineCategory(reference)
    const asset = selectAsset(catalog, category, usageTracker)
    if (!asset) {
      return
    }

    reference.target.src = asset.url
    reference.target.mediaId = null
    reference.target.placeholderSource = 'stock'
    reference.target.placeholderId = asset.id
    reference.target.originalUrl = asset.url

    if (asset.alt && (typeof reference.target.alt !== 'string' || reference.target.alt.trim().length === 0)) {
      reference.target.alt = asset.alt
    }

    if (asset.attribution) {
      reference.target.placeholderAttribution = asset.attribution
    }

    const key = buildReferenceKey(reference.mediaId, reference.path)
    replacedKeys.add(key)

    replacements.push({
      originalMediaId: reference.mediaId,
      placeholderId: asset.id,
      url: asset.url,
      category,
      pageId: reference.pageId,
      pageTitle: reference.pageTitle,
      pagePath: reference.pagePath,
      componentId: reference.componentId,
      componentType: reference.componentType,
      sharedComponentId: reference.sharedComponentId,
      path: reference.path,
      attribution: asset.attribution
    })
  })

  if (replacements.length === 0) {
    return replacements
  }

  if (Array.isArray(mediaDiagnostics.placeholders)) {
    mediaDiagnostics.placeholders.push(...replacements)
  } else {
    mediaDiagnostics.placeholders = [...replacements]
  }

  mediaDiagnostics.summary.placeholders += replacements.length
  mediaDiagnostics.summary.unresolved = Math.max(0, mediaDiagnostics.summary.unresolved - replacements.length)

  mediaDiagnostics.unresolved = mediaDiagnostics.unresolved.filter(entry => {
    const key = buildReferenceKey(entry.mediaId, entry.path)
    return !replacedKeys.has(key)
  })

  return replacements
}
