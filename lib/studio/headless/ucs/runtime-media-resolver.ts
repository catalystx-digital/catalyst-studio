/**
 * Runtime media resolver for UCS headless provider.
 *
 * This module resolves mediaId references in component data to actual URLs
 * at runtime. It directly queries the database and builds URLs based on
 * environment configuration, making it self-contained for generated projects.
 *
 * The generator has similar logic in scripts/generate-head/core/media-resolution.ts
 * but that runs at build time. This resolver runs at request time for the UCS
 * provider which fetches live data from the database.
 */

import type { PrismaClient } from '@/lib/generated/prisma'

export interface RuntimeMediaReference {
  mediaId: string
  target: Record<string, unknown>
  path: string
}

export interface RuntimeMediaResolutionResult {
  resolved: number
  unresolved: number
  errors: string[]
}

interface MediaRecord {
  id: string
  storageKey: string
  contentType: string | null
  width: number | null
  height: number | null
  metadata: unknown
  sources: Array<{
    originalUrl: string
    metadata: unknown
  }>
}

interface RenditionMetadata {
  storageKey?: string
  width?: number
  height?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Builds a public URL for a media storage key.
 * Uses S3 public base URL if configured, otherwise returns null.
 */
function buildPublicUrl(storageKey: string): string | null {
  const publicBaseUrl = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
  if (!publicBaseUrl) {
    return null
  }
  // Ensure base URL doesn't have trailing slash, key doesn't have leading slash
  const base = publicBaseUrl.replace(/\/$/, '')
  const key = storageKey.replace(/^\//, '')
  return `${base}/${key}`
}

/**
 * Collects all mediaId references from a data structure.
 * Walks the object graph and finds any objects with a mediaId property.
 */
function collectMediaReferences(
  value: unknown,
  references: RuntimeMediaReference[],
  altTextByMediaId: Map<string, string | null>,
  visited: WeakSet<object> = new WeakSet(),
  currentPath = ''
): void {
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
      const nextPath = `${currentPath}[${index}]`
      collectMediaReferences(entry, references, altTextByMediaId, visited, nextPath)
    })
    return
  }

  const record = value as Record<string, unknown>
  const mediaIdRaw = record.mediaId
  const mediaId = typeof mediaIdRaw === 'string' ? mediaIdRaw.trim() : ''

  if (mediaId) {
    // Extract alt text if available
    const altCandidate = extractAltText(record)
    if (!altTextByMediaId.has(mediaId)) {
      altTextByMediaId.set(mediaId, altCandidate ?? null)
    } else if (!altTextByMediaId.get(mediaId) && altCandidate) {
      altTextByMediaId.set(mediaId, altCandidate)
    }

    references.push({
      mediaId,
      target: record,
      path: currentPath
    })
  }

  Object.entries(record).forEach(([key, child]) => {
    const nextPath = currentPath ? `${currentPath}.${key}` : key
    collectMediaReferences(child, references, altTextByMediaId, visited, nextPath)
  })
}

/**
 * Extract alt text from a media reference object.
 */
function extractAltText(record: Record<string, unknown>): string | null {
  if (typeof record.alt === 'string' && record.alt.trim()) {
    return record.alt.trim()
  }
  if (typeof record.altText === 'string' && record.altText.trim()) {
    return record.altText.trim()
  }
  return null
}

/**
 * Attempts to find a fallback URL from the reference target.
 */
function getFallbackUrl(record: Record<string, unknown>): string | undefined {
  const candidates: Array<unknown> = [record.src, record.originalUrl, record.url, record.href]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return undefined
}

/**
 * Applies resolved media URLs to the reference targets.
 */
