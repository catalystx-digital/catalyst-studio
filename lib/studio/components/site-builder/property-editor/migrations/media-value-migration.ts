/**
 * Media Value Migration
 *
 * Converts existing image/file string fields to the new media value format:
 * - Media Library images: { mediaId: string, url: string, alt?: string, width?: number, height?: number }
 * - External images: { url: string, alt?: string }
 * - Files: { mediaId: string, url: string, filename: string, size?: number }
 * - Videos: { mediaId?: string, url: string, poster?: string }
 */

import type {
  MediaImageValue,
  ExternalImageValue,
  MediaFileValue,
  MediaVideoValue,
} from '../schema/types'

export interface MediaLookupResult {
  mediaId: string
  url: string
  alt?: string
  width?: number
  height?: number
  filename?: string
  size?: number
  mimeType?: string
}

export interface MediaMigrationOptions {
  /** Function to resolve URL to mediaId */
  resolveMediaId?: (url: string) => Promise<MediaLookupResult | null>
  /** Base URL pattern for media library (to detect internal media) */
  mediaLibraryPattern?: RegExp | string
  /** Whether to preserve original value if resolution fails */
  preserveOriginal?: boolean
  /** Log warnings for failed resolutions */
  verbose?: boolean
}

export interface MediaMigrationResult {
  migrated: number
  preserved: number
  external: number
  failed: number
  warnings: string[]
}

// Default patterns for common media library URLs
const DEFAULT_MEDIA_PATTERNS = [
  /^\/uploads\//i,
  /^\/media\//i,
  /^\/assets\//i,
  /cdn\.example\.com/i,
  /cloudinary\.com/i,
  /imgix\.net/i,
  /amazonaws\.com.*\/uploads/i,
]

/**
 * Detect if a URL is from media library or external
 */
export function isMediaLibraryUrl(
  url: string,
  pattern?: RegExp | string
): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Check custom pattern first
  if (pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    return regex.test(url)
  }

  // Check default patterns
  return DEFAULT_MEDIA_PATTERNS.some((p) => p.test(url))
}

/**
 * Detect media type from URL
 */
export function detectMediaType(
  url: string
): 'image' | 'video' | 'file' | 'unknown' {
  if (!url || typeof url !== 'string') {
    return 'unknown'
  }

  const lower = url.toLowerCase()

  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|avif|ico|bmp|tiff?)(\?|$)/i.test(lower)) {
    return 'image'
  }

  // Video extensions
  if (/\.(mp4|webm|mov|avi|mkv|m4v|ogv)(\?|$)/i.test(lower)) {
    return 'video'
  }

  // File extensions
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z)(\?|$)/i.test(lower)) {
    return 'file'
  }

  // Check for common image CDN patterns
  if (/unsplash\.com|pexels\.com|imgix|cloudinary|images?\./i.test(lower)) {
    return 'image'
  }

  // Check for video CDN patterns
  if (/youtube\.com|vimeo\.com|wistia\.com|video\./i.test(lower)) {
    return 'video'
  }

  return 'unknown'
}

/**
 * Extract filename from URL
 */
export function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url, 'http://localhost')
    const pathname = urlObj.pathname
    const parts = pathname.split('/')
    const filename = parts[parts.length - 1]
    // Remove query string
    return filename.split('?')[0] || 'file'
  } catch {
    // Try simple extraction
    const parts = url.split('/')
    const filename = parts[parts.length - 1]
    return filename.split('?')[0] || 'file'
  }
}

/**
 * Migrate a single string image value to MediaImageValue or ExternalImageValue
 */
export async function migrateImageValue(
  value: unknown,
  options?: MediaMigrationOptions
): Promise<MediaImageValue | ExternalImageValue | string | null> {
  // Already in new format
  if (value && typeof value === 'object') {
    if ('mediaId' in value || 'url' in value) {
      return value as MediaImageValue | ExternalImageValue
    }
  }

  // Not a string - preserve as-is
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const url = value.trim()

  // Check if it's a media library URL
  const isInternal = isMediaLibraryUrl(url, options?.mediaLibraryPattern)

  if (isInternal && options?.resolveMediaId) {
    try {
      const result = await options.resolveMediaId(url)
      if (result) {
        return {
          mediaId: result.mediaId,
          url: result.url || url,
          alt: result.alt,
          width: result.width,
          height: result.height,
        } as MediaImageValue
      }
    } catch (error) {
      if (options.verbose) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`[MediaMigration] Failed to resolve mediaId for "${url}":`, error)
        }
      }
    }
  }

  // External image
  return {
    url,
    alt: '',
  } as ExternalImageValue
}

/**
 * Migrate a single string file value to MediaFileValue
 */
export async function migrateFileValue(
  value: unknown,
  options?: MediaMigrationOptions
): Promise<MediaFileValue | string | null> {
  // Already in new format
  if (value && typeof value === 'object' && 'mediaId' in value) {
    return value as MediaFileValue
  }

  // Not a string - preserve as-is
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const url = value.trim()
  const filename = extractFilename(url)

  // Try to resolve mediaId
  if (options?.resolveMediaId) {
    try {
      const result = await options.resolveMediaId(url)
      if (result) {
        return {
          mediaId: result.mediaId,
          url: result.url || url,
          filename: result.filename || filename,
          size: result.size,
          mimeType: result.mimeType,
        } as MediaFileValue
      }
    } catch (error) {
      if (options.verbose) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`[MediaMigration] Failed to resolve mediaId for "${url}":`, error)
        }
      }
    }
  }

  // Return with empty mediaId (needs resolution)
  return {
    mediaId: '',
    url,
    filename,
  } as MediaFileValue
}

