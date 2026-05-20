import { join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import type { SiteSnapshot } from '../../core/types'
import { ProjectBuilder } from '../project-builder'

const EXCLUDED_DIRECTORIES = new Set(['__tests__', '_tests', '_docs', '__mocks__', 'stories', 'dom-probe'])
const EXCLUDED_FILE_PATTERNS = [
  /\.stories\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\.test\.[tj]sx?$/,
  /\.mdx?$/,
  // Design concept management files - not needed for runtime rendering
  /design-concept\.service\.ts$/,
  /palette-shuffle\.ts$/,
  // Prisma schema is added manually with modified output path
  /schema\.prisma$/,
]

export function addDirectoryToBuilder(builder: ProjectBuilder, sourceDir: string, targetDir: string): void {
  const entries = readdirSync(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue
      }
      addDirectoryToBuilder(builder, sourcePath, targetPath)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(entry.name))) {
      continue
    }

    const contents = readFileSync(sourcePath)
    builder.addFile(targetPath, contents)
  }
}

export type RemoteImagePattern = {
  protocol: 'http' | 'https'
  hostname: string
}

/**
 * Common subdomains to include when adding the origin domain.
 * This ensures images from related subdomains are accessible.
 */
const COMMON_SUBDOMAINS = ['www', 'cdn', 'images', 'img', 'media', 'assets', 'static', 'blogs']

/**
 * Default stock image CDN hostnames that are always included.
 * These are commonly used by AI-generated content and should be available
 * in all exported sites without requiring them to appear in the snapshot.
 */
const DEFAULT_STOCK_IMAGE_HOSTNAMES: RemoteImagePattern[] = [
  // Pexels
  { protocol: 'https', hostname: 'images.pexels.com' },
  // Unsplash
  { protocol: 'https', hostname: 'images.unsplash.com' },
  // Pixabay
  { protocol: 'https', hostname: 'pixabay.com' },
  { protocol: 'https', hostname: 'cdn.pixabay.com' },
  // Placeholder services
  { protocol: 'https', hostname: 'via.placeholder.com' },
  { protocol: 'https', hostname: 'placehold.co' },
  { protocol: 'https', hostname: 'picsum.photos' },
]

/**
 * Extracts the base domain from a hostname (e.g., "www.example.com" -> "example.com")
 */
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.')
  // Handle cases like "co.uk", "com.au" etc.
  if (parts.length > 2) {
    // Check if it's a country code TLD with secondary TLD (e.g., .org.au, .co.uk)
    const lastTwo = parts.slice(-2).join('.')
    const countryCodeTlds = ['org.au', 'com.au', 'co.uk', 'org.uk', 'co.nz', 'org.nz']
    if (countryCodeTlds.includes(lastTwo)) {
      return parts.slice(-3).join('.')
    }
    // Otherwise, return last two parts
    return parts.slice(-2).join('.')
  }
  return hostname
}

/**
 * Adds origin domain and common subdomains to the patterns map
 */
function addOriginPatterns(
  patterns: Map<string, RemoteImagePattern>,
  origin: string | undefined
): void {
  if (!origin) return

  try {
    const url = new URL(origin)
    const protocol: 'http' | 'https' = url.protocol === 'http:' ? 'http' : 'https'
    const hostname = url.hostname

    // Add the origin hostname itself
    const originKey = `${protocol}://${hostname}`
    if (!patterns.has(originKey)) {
      patterns.set(originKey, { protocol, hostname })
    }

    // Extract base domain and add common subdomains
    const baseDomain = getBaseDomain(hostname)

    // Add common subdomains for the base domain
    for (const subdomain of COMMON_SUBDOMAINS) {
      const subdomainHost = `${subdomain}.${baseDomain}`
      const subdomainKey = `${protocol}://${subdomainHost}`
      if (!patterns.has(subdomainKey)) {
        patterns.set(subdomainKey, { protocol, hostname: subdomainHost })
      }
    }

    // Also add the bare base domain (without www)
    if (hostname !== baseDomain) {
      const baseKey = `${protocol}://${baseDomain}`
      if (!patterns.has(baseKey)) {
        patterns.set(baseKey, { protocol, hostname: baseDomain })
      }
    }
  } catch {
    // Ignore invalid origin URLs
  }
}

export interface CollectRemoteImagePatternsOptions {
  /** Optional media storage base URL (e.g., Supabase storage URL) */
  mediaStorageUrl?: string
}

export function collectRemoteImagePatterns(
  snapshot: SiteSnapshot,
  options: CollectRemoteImagePatternsOptions = {}
): RemoteImagePattern[] {
  const patterns = new Map<string, RemoteImagePattern>()

  // Add default stock image CDN hostnames first
  for (const pattern of DEFAULT_STOCK_IMAGE_HOSTNAMES) {
    const key = `${pattern.protocol}://${pattern.hostname}`
    if (!patterns.has(key)) {
      patterns.set(key, pattern)
    }
  }

  // Add media storage URL hostname (e.g., Supabase storage)
  if (options.mediaStorageUrl) {
    try {
      const url = new URL(options.mediaStorageUrl)
      const protocol: 'http' | 'https' = url.protocol === 'http:' ? 'http' : 'https'
      const key = `${protocol}://${url.hostname}`
      if (!patterns.has(key)) {
        patterns.set(key, { protocol, hostname: url.hostname })
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  // Add origin domain and common subdomains
  addOriginPatterns(patterns, snapshot.site.origin)

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
          const url = new URL(value)
          const protocol = url.protocol === 'http:' ? 'http' : url.protocol === 'https:' ? 'https' : undefined
          if (protocol && url.hostname) {
            const key = `${protocol}://${url.hostname}`
            if (!patterns.has(key)) {
              patterns.set(key, {
                protocol,
                hostname: url.hostname
              })
            }
          }
        } catch {
          // Ignore invalid URLs
        }
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit)
    }
  }

  visit(snapshot)

  return Array.from(patterns.values()).sort((a, b) => {
    if (a.hostname === b.hostname) {
      return a.protocol.localeCompare(b.protocol)
    }
    return a.hostname.localeCompare(b.hostname)
  })
}