function applyResolvedMedia(
  references: RuntimeMediaReference[],
  mediaMap: Map<string, MediaRecord>,
  altTextByMediaId: Map<string, string | null>
): RuntimeMediaResolutionResult {
  let resolved = 0
  let unresolved = 0
  const errors: string[] = []

  for (const reference of references) {
    const media = mediaMap.get(reference.mediaId)

    if (!media) {
      // Media not found in database - try fallback
      const fallbackUrl = getFallbackUrl(reference.target)
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
      }
      unresolved += 1
      errors.push(`Media ${reference.mediaId} at ${reference.path} not found in database`)
      continue
    }

    const publicUrl = buildPublicUrl(media.storageKey)

    if (publicUrl) {
      // Set the resolved src URL
      reference.target.src = publicUrl

      // Preserve original URL if available
      const originalUrl = media.sources?.[0]?.originalUrl
      if (!reference.target.originalUrl && originalUrl) {
        reference.target.originalUrl = originalUrl
      }

      // Set alt text if available
      const altText = altTextByMediaId.get(reference.mediaId)
      if (!reference.target.alt && altText) {
        reference.target.alt = altText
      }

      // Process renditions if available
      const metadata = isRecord(media.metadata) ? media.metadata : {}
      const renditions = Array.isArray(metadata.renditions) ? metadata.renditions : []
      const normalizedRenditions: Array<{ src: string; width: number | null; height: number | null }> = []

      for (const rendition of renditions) {
        if (!isRecord(rendition)) continue
        const renditionKey = typeof rendition.storageKey === 'string' ? rendition.storageKey : null
        if (!renditionKey) continue

        const renditionUrl = buildPublicUrl(renditionKey)
        if (renditionUrl) {
          normalizedRenditions.push({
            src: renditionUrl,
            width: typeof rendition.width === 'number' ? rendition.width : null,
            height: typeof rendition.height === 'number' ? rendition.height : null
          })
        }
      }

      if (normalizedRenditions.length > 0) {
        reference.target.renditions = normalizedRenditions
      }

      resolved += 1
    } else {
      // No public URL available - try fallback
      const fallbackUrl = getFallbackUrl(reference.target) || media.sources?.[0]?.originalUrl
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
      }
      unresolved += 1
      errors.push(`Media ${reference.mediaId} at ${reference.path} has no public URL configured`)
    }
  }

  return { resolved, unresolved, errors }
}

/**
 * Resolves all media references in a data structure using Prisma.
 *
 * This function mutates the input data, replacing mediaId references with
 * resolved src URLs. It's designed to be called after loading page/component
 * data from the database but before returning to the renderer.
 *
 * @param data - The data structure containing mediaId references (mutated in place)
 * @param websiteId - The website ID for looking up media assets
 * @param prisma - Prisma client instance
 * @returns Resolution statistics
 */
export async function resolveRuntimeMedia(
  data: unknown,
  websiteId: string,
  prisma: PrismaClient
): Promise<RuntimeMediaResolutionResult> {
  const references: RuntimeMediaReference[] = []
  const altTextByMediaId = new Map<string, string | null>()

  // Collect all media references
  collectMediaReferences(data, references, altTextByMediaId)

  if (references.length === 0) {
    return { resolved: 0, unresolved: 0, errors: [] }
  }

  // Get unique media IDs
  const uniqueMediaIds = Array.from(new Set(references.map(ref => ref.mediaId)))

  // Query media records from database
  let mediaRecords: MediaRecord[]
  try {
    mediaRecords = await prisma.websiteMedia.findMany({
      where: {
        websiteId,
        id: { in: uniqueMediaIds }
      },
      select: {
        id: true,
        storageKey: true,
        contentType: true,
        width: true,
        height: true,
        metadata: true,
        sources: {
          select: {
            originalUrl: true,
            metadata: true
          },
          take: 1
        }
      }
    }) as MediaRecord[]
  } catch (error) {
    // Database query failed - try to use fallback URLs
    let fallbacksApplied = 0
    for (const reference of references) {
      const fallbackUrl = getFallbackUrl(reference.target)
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
        fallbacksApplied += 1
      }
    }
    return {
      resolved: 0,
      unresolved: references.length,
      errors: [
        `Database query failed: ${error instanceof Error ? error.message : String(error)}; ${fallbacksApplied} fallback URLs applied`
      ]
    }
  }

  // Build a map for quick lookup
  const mediaMap = new Map<string, MediaRecord>()
  for (const record of mediaRecords) {
    mediaMap.set(record.id, record)
  }

  // Apply resolved URLs to the reference targets
  return applyResolvedMedia(references, mediaMap, altTextByMediaId)
}

