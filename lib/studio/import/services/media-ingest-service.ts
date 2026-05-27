import crypto from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import sharp from 'sharp'

import type { ImportDetectionResult } from '../web-detection'
import { monitoring } from '@/lib/monitoring'
import type { WebsiteMedia } from '@/lib/generated/prisma'
import { MediaRepository } from '@/lib/studio/media/media-repository'
import type { MediaRenditionMetadata } from '@/lib/studio/media/rendition-resolver'
import type { MediaStorageProvider } from '@/lib/studio/media/storage/media-storage-provider'
import type { MediaStorageBackend } from '@/lib/studio/media/storage/media-storage-factory'
import type { ProgressCallback } from '../types/progress.types'

export interface MediaIngestParams {
  websiteId: string
  detectionResults: ImportDetectionResult[]
  designTokens: Record<string, unknown> | null
  /** Progress callback for reporting media ingest progress */
  onProgress?: ProgressCallback
}

export interface MediaIngestWarning {
  url: string
  reason: string
  normalizedUrl?: string
  pageUrl?: string
  componentType?: string
  fieldPath?: string
}

export interface MediaIngestResult {
  detections: ImportDetectionResult[]
  designTokens: Record<string, unknown> | null
  mediaAssets: IngestedAssetSummary[]
  warnings: MediaIngestWarning[]
}

interface MediaCandidate {
  url: string
  rawUrl: string
  pageUrl?: string
  componentType?: string
  fieldPath: string
}

const MEDIA_SEGMENT_HINTS = new Set<string>(
  [
    'image',
    'images',
    'icon',
    'icons',
    'logo',
    'logos',
    'thumbnail',
    'thumbnails',
    'photo',
    'photos',
    'picture',
    'pictures',
    'artwork',
    'artworks',
    'avatar',
    'avatars',
    'background',
    'backgrounds',
    'poster',
    'posters',
    'cover',
    'covers',
    'hero',
    'media',
    'illustration',
    'illustrations',
    'graphic',
    'graphics',
    'banner',
    'banners',
    'snapshot',
    'featuredimage',
    'heroimage',
    'backgroundimage',
    'coverimage',
    'heroimage',
    'screenshot',
    'screenshots'
  ].map(value => value.toLowerCase())
)

const MEDIA_SEGMENT_HINTS_ARRAY = Array.from(MEDIA_SEGMENT_HINTS)

const MEDIA_LAST_KEYS = new Set<string>(
  [
    'src',
    'source',
    'icon',
    'logo',
    'image',
    'thumbnail',
    'poster',
    'avatar',
    'cover',
    'photo',
    'picture',
    'artwork',
    'background',
    'media',
    'featuredimage',
    'heroimage',
    'backgroundimage',
    'coverimage',
    'illustration',
    'graphic',
    'banner',
    'screenshot'
  ].map(value => value.toLowerCase())
)

/**
 * Field names that typically contain HTML content with embedded images.
 * These fields will be scanned for <img> tags to extract image URLs.
 */
const HTML_CONTENT_FIELDS = new Set<string>([
  'bodyhtml',
  'html',
  'richtext',
  'content',
  'body',
  'description',
  'text',
  'copy',
  'markup',
  'htmlcontent',
  'richcontent',
  'mainContent',
  'maincontent',
  'pagecontent',
  'articlecontent',
  'postcontent'
])

/**
 * Extracts image URLs from HTML content by parsing <img> tags.
 * Returns array of objects with src and optional alt text.
 */
