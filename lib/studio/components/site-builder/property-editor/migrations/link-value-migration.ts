/**
 * Link Value Migration
 *
 * Converts existing href string fields to the new schema-aligned link value format:
 * - Internal links: { type: 'internal', pageId: string, path: string, label? }
 * - External links: { type: 'external', url: string, label?, openInNewTab? }
 * - Email links: { type: 'email', href: string, label? }
 * - Phone links: { type: 'phone', href: string, label? }
 * - Anchor links: { type: 'anchor', href: string, label? }
 */

import type {
  LinkValue,
  InternalLinkValue,
  ExternalLinkValue,
  EmailLinkValue,
  PhoneLinkValue,
  AnchorLinkValue,
} from '../schema/types'

export interface PageLookupResult {
  pageId: string
  path: string
}

export interface LinkMigrationOptions {
  /** Function to resolve internal path to pageId */
  resolvePageId?: (path: string) => Promise<PageLookupResult | null>
  /** Whether to preserve original value if resolution fails */
  preserveOriginal?: boolean
  /** Log warnings for failed resolutions */
  verbose?: boolean
}

export interface LinkMigrationResult {
  migrated: number
  preserved: number
  failed: number
  warnings: string[]
}

/**
 * Detect the type of link from a string value
 */
export function detectLinkType(
  value: string
): 'internal' | 'external' | 'email' | 'phone' | 'anchor' | 'unknown' {
  if (!value || typeof value !== 'string') {
    return 'unknown'
  }

  const trimmed = value.trim()

  // Check for mailto: prefix
  if (trimmed.startsWith('mailto:')) {
    return 'email'
  }

  // Check for tel: prefix
  if (trimmed.startsWith('tel:')) {
    return 'phone'
  }

  // Check for anchor link
  if (trimmed.startsWith('#')) {
    return 'anchor'
  }

  // Check for external URL (http://, https://, //)
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//')
  ) {
    return 'external'
  }

  // Check for internal path (starts with /)
  if (trimmed.startsWith('/')) {
    return 'internal'
  }

  // Could be a relative path or unknown format
  // Treat as external if it looks like a domain
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return 'external'
  }

  return 'unknown'
}

/**
 * Migrate a single string link value to LinkValue format
 */