/**
 * Migrate a single string video value to MediaVideoValue
 */
export async function migrateVideoValue(
  value: unknown,
  options?: MediaMigrationOptions
): Promise<MediaVideoValue | string | null> {
  // Already in new format
  if (value && typeof value === 'object' && 'url' in value) {
    return value as MediaVideoValue
  }

  // Not a string - preserve as-is
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const url = value.trim()

  // Try to resolve mediaId for internal videos
  if (isMediaLibraryUrl(url, options?.mediaLibraryPattern) && options?.resolveMediaId) {
    try {
      const result = await options.resolveMediaId(url)
      if (result) {
        return {
          mediaId: result.mediaId,
          url: result.url || url,
        } as MediaVideoValue
      }
    } catch (error) {
      if (options.verbose) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`[MediaMigration] Failed to resolve mediaId for "${url}":`, error)
        }
      }
    }
  }

  // External video
  return {
    url,
  } as MediaVideoValue
}

/**
 * Migrate media values in an object (deep scan)
 */
export async function migrateMediaValuesInObject(
  obj: Record<string, unknown>,
  mediaFields: {
    image?: string[]
    video?: string[]
    file?: string[]
  } = {
    image: ['image', 'backgroundImage', 'thumbnail', 'logo', 'avatar', 'photo', 'src'],
    video: ['video', 'videoUrl', 'videoSrc'],
    file: ['file', 'document', 'attachment', 'pdf'],
  },
  options?: MediaMigrationOptions
): Promise<{
  result: Record<string, unknown>
  stats: MediaMigrationResult
}> {
  const stats: MediaMigrationResult = {
    migrated: 0,
    preserved: 0,
    external: 0,
    failed: 0,
    warnings: [],
  }

  const imageFields = mediaFields.image || []
  const videoFields = mediaFields.video || []
  const fileFields = mediaFields.file || []

  function isFieldMatch(key: string, fields: string[]): boolean {
    const lower = key.toLowerCase()
    return fields.some((f) => lower.includes(f.toLowerCase()))
  }

  async function processValue(
    value: unknown,
    key: string,
    path: string
  ): Promise<unknown> {
    // Check if this is a media field
    if (typeof value === 'string' && value.trim()) {
      if (isFieldMatch(key, imageFields)) {
        try {
          const migrated = await migrateImageValue(value, options)
          if (migrated && typeof migrated === 'object') {
            if ('mediaId' in migrated && migrated.mediaId) {
              stats.migrated++
            } else {
              stats.external++
            }
            return migrated
          }
          stats.failed++
          return value
        } catch (error) {
          stats.failed++
          stats.warnings.push(`Failed to migrate image at ${path}: ${error}`)
          return value
        }
      }

      if (isFieldMatch(key, videoFields)) {
        try {
          const migrated = await migrateVideoValue(value, options)
          if (migrated && typeof migrated === 'object') {
            if ('mediaId' in migrated && migrated.mediaId) {
              stats.migrated++
            } else {
              stats.external++
            }
            return migrated
          }
          stats.failed++
          return value
        } catch (error) {
          stats.failed++
          stats.warnings.push(`Failed to migrate video at ${path}: ${error}`)
          return value
        }
      }

      if (isFieldMatch(key, fileFields)) {
        try {
          const migrated = await migrateFileValue(value, options)
          if (migrated && typeof migrated === 'object') {
            if ('mediaId' in migrated && migrated.mediaId) {
              stats.migrated++
            } else {
              stats.preserved++
            }
            return migrated
          }
          stats.failed++
          return value
        } catch (error) {
          stats.failed++
          stats.warnings.push(`Failed to migrate file at ${path}: ${error}`)
          return value
        }
      }
    }

    // Recurse into objects
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        const results = await Promise.all(
          value.map((item, i) => processValue(item, String(i), `${path}[${i}]`))
        )
        return results
      } else {
        const result: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) {
          result[k] = await processValue(v, k, `${path}.${k}`)
        }
        return result
      }
    }

    return value
  }

  const result = (await processValue(obj, '', '')) as Record<string, unknown>
  return { result, stats }
}

/**
 * Convert MediaImageValue or ExternalImageValue back to string (for export/display)
 */
export function mediaValueToString(
  value: MediaImageValue | ExternalImageValue | MediaVideoValue | MediaFileValue | string | null
): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  return value.url || ''
}

/**
 * Validate a MediaImageValue
 */
export function validateMediaImageValue(
  value: MediaImageValue | ExternalImageValue
): { valid: boolean; message?: string } {
  if (!value.url) {
    return { valid: false, message: 'Image missing URL' }
  }

  try {
    new URL(value.url, 'http://localhost')
  } catch {
    return { valid: false, message: 'Invalid image URL' }
  }

  if ('mediaId' in value && !value.mediaId) {
    return { valid: true, message: 'Media library image ID not resolved' }
  }

  return { valid: true }
}