function extractImagesFromHtml(html: string): Array<{ src: string; alt?: string }> {
  if (!html || typeof html !== 'string') return []

  // Quick check - if no img tag, skip regex processing
  if (!html.includes('<img')) return []

  const images: Array<{ src: string; alt?: string }> = []

  // Match <img tags - handles self-closing and various attribute orders
  const imgTagRegex = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  const altInTagRegex = /alt\s*=\s*["']([^"']*)["']/i

  let match
  while ((match = imgTagRegex.exec(html)) !== null) {
    const src = match[1]
    if (src && !src.startsWith('data:')) {
      const altMatch = altInTagRegex.exec(match[0])
      images.push({
        src: src.trim(),
        ...(altMatch?.[1] ? { alt: altMatch[1] } : {})
      })
    }
  }

  // Also handle img tags where src comes after other attributes
  const imgTagAltFirstRegex = /<img\s+[^>]*?(?:alt\s*=\s*["'][^"']*["']\s+)?[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  imgTagAltFirstRegex.lastIndex = 0
  while ((match = imgTagAltFirstRegex.exec(html)) !== null) {
    const src = match[1]
    if (src && !src.startsWith('data:') && !images.some(img => img.src === src)) {
      const altMatch = altInTagRegex.exec(match[0])
      images.push({
        src: src.trim(),
        ...(altMatch?.[1] ? { alt: altMatch[1] } : {})
      })
    }
  }

  return images
}

/**
 * Checks if a field path indicates HTML content that should be scanned for images.
 */
function isHtmlContentField(fieldPath: string): boolean {
  if (!fieldPath) return false
  const segments = fieldPath.split('.')
  const lastSegment = segments[segments.length - 1]?.replace(/\[\d+\]/g, '').toLowerCase() || ''
  return HTML_CONTENT_FIELDS.has(lastSegment)
}

interface DownloadResult {
  filePath: string
  checksum: string
  contentType?: string
  contentLength?: number
  filename?: string
}

interface IngestedAssetSummary {
  mediaId: string
  originalUrl: string
  storageKey: string
  contentType?: string
  checksum: string
  width?: number | null
  height?: number | null
  duration?: number | null
}

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
const RENDITION_BREAKPOINTS = [480, 768, 1280]
const RENDITION_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF_87A = Buffer.from('GIF87a')
const GIF_89A = Buffer.from('GIF89a')
const JPEG_PREFIX = [0xff, 0xd8, 0xff]
const RIFF_HEADER = Buffer.from('RIFF')
const WEBP_FOURCC = Buffer.from('WEBP')

export class MediaIngestService {
  private readonly repository: MediaRepository
  private readonly storageProvider: MediaStorageProvider
  private readonly providerEnum: MediaStorageBackend
  private readonly maxFileSizeBytes: number

  constructor(params: {
    repository: MediaRepository
    storageProvider: MediaStorageProvider
    backend: MediaStorageBackend
    maxFileSizeBytes?: number
  }) {
    this.repository = params.repository
    this.storageProvider = params.storageProvider
    this.providerEnum = params.backend
    this.maxFileSizeBytes = params.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES
  }

  async ingest(params: MediaIngestParams): Promise<MediaIngestResult> {
    const { onProgress } = params
    const detectionsClone = params.detectionResults.map(detection => ({ ...detection }))
    const designTokensClone = params.designTokens ? { ...params.designTokens } : null
    const warnings: MediaIngestWarning[] = []
    const candidates = this.collectCandidates(detectionsClone, warnings)
    const processed = new Map<string, IngestedAssetSummary>()

    // Report media ingest start
    onProgress?.({
      subsystemStart: {
        id: 'media_download',
        label: 'Downloading media',
        total: candidates.length,
      },
      message: `Found ${candidates.length} media assets to process`,
    })

    if (candidates.length > 0) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalyst-media-'))
      let processedCount = 0
      try {
        for (const candidate of candidates) {
          if (processed.has(candidate.url)) {
            processedCount++
            continue
          }

          // Report progress for each media item
          onProgress?.({
            subsystemProgress: { id: 'media_download', current: processedCount, total: candidates.length },
            message: `Processing media ${processedCount + 1}/${candidates.length}`,
          })

          try {
            const existing = await this.repository.resolveByOriginalUrl(params.websiteId, candidate.url)
            if (existing) {
              const summary: IngestedAssetSummary = {
                mediaId: existing.media.id,
                originalUrl: candidate.url,
                storageKey: existing.media.storageKey,
                contentType: existing.media.contentType || undefined,
                checksum: existing.media.checksum,
                width: existing.media.width,
                height: existing.media.height,
                duration: existing.media.duration ?? null
              }
              this.rememberCandidate(processed, candidate, summary)
              continue
            }

            const download = await this.downloadToTemp(candidate.url, tempDir)
            const validation = await this.validateDownloadedFile({
              filePath: download.filePath,
              headerContentType: download.contentType,
              reportedSize: download.contentLength
            })

            if (!validation.ok) {
              warnings.push({
                url: candidate.rawUrl || candidate.url,
                normalizedUrl: candidate.url,
                reason: validation.reason,
                pageUrl: candidate.pageUrl,
                componentType: candidate.componentType,
                fieldPath: candidate.fieldPath
              })
              await fs.unlink(download.filePath).catch(() => {})
              // Still store URL resolution so relative URLs become absolute
              this.rememberUrlResolution(processed, candidate)
              continue
            }

            const duplicate = await this.repository.findByChecksum(params.websiteId, download.checksum)

            let mediaId: string
            let storageKey: string
            let contentType = validation.contentType
            let width: number | null = null
            let height: number | null = null

            if (duplicate) {
              await fs.unlink(download.filePath).catch(() => {})
              mediaId = duplicate.id
              storageKey = duplicate.storageKey
              contentType = duplicate.contentType || contentType
              width = duplicate.width ?? null
              height = duplicate.height ?? null
            } else {
              const fileBuffer = await fs.readFile(download.filePath)
              await fs.unlink(download.filePath).catch(() => {})
              const storageKeyCandidate = this.buildStorageKey(params.websiteId, download.checksum, contentType)
              const imageDimensions = await this.extractImageDimensions(fileBuffer, contentType)
              const renditions = await this.generateRenditions({
                websiteId: params.websiteId,
                checksum: download.checksum,
                baseStorageKey: storageKeyCandidate,
                contentType,
                buffer: fileBuffer,
                dimensions: imageDimensions ?? undefined
              })
              const media = await this.persistMedia({
                websiteId: params.websiteId,
                checksum: download.checksum,
                storageKey: storageKeyCandidate,
                fileBuffer,
                contentType,
                originalUrl: candidate.url,
                size: validation.size,
                filename: download.filename,
                width: imageDimensions?.width ?? null,
                height: imageDimensions?.height ?? null,
                renditions
              })
              mediaId = media.id
              storageKey = media.storageKey
              contentType = media.contentType || contentType
              width = media.width ?? imageDimensions?.width ?? null
              height = media.height ?? imageDimensions?.height ?? null
            }

            await this.repository.upsertSourceLink({
              websiteId: params.websiteId,
              mediaId,
              originalUrl: candidate.url,
              metadata: {
                pageUrl: candidate.pageUrl,
                componentType: candidate.componentType,
                fieldPath: candidate.fieldPath,
                rawUrl: candidate.rawUrl !== candidate.url ? candidate.rawUrl : undefined
              }
            })

            const summary: IngestedAssetSummary = {
              mediaId,
              originalUrl: candidate.url,
              storageKey,
              contentType,
              checksum: download.checksum,
              width,
              height,
              duration: null
            }
            this.rememberCandidate(processed, candidate, summary)
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'unknown_error'
            warnings.push({
              url: candidate.rawUrl || candidate.url,
              normalizedUrl: candidate.url,
              reason,
              pageUrl: candidate.pageUrl,
              componentType: candidate.componentType,
              fieldPath: candidate.fieldPath
            })
            // Still store URL resolution so relative URLs become absolute
            this.rememberUrlResolution(processed, candidate)
          }

          processedCount++
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    // Report media ingest complete
    const successCount = Array.from(processed.values()).filter(s => s.mediaId).length
    onProgress?.({
      subsystemComplete: 'media_download',
      message: `Processed ${successCount} media assets (${warnings.length} warnings)`,
    })

    const rewrittenDetections = detectionsClone.map(detection => this.rewriteDetection(detection, processed))
    const decoratedTokens = this.decorateDesignTokens(designTokensClone, processed)

    return {
      detections: rewrittenDetections,
      designTokens: decoratedTokens,
      mediaAssets: this.collectMediaAssets(processed),
      warnings
    }
  }

  private collectCandidates(
    detections: ImportDetectionResult[],
    warnings: MediaIngestWarning[]
  ): MediaCandidate[] {
    const results: MediaCandidate[] = []
    for (const detection of detections) {
      const pageOrigin = this.safeOriginFromUrl(detection.pageUrl)
      const recordWarning = (params: {
        url: string
        normalizedUrl?: string
        reason: string
        fieldPath: string
        componentType?: string
      }) => {
        warnings.push({
          url: params.url,
          normalizedUrl: params.normalizedUrl,
          reason: params.reason,
          pageUrl: detection.pageUrl,
          componentType: params.componentType,
          fieldPath: params.fieldPath
        })
      }

      const pushCandidate = (url: string, fieldPath: string, componentType?: string) => {
        const normalized = this.normalizeCandidateUrl(url, detection.pageUrl, pageOrigin)
        if (!normalized) {
          recordWarning({
            url,
            reason: 'normalize_failed',
            fieldPath,
            componentType
          })
          return
        }
        if (!this.isMediaField(fieldPath)) {
          return
        }
        if (!this.isProcessableUrl(normalized)) {
          recordWarning({
            url,
            normalizedUrl: normalized,
            reason: 'normalize_failed',
            fieldPath,
            componentType
          })
          return
        }

        results.push({
          url: normalized,
          rawUrl: url,
          pageUrl: detection.pageUrl,
          componentType,
          fieldPath
        })
      }

      if (Array.isArray(detection.components)) {
        detection.components.forEach((component, index) => {
          const basePath = `${component.type || component.component || 'component'}[${index}]`
          this.scanValue(component.content, basePath, (url, fieldPath) => {
            pushCandidate(url, fieldPath, component.type)
          })
          if (component.metadata) {
            this.scanValue(component.metadata, `${basePath}.metadata`, (url, fieldPath) => {
              pushCandidate(url, fieldPath, component.type)
            })
          }
        })
      }
      if (detection.pageMetadata) {
        this.scanValue(detection.pageMetadata, 'pageMetadata', (url, fieldPath) => {
          pushCandidate(url, fieldPath, 'pageMetadata')
        })
      }
    }
    return results
  }

  private scanValue(
    value: unknown,
    basePath: string,
    onUrl: (url: string, fieldPath: string) => void,
    visited: Set<unknown> = new Set()
  ): void {
    if (value === null || value === undefined) {
      return
    }
    if (typeof value === 'string') {
      // Always emit the raw string value for standard field-based detection
      onUrl(value, basePath)

      // Additionally, if this is an HTML content field, extract embedded images
      if (isHtmlContentField(basePath) && value.includes('<img')) {
        const embeddedImages = extractImagesFromHtml(value)
        embeddedImages.forEach((img, index) => {
          // Use a synthetic field path that indicates this came from HTML content
          onUrl(img.src, `${basePath}[htmlImg${index}].src`)
        })
      }
      return
    }
    if (typeof value !== 'object') {
      return
    }
    if (visited.has(value)) {
      return
    }
    visited.add(value)

    if (Array.isArray(value)) {
      value.forEach((item, index) => this.scanValue(item, `${basePath}[${index}]`, onUrl, visited))
      return
    }

    const record = value as Record<string, unknown>
    if (typeof record.mediaId === 'string' && typeof record.originalUrl === 'string') {
      return
    }

    for (const [key, child] of Object.entries(record)) {
      this.scanValue(child, `${basePath}.${key}`, onUrl, visited)
    }
  }

  private isProcessableUrl(url: string): boolean {
    if (typeof url !== 'string') {
      return false
    }
    const trimmed = url.trim()
    if (!trimmed) {
      return false
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      return false
    }
    if (/^data:/i.test(trimmed)) {
      return false
    }
    return true
  }

  private async downloadToTemp(url: string, tempDir: string): Promise<DownloadResult> {
    const start = performance.now()
    const response = await fetch(url)
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch media (${response.status})`)
    }

    const contentType = response.headers.get('content-type') || undefined
    const lengthHeader = response.headers.get('content-length')
    const contentLength = lengthHeader ? Number(lengthHeader) : undefined
    const filename = this.extractFilename(url, response.headers.get('content-disposition'))
    const extension = this.inferExtension(url, contentType)
    const filePath = path.join(tempDir, `${crypto.randomUUID()}${extension}`)

    const hash = crypto.createHash('sha256')
    const hashStream = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk as Buffer)
        callback(null, chunk)
      }
    })

    const responseStream = response.body as unknown as NodeReadableStream
    const nodeStream = Readable.fromWeb(responseStream)
    await pipeline(nodeStream, hashStream, createWriteStream(filePath))
    const checksum = hash.digest('hex')

    monitoring.logPerformance('media.ingest.download', performance.now() - start, {
      url,
      bytes: contentLength
    })

    return { filePath, checksum, contentType, contentLength, filename }
  }

  private normalizeMimeType(value?: string | null): string | undefined {
    if (!value) {
      return undefined
    }
    const [base] = value.split(';', 1)
    const normalized = base.trim().toLowerCase()
    if (!normalized) {
      return undefined
    }
    if (normalized === 'image/jpg') {
      return 'image/jpeg'
    }
    return normalized
  }

  private async validateDownloadedFile(input: {
    filePath: string
    headerContentType?: string
    reportedSize?: number
  }): Promise<{ ok: true; contentType: string; size: number } | { ok: false; reason: string }> {
    const stats = await fs.stat(input.filePath)
    const size = stats.size
    if (size === 0) {
      return { ok: false, reason: 'empty_file' }
    }
    if (size > this.maxFileSizeBytes) {
      return { ok: false, reason: 'oversize' }
    }

    const headerType = this.normalizeMimeType(input.headerContentType)
    if (headerType && !ALLOWED_MIME_TYPES.has(headerType)) {
      return { ok: false, reason: 'disallowed_mime' }
    }

    const detectedType = await this.detectMimeFromFile(input.filePath)
    if (detectedType && !ALLOWED_MIME_TYPES.has(detectedType)) {
      return { ok: false, reason: 'disallowed_mime' }
    }

    if (headerType && detectedType && headerType !== detectedType) {
      return { ok: false, reason: 'mime_mismatch' }
    }

    if (!detectedType) {
      if (headerType && ALLOWED_MIME_TYPES.has(headerType)) {
        return { ok: false, reason: 'mime_mismatch' }
      }
      return { ok: false, reason: 'unknown_mime' }
    }

    return { ok: true, contentType: detectedType, size }
  }

  private async detectMimeFromFile(filePath: string): Promise<string | null> {
    try {
      const handle = await fs.open(filePath, 'r')
      const buffer = Buffer.alloc(4100)
      await handle.read(buffer, 0, buffer.length, 0)
      await handle.close()

      if (buffer.slice(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        return 'image/png'
      }
      if (
        buffer[0] === JPEG_PREFIX[0] &&
        buffer[1] === JPEG_PREFIX[1] &&
        buffer[2] === JPEG_PREFIX[2]
      ) {
        return 'image/jpeg'
      }
      if (
        buffer.slice(0, GIF_87A.length).equals(GIF_87A) ||
        buffer.slice(0, GIF_89A.length).equals(GIF_89A)
      ) {
        return 'image/gif'
      }
      if (
        buffer.slice(0, RIFF_HEADER.length).equals(RIFF_HEADER) &&
        buffer.slice(8, 12).equals(WEBP_FOURCC)
      ) {
        return 'image/webp'
      }
      const snippet = buffer.toString('utf8', 0, 400).trim().toLowerCase()
      if (snippet.includes('<svg')) {
        return 'image/svg+xml'
      }
    } catch (error) {
      monitoring.logError('media.ingest.detect_mime_failed', error as Error, { filePath })
    }
    return null
  }

  private async persistMedia(params: {
    websiteId: string
    checksum: string
    storageKey: string
    fileBuffer: Buffer
    contentType: string
    originalUrl: string
    size: number
    filename?: string
    width: number | null
    height: number | null
    renditions?: MediaRenditionMetadata[]
  }): Promise<WebsiteMedia> {
    await this.storageProvider.put({
      key: params.storageKey,
      body: params.fileBuffer,
      contentType: params.contentType,
      metadata: {
        originalUrl: params.originalUrl,
        filename: params.filename || '',
        checksum: params.checksum
      }
    })

    const media = await this.repository.createMediaAsset({
      websiteId: params.websiteId,
      provider: this.providerEnum,
      storageKey: params.storageKey,
      checksum: params.checksum,
      contentType: params.contentType,
      width: params.width ?? null,
      height: params.height ?? null,
      metadata: {
        originalUrl: params.originalUrl,
        filename: params.filename,
        bytes: params.size,
        renditions: params.renditions && params.renditions.length > 0 ? params.renditions : undefined
      }
    })

    return media
  }

  private supportsRenditions(contentType: string): boolean {
    return RENDITION_CONTENT_TYPES.has(contentType)
  }

  private buildStorageKey(websiteId: string, checksum: string, contentType: string): string {
    return `${websiteId}/${checksum}${this.extensionFromContentType(contentType)}`
  }

  private buildRenditionStorageKey(baseStorageKey: string, width: number): string {
    const parsed = path.posix.parse(baseStorageKey)
    const directory = parsed.dir || path.posix.dirname(baseStorageKey)
    const name = parsed.name || path.posix.basename(baseStorageKey, parsed.ext)
    const extension = parsed.ext || ''
    return path.posix.join(directory, `${name}-${width}w${extension}`)
  }

  private async extractImageDimensions(buffer: Buffer, contentType: string): Promise<{ width: number; height: number } | null> {
    if (!this.supportsRenditions(contentType)) {
      return null
    }
    try {
      const metadata = await sharp(buffer).metadata()
      if (typeof metadata.width === 'number' && typeof metadata.height === 'number') {
        return { width: metadata.width, height: metadata.height }
      }
    } catch (error) {
      monitoring.logError('media.ingest.metadata_failed', error as Error, {
        contentType
      })
    }
    return null
  }

  private async generateRenditions(params: {
    websiteId: string
    checksum: string
    baseStorageKey: string
    contentType: string
    buffer: Buffer
    dimensions?: { width: number; height: number }
  }): Promise<MediaRenditionMetadata[]> {
    if (!this.supportsRenditions(params.contentType)) {
      return []
    }
    const baseWidth = params.dimensions?.width
    if (typeof baseWidth === 'number' && baseWidth <= RENDITION_BREAKPOINTS[0]) {
      return []
    }

    const renditions: MediaRenditionMetadata[] = []
    for (const targetWidth of RENDITION_BREAKPOINTS) {
      if (typeof baseWidth === 'number' && baseWidth <= targetWidth) {
        continue
      }

      try {
        const { data, info } = await sharp(params.buffer)
          .resize({ width: targetWidth, withoutEnlargement: true })
          .toBuffer({ resolveWithObject: true })
        const renditionKey = this.buildRenditionStorageKey(params.baseStorageKey, info.width ?? targetWidth)
        await this.storageProvider.put({
          key: renditionKey,
          body: data,
          contentType: params.contentType,
          metadata: {
            checksum: params.checksum,
            width: String(info.width ?? targetWidth),
            base: params.baseStorageKey
          }
        })
        renditions.push({
          storageKey: renditionKey,
          width: info.width ?? targetWidth,
          height: info.height ?? null
        })
      } catch (error) {
        monitoring.logError('media.ingest.rendition_failed', error as Error, {
          contentType: params.contentType,
          targetWidth
        })
      }
    }

    return renditions
  }

  private rewriteDetection(
    detection: ImportDetectionResult,
    replacements: Map<string, IngestedAssetSummary>
  ): ImportDetectionResult {
    if (Array.isArray(detection.components)) {
      detection.components = detection.components.map(component => {
        const updated = { ...component }
        updated.content = this.rewriteValue(component.content, replacements) as Record<string, unknown>
        if (component.metadata) {
          updated.metadata = this.rewriteValue(component.metadata, replacements) as Record<string, unknown>
        }
        return updated
      })
    }
    if (detection.pageMetadata) {
      detection.pageMetadata = this.rewriteValue(detection.pageMetadata, replacements) as Record<string, unknown>
    }
    return detection
  }

  private rewriteValue(
    value: unknown,
    replacements: Map<string, IngestedAssetSummary>,
    seen: WeakSet<object> = new WeakSet()
  ): unknown {
    if (value === null || value === undefined) {
      return value
    }
    if (typeof value === 'string') {
      const match = this.lookupReplacement(replacements, value)
      if (match) {
        // Full media reference with mediaId
        if (match.mediaId) {
          return { src: match.originalUrl, mediaId: match.mediaId, originalUrl: match.originalUrl }
        }
        // URL-only resolution (download failed but we resolved relative → absolute)
        return match.originalUrl
      }
      return value
    }
    if (typeof value !== 'object') {
      return value
    }
    if (seen.has(value as object)) {
      return value
    }
    seen.add(value as object)

    if (Array.isArray(value)) {
      return value.map(item => this.rewriteValue(item, replacements, seen))
    }

    const record = value as Record<string, unknown>
    const mediaRef = this.rewriteMediaReferenceRecord(record, replacements)
    if (mediaRef) {
      return mediaRef
    }

    if (typeof record.mediaId === 'string' && typeof record.originalUrl === 'string') {
      // Ensure src is always populated for rendering
      if (typeof record.src !== 'string' || !record.src.trim()) {
        return { ...record, src: record.originalUrl }
      }
      return record
    }

    const updated: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      updated[key] = this.rewriteValue(child, replacements, seen)
    }
    return updated
  }

  private rewriteMediaReferenceRecord(
    record: Record<string, unknown>,
    replacements: Map<string, IngestedAssetSummary>
  ): Record<string, unknown> | null {
    const mediaType = typeof record.mediaType === 'string' ? record.mediaType : undefined
    const isCanonicalMediaReference =
      mediaType === 'image' ||
      mediaType === 'video' ||
      mediaType === 'file' ||
      (typeof record.mediaId === 'string' && typeof record.url === 'string')

    if (!isCanonicalMediaReference) {
      return null
    }

    const url = typeof record.url === 'string' ? record.url.trim() : ''
    const originalUrl = typeof record.originalUrl === 'string' ? record.originalUrl.trim() : ''
    const sourceUrl = url || originalUrl
    const match = sourceUrl ? this.lookupReplacement(replacements, sourceUrl) : undefined

    if (!match) {
      return {
        ...record,
        ...(mediaType ? { mediaType } : {}),
        ...(sourceUrl ? { url: sourceUrl } : {}),
        ...(originalUrl ? { originalUrl } : {})
      }
    }

    if (!match.mediaId) {
      return {
        ...record,
        url: match.originalUrl,
        originalUrl: match.originalUrl
      }
    }

    return {
      ...record,
      mediaId: match.mediaId,
      mediaType: mediaType ?? 'image',
      url: match.originalUrl,
      originalUrl: match.originalUrl
    }
  }

  private decorateDesignTokens(
    tokens: Record<string, unknown> | null,
    replacements: Map<string, IngestedAssetSummary>
  ): Record<string, unknown> | null {
    if (!tokens) {
      return replacements.size === 0 ? null : { mediaAssets: this.collectMediaAssets(replacements) }
    }

    const decorated = { ...tokens }
    if (Array.isArray(decorated.images)) {
      decorated.imageRefs = decorated.images.map((value: unknown) => {
        if (typeof value === 'string') {
          const match = this.lookupReplacement(replacements, value)
          return match ? { mediaId: match.mediaId, originalUrl: match.originalUrl } : { originalUrl: value }
        }
        return value
      })
    }
    decorated.mediaAssets = this.collectMediaAssets(replacements)
    return decorated
  }

  private rememberCandidate(
    processed: Map<string, IngestedAssetSummary>,
    candidate: MediaCandidate,
    summary: IngestedAssetSummary
  ): void {
    const normalizedKey = candidate.url
    if (normalizedKey) {
      processed.set(normalizedKey, summary)
    }

    const rawKey = typeof candidate.rawUrl === 'string' ? candidate.rawUrl.trim() : ''
    if (rawKey && rawKey !== normalizedKey) {
      processed.set(rawKey, summary)
    }
  }

  /**
   * Store URL-only mapping when download/validation fails.
   * This ensures relative URLs get resolved to absolute even without successful download.
   */
  private rememberUrlResolution(
    processed: Map<string, IngestedAssetSummary>,
    candidate: MediaCandidate
  ): void {
    const rawKey = typeof candidate.rawUrl === 'string' ? candidate.rawUrl.trim() : ''
    // Only store if raw URL differs from normalized (i.e., was a relative URL)
    if (rawKey && rawKey !== candidate.url) {
      // Create a partial summary with just the resolved URL (no mediaId)
      const urlOnlySummary: IngestedAssetSummary = {
        mediaId: '', // Empty - indicates URL-only resolution
        originalUrl: candidate.url,
        storageKey: '',
        checksum: '',
        width: null,
        height: null,
        duration: null
      }
      processed.set(rawKey, urlOnlySummary)
    }
  }

  private lookupReplacement(
    replacements: Map<string, IngestedAssetSummary>,
    value: string
  ): IngestedAssetSummary | undefined {
    const direct = replacements.get(value)
    if (direct) {
      return direct
    }

    const trimmed = value.trim()
    if (trimmed && trimmed !== value) {
      return replacements.get(trimmed)
    }

    return undefined
  }

  private collectMediaAssets(replacements: Map<string, IngestedAssetSummary>): IngestedAssetSummary[] {
    return Array.from(new Set(replacements.values()))
  }

  private inferExtension(url: string, contentType?: string): string {
    try {
      const fromUrl = path.extname(new URL(url).pathname)
      if (fromUrl) {
        return fromUrl
      }
    } catch {}
    return this.extensionFromContentType(contentType)
  }

  private extensionFromContentType(contentType?: string): string {
    if (!contentType) {
      return ''
    }
    const [type] = contentType.split(';', 1)
    switch (type) {
      case 'image/png':
        return '.png'
      case 'image/jpeg':
        return '.jpg'
      case 'image/gif':
        return '.gif'
      case 'image/webp':
        return '.webp'
      case 'image/svg+xml':
        return '.svg'
      case 'video/mp4':
        return '.mp4'
      case 'video/webm':
        return '.webm'
      default:
        return ''
    }
  }

  private extractFilename(url: string, contentDisposition: string | null): string | undefined {
    if (contentDisposition) {
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(contentDisposition)
      if (match) {
        return decodeURIComponent(match[1] || match[2])
      }
    }
    try {
      const parsed = new URL(url)
      const base = path.basename(parsed.pathname)
      return base ? decodeURIComponent(base) : undefined
    } catch {}
    return undefined
  }

  private normalizeCandidateUrl(
    value: string,
    pageUrl: string | undefined,
    pageOrigin: string | null
  ): string | null {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    if (/^data:/i.test(trimmed)) {
      return null
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`
    }
    if (trimmed.startsWith('/') && pageOrigin) {
      try {
        return new URL(trimmed, pageOrigin).toString()
      } catch {
        return null
      }
    }
    if (pageUrl) {
      try {
        return new URL(trimmed, pageUrl).toString()
      } catch {
        return null
      }
    }
    return null
  }

  private safeOriginFromUrl(url: string | undefined): string | null {
    if (!url) {
      return null
    }
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return null
    }
  }

  private isMediaField(fieldPath: string): boolean {
    if (!fieldPath) {
      return false
    }

    const segments = fieldPath
      .split('.')
      .map(segment => segment.replace(/\[\d+\]/g, '').trim().toLowerCase())
      .filter(Boolean)

    if (segments.length === 0) {
      return false
    }

    const last = segments[segments.length - 1]
    const normalizedLast = last.replace(/[^a-z]/g, '')
    const containsHint = segments.some(segment => MEDIA_SEGMENT_HINTS.has(segment))

    if (last === 'href') {
      return false
    }

    const matchesHintBySuffix =
      normalizedLast.length > 0 &&
      MEDIA_SEGMENT_HINTS_ARRAY.some(hint => normalizedLast === hint || normalizedLast.endsWith(hint))

    if (
      MEDIA_LAST_KEYS.has(last) ||
      MEDIA_SEGMENT_HINTS.has(last) ||
      matchesHintBySuffix ||
      (normalizedLast && (MEDIA_LAST_KEYS.has(normalizedLast) || MEDIA_SEGMENT_HINTS.has(normalizedLast)))
    ) {
      return true
    }

    if (last === 'url' || last === 'path') {
      return containsHint
    }

    if (last === 'srcset') {
      return containsHint
    }

    if (/(url|src|path)$/.test(last)) {
      const base = normalizedLast.replace(/(url|src|path)$/, '')
      if (base && (MEDIA_SEGMENT_HINTS.has(base) || MEDIA_LAST_KEYS.has(base))) {
        return true
      }
    }

    if (last === 'src') {
      if (segments.length === 1) {
        return false
      }
      return segments.slice(0, -1).some(segment => MEDIA_SEGMENT_HINTS.has(segment))
    }

    return false
  }
}