export async function migrateLinkValue(
  value: unknown,
  options?: LinkMigrationOptions
): Promise<LinkValue | string | null> {
  // Already in new format
  if (value && typeof value === 'object' && 'type' in value) {
    return value as LinkValue
  }

  // Not a string - preserve as-is
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const trimmed = value.trim()
  const linkType = detectLinkType(trimmed)

  switch (linkType) {
    case 'email': {
      // Schema-aligned format: uses 'href' per EmailLinkSchema
      const emailValue = trimmed.replace(/^mailto:/i, '')
      return {
        type: 'email',
        href: emailValue,
      } as EmailLinkValue
    }

    case 'phone': {
      // Schema-aligned format: uses 'href' per PhoneLinkSchema
      const phoneValue = trimmed.replace(/^tel:/i, '')
      return {
        type: 'phone',
        href: phoneValue,
      } as PhoneLinkValue
    }

    case 'anchor': {
      // Schema-aligned format: uses 'href' per AnchorLinkSchema
      return {
        type: 'anchor',
        href: trimmed,
      } as AnchorLinkValue
    }

    case 'external': {
      // Schema-aligned format: uses 'url' per ExternalLinkSchema
      let url = trimmed
      // Add protocol if missing
      if (url.startsWith('//')) {
        url = `https:${url}`
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`
      }
      return {
        type: 'external',
        url: url,
      } as ExternalLinkValue
    }

    case 'internal': {
      // Try to resolve pageId
      if (options?.resolvePageId) {
        try {
          const result = await options.resolvePageId(trimmed)
          if (result) {
            return {
              type: 'internal',
              pageId: result.pageId,
              path: result.path,
            } as InternalLinkValue
          }
        } catch (error) {
          if (options.verbose) {
            if (process.env.NODE_ENV === 'development') {
            console.warn(`[LinkMigration] Failed to resolve pageId for "${trimmed}":`, error)
            }
          }
        }
      }

      // If resolution failed or not provided, create with path only
      // The pageId will need to be resolved later
      return {
        type: 'internal',
        pageId: '', // Empty - needs resolution
        path: trimmed,
      } as InternalLinkValue
    }

    default:
      // Unknown type - preserve original if configured
      if (options?.preserveOriginal) {
        return value
      }
      // Otherwise treat as external (schema-aligned format)
      return {
        type: 'external',
        url: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
      } as ExternalLinkValue
  }
}

/**
 * Migrate link values in an object (deep scan)
 */
export async function migrateLinkValuesInObject(
  obj: Record<string, unknown>,
  linkFields: string[] = ['href', 'url', 'link', 'src'],
  options?: LinkMigrationOptions
): Promise<{
  result: Record<string, unknown>
  stats: LinkMigrationResult
}> {
  const stats: LinkMigrationResult = {
    migrated: 0,
    preserved: 0,
    failed: 0,
    warnings: [],
  }

  async function processValue(
    value: unknown,
    key: string,
    path: string
  ): Promise<unknown> {
    // Check if this is a link field
    const isLinkField = linkFields.some(
      (f) => key.toLowerCase().includes(f.toLowerCase())
    )

    if (isLinkField && typeof value === 'string' && value.trim()) {
      try {
        const migrated = await migrateLinkValue(value, options)
        if (migrated && typeof migrated === 'object') {
          stats.migrated++
          return migrated
        } else if (migrated === value) {
          stats.preserved++
          return value
        }
        stats.failed++
        return value
      } catch (error) {
        stats.failed++
        stats.warnings.push(`Failed to migrate link at ${path}: ${error}`)
        return value
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
 * Convert LinkValue back to string (for export/display)
 * Supports both old and new schema-aligned formats
 */
export function linkValueToString(value: LinkValue | string | null): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  switch (value.type) {
    case 'internal':
      return value.path
    case 'external':
      // New format uses 'url', old format used 'value'
      return value.url ?? (value as { value?: string }).value ?? ''
    case 'email':
      // New format uses 'href', old format used 'value'
      const emailValue = value.href ?? (value as { value?: string }).value ?? ''
      return emailValue.startsWith('mailto:') ? emailValue : `mailto:${emailValue}`
    case 'phone':
      // New format uses 'href', old format used 'value'
      const phoneValue = value.href ?? (value as { value?: string }).value ?? ''
      return phoneValue.startsWith('tel:') ? phoneValue : `tel:${phoneValue}`
    case 'anchor':
      // New format uses 'href', old format used 'value'
      return value.href ?? (value as { value?: string }).value ?? ''
    default:
      return ''
  }
}

/**
 * Validate a LinkValue
 * Supports both old and new schema-aligned formats
 */
export function validateLinkValue(
  value: LinkValue
): { valid: boolean; message?: string } {
  switch (value.type) {
    case 'internal':
      if (!value.path) {
        return { valid: false, message: 'Internal link missing path' }
      }
      if (!value.path.startsWith('/')) {
        return { valid: false, message: 'Internal link path must start with /' }
      }
      // pageId can be empty but should be resolved
      if (!value.pageId) {
        return { valid: true, message: 'Internal link pageId not yet resolved' }
      }
      return { valid: true }

    case 'external': {
      // New format uses 'url', old format used 'value'
      const url = value.url ?? (value as { value?: string }).value
      if (!url) {
        return { valid: false, message: 'External link missing URL' }
      }
      try {
        new URL(url)
        return { valid: true }
      } catch {
        return { valid: false, message: 'Invalid URL format' }
      }
    }

    case 'email': {
      // New format uses 'href', old format used 'value'
      const email = value.href ?? (value as { value?: string }).value
      if (!email) {
        return { valid: false, message: 'Email link missing address' }
      }
      if (!email.includes('@')) {
        return { valid: false, message: 'Invalid email format' }
      }
      return { valid: true }
    }

    case 'phone': {
      // New format uses 'href', old format used 'value'
      const phone = value.href ?? (value as { value?: string }).value
      if (!phone) {
        return { valid: false, message: 'Phone link missing number' }
      }
      return { valid: true }
    }

    case 'anchor': {
      // New format uses 'href', old format used 'value'
      const anchor = value.href ?? (value as { value?: string }).value
      if (!anchor) {
        return { valid: false, message: 'Anchor link missing target' }
      }
      if (!anchor.startsWith('#')) {
        return { valid: false, message: 'Anchor link must start with #' }
      }
      return { valid: true }
    }

    default:
      return { valid: false, message: 'Unknown link type' }
  }
}