/**
 * Resolves media for multiple data structures in a single batch.
 * More efficient than calling resolveRuntimeMedia multiple times.
 */
export async function resolveRuntimeMediaBatch(
  items: Array<{ data: unknown; label?: string }>,
  websiteId: string,
  prisma?: PrismaClient
): Promise<{
  totalResolved: number
  totalUnresolved: number
  errors: string[]
}> {
  const allReferences: RuntimeMediaReference[] = []
  const altTextByMediaId = new Map<string, string | null>()

  // Collect references from all items
  for (const item of items) {
    collectMediaReferences(item.data, allReferences, altTextByMediaId)
  }

  if (allReferences.length === 0) {
    return { totalResolved: 0, totalUnresolved: 0, errors: [] }
  }

  // Get or create Prisma client
  let prismaClient: PrismaClient
  let shouldDisconnect = false

  if (prisma) {
    prismaClient = prisma
  } else {
    // Dynamic import to avoid bundling issues in generated projects
    try {
      const { PrismaClient: PrismaClientConstructor } = await import('@/lib/generated/prisma')
      prismaClient = new PrismaClientConstructor()
      shouldDisconnect = true
    } catch (error) {
      // Prisma not available - try to use fallback URLs
      let fallbacksApplied = 0
      for (const reference of allReferences) {
        const fallbackUrl = getFallbackUrl(reference.target)
        if (fallbackUrl && typeof reference.target.src !== 'string') {
          reference.target.src = fallbackUrl
          fallbacksApplied += 1
        }
      }
      return {
        totalResolved: 0,
        totalUnresolved: allReferences.length,
        errors: [
          `Prisma client unavailable: ${error instanceof Error ? error.message : String(error)}; ${fallbacksApplied} fallback URLs applied`
        ]
      }
    }
  }

  try {
    // Get unique media IDs
    const uniqueMediaIds = Array.from(new Set(allReferences.map(ref => ref.mediaId)))

    // Query media records from database
    const mediaRecords = await prismaClient.websiteMedia.findMany({
      where: {
        websiteId,
        id: { in: uniqueMediaIds }
      },
      select: {
        id: true,
        storageKey: true,
        contentType: true,
        width: true,
        height: true,
        metadata: true,
        sources: {
          select: {
            originalUrl: true,
            metadata: true
          },
          take: 1
        }
      }
    }) as MediaRecord[]

    // Build a map for quick lookup
    const mediaMap = new Map<string, MediaRecord>()
    for (const record of mediaRecords) {
      mediaMap.set(record.id, record)
    }

    // Apply resolved URLs
    const result = applyResolvedMedia(allReferences, mediaMap, altTextByMediaId)
    return {
      totalResolved: result.resolved,
      totalUnresolved: result.unresolved,
      errors: result.errors
    }
  } catch (error) {
    let fallbacksApplied = 0
    for (const reference of allReferences) {
      const fallbackUrl = getFallbackUrl(reference.target)
      if (fallbackUrl && typeof reference.target.src !== 'string') {
        reference.target.src = fallbackUrl
        fallbacksApplied += 1
      }
    }
    return {
      totalResolved: 0,
      totalUnresolved: allReferences.length,
      errors: [
        `Failed to load media assets: ${error instanceof Error ? error.message : String(error)}; ${fallbacksApplied} fallback URLs applied`
      ]
    }
  } finally {
    if (shouldDisconnect) {
      await prismaClient.$disconnect().catch(() => {})
    }
  }
}
