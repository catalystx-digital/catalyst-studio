/**
 * Import Planner Tool Handlers
 *
 * Implementation of the actual logic for each planner tool.
 * These handlers are called when the LLM invokes a tool during strategy planning.
 *
 * @module import-planner/tool-handlers
 */

import type {
  SitemapCheckResult,
  PageLinksResult,
} from '../../types/import-planner.types'

/** Timeout for network requests in milliseconds */
const REQUEST_TIMEOUT_MS = 10000

/** Timeout for HEAD requests (faster check) */
const HEAD_REQUEST_TIMEOUT_MS = 5000

/**
 * Check if a URL has a sitemap.xml file.
 *
 * @param url - The root URL to check for sitemap
 * @returns Result indicating if sitemap exists and how many URLs it contains
 */
export async function checkSitemap(url: string): Promise<SitemapCheckResult> {
  try {
    const parsed = new URL(url)
    const sitemapUrl = `${parsed.origin}/sitemap.xml`

    // First, do a quick HEAD request to check existence
    const headResponse = await fetchWithTimeout(sitemapUrl, {
      method: 'HEAD',
      timeoutMs: HEAD_REQUEST_TIMEOUT_MS,
    })

    if (!headResponse.ok) {
      return { exists: false, url: sitemapUrl }
    }

    // Sitemap exists, fetch it to count URLs
    const getResponse = await fetchWithTimeout(sitemapUrl, {
      method: 'GET',
      timeoutMs: REQUEST_TIMEOUT_MS,
    })

    if (!getResponse.ok) {
      // HEAD succeeded but GET failed - still consider it exists
      return { exists: true, url: sitemapUrl }
    }

    const text = await getResponse.text()

    // Count <loc> tags to estimate URL count
    const locMatches = text.match(/<loc>/gi) || []
    const urlCount = locMatches.length

    // Check if it's a sitemap index (contains other sitemaps)
    const isSitemapIndex =
      text.includes('<sitemapindex') || text.includes('sitemap.xml')

    return {
      exists: true,
      url: sitemapUrl,
      urlCount: isSitemapIndex ? undefined : urlCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      exists: false,
      url,
      error: message,
    }
  }
}

/**
 * Probe a page for links to understand site structure.
 *
 * @param url - The page URL to probe
 * @returns Link statistics and sample URLs
 */
export async function probePageLinks(url: string): Promise<PageLinksResult> {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      timeoutMs: REQUEST_TIMEOUT_MS,
    })

    if (!response.ok) {
      return {
        url,
        linkCount: 0,
        sampleLinks: [],
        internalLinkCount: 0,
        externalLinkCount: 0,
        error: `HTTP ${response.status}`,
      }
    }

    const html = await response.text()
    const parsed = new URL(url)

    // Extract all href values from anchor tags
    const hrefRegex = /href=["']([^"'#]+)["']/gi
    const links: string[] = []
    let match: RegExpExecArray | null

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1].trim()

      // Skip empty, javascript:, mailto:, tel: links
      if (
        !href ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('data:')
      ) {
        continue
      }

      try {
        const linkUrl = new URL(href, url)
        links.push(linkUrl.href)
      } catch {
        // Skip invalid URLs
      }
    }

    // Deduplicate
    const uniqueLinks = [...new Set(links)]

    // Categorize links
    const internalLinks = uniqueLinks.filter((link) => {
      try {
        return new URL(link).host === parsed.host
      } catch {
        return false
      }
    })

    const externalLinkCount = uniqueLinks.length - internalLinks.length

    // Get sample of internal links (up to 10)
    const sampleLinks = internalLinks.slice(0, 10)

    return {
      url,
      linkCount: uniqueLinks.length,
      sampleLinks,
      internalLinkCount: internalLinks.length,
      externalLinkCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      url,
      linkCount: 0,
      sampleLinks: [],
      internalLinkCount: 0,
      externalLinkCount: 0,
      error: message,
    }
  }
}

/**
 * Fetch with timeout using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: {
    method: 'GET' | 'HEAD'
    timeoutMs: number
  }
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await fetch(url, {
      method: options.method,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'CatalystStudio-ImportPlanner/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
