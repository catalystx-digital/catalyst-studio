/**
 * URL Prioritizer Utility
 *
 * Reorders discovered URLs to prioritize specific paths and their children.
 * Used for presentation/demo scenarios where certain sections need to work first.
 *
 * Order:
 *   1. Home page (always first)
 *   2. Priority exact matches (in order specified)
 *   3. Priority children (sorted by depth, shallower first)
 *   4. Non-priority pages (original discovery order)
 *
 * @module url-prioritizer
 */

export interface PrioritizeUrlsOptions {
  /**
   * Full list of discovered URLs from sitemap discovery
   */
  urls: string[]

  /**
   * Priority paths or full URLs to boost.
   * Can be paths like "/health-professionals" or full URLs.
   * Trailing slashes are normalized, comparison is case-insensitive.
   */
  priorityPaths: string[]

  /**
   * Maximum URLs to return (applied after prioritization)
   */
  maxUrls?: number
}

export interface PrioritizeUrlsResult {
  /**
   * Reordered URLs with priorities applied
   */
  urls: string[]

  /**
   * Statistics about the prioritization
   */
  stats: {
    /** Total input URLs */
    totalInput: number
    /** URLs matching priority paths exactly */
    priorityExactCount: number
    /** URLs that are children of priority paths */
    priorityChildrenCount: number
    /** Non-priority URLs included */
    nonPriorityCount: number
    /** Total output URLs */
    totalOutput: number
  }
}

/**
 * Normalize a path for comparison:
 * - Extract pathname from full URL if needed
 * - Remove trailing slash (except for root "/")
 * - Convert to lowercase
 */
function normalizePath(urlOrPath: string): string {
  let path: string

  try {
    // Check if it's a full URL
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      const url = new URL(urlOrPath)
      path = url.pathname
    } else {
      path = urlOrPath
    }
  } catch {
    // Not a valid URL, treat as path
    path = urlOrPath
  }

  // Remove trailing slash (but keep "/" for root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // Lowercase for case-insensitive comparison
  return path.toLowerCase()
}

/**
 * Extract pathname from a URL string
 */
function getPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/**
 * Check if a path is the home/root path
 */
function isHomePath(path: string): boolean {
  const normalized = normalizePath(path)
  return normalized === '/' || normalized === ''
}

/**
 * Calculate path depth (number of non-empty segments)
 */
function getPathDepth(url: string): number {
  const pathname = getPathname(url)
  return pathname.split('/').filter(Boolean).length
}

/**
 * Prioritize URLs based on specified priority paths.
 *
 * @example
 * ```typescript
 * const result = prioritizeUrls({
 *   urls: discoveredUrls,
 *   priorityPaths: ['/health-professionals', '/research'],
 *   maxUrls: 100
 * })
 * ```
 */
export function prioritizeUrls(options: PrioritizeUrlsOptions): PrioritizeUrlsResult {
  const { urls, priorityPaths, maxUrls } = options

  // Early return if no priority paths
  if (!priorityPaths || priorityPaths.length === 0) {
    const limited = maxUrls ? urls.slice(0, maxUrls) : urls
    return {
      urls: limited,
      stats: {
        totalInput: urls.length,
        priorityExactCount: 0,
        priorityChildrenCount: 0,
        nonPriorityCount: limited.length,
        totalOutput: limited.length
      }
    }
  }

  // Normalize priority paths for comparison
  const normalizedPriorities = priorityPaths.map(normalizePath)

  // Categorize URLs
  let homeUrl: string | null = null
  const priorityExact: string[] = []
  const priorityChildren: Map<string, string[]> = new Map() // priority path -> children
  const nonPriority: string[] = []

  // Initialize children map for each priority
  for (const priority of normalizedPriorities) {
    priorityChildren.set(priority, [])
  }

  for (const url of urls) {
    const normalizedPath = normalizePath(url)

    // Check for home page
    if (isHomePath(normalizedPath)) {
      homeUrl = url
      continue
    }

    // Check if this URL matches or is child of any priority path
    let matched = false
    for (const priority of normalizedPriorities) {
      // Skip if priority is home (handled separately)
      if (priority === '/' || priority === '') {
        continue
      }

      // Exact match
      if (normalizedPath === priority) {
        priorityExact.push(url)
        matched = true
        break
      }

      // Child match: path starts with priority + "/"
      if (normalizedPath.startsWith(priority + '/')) {
        priorityChildren.get(priority)!.push(url)
        matched = true
        break
      }
    }

    if (!matched) {
      nonPriority.push(url)
    }
  }

  // Sort children by depth (shallower first) within each priority group
  const sortedChildren: string[] = []
  for (const priority of normalizedPriorities) {
    const children = priorityChildren.get(priority) || []
    children.sort((a, b) => getPathDepth(a) - getPathDepth(b))
    sortedChildren.push(...children)
  }

  // Build final ordered list
  const result: string[] = []

  // 1. Home page always first
  if (homeUrl) {
    result.push(homeUrl)
  }

  // 2. Priority exact matches (in order specified by user)
  // Sort by the order they appear in priorityPaths
  priorityExact.sort((a, b) => {
    const aPath = normalizePath(a)
    const bPath = normalizePath(b)
    const aIndex = normalizedPriorities.indexOf(aPath)
    const bIndex = normalizedPriorities.indexOf(bPath)
    return aIndex - bIndex
  })
  result.push(...priorityExact)

  // 3. Priority children (already sorted by depth)
  result.push(...sortedChildren)

  // 4. Non-priority pages (original discovery order preserved)
  result.push(...nonPriority)

  // Apply max limit
  const limited = maxUrls ? result.slice(0, maxUrls) : result

  // Calculate stats
  const priorityChildrenCount = sortedChildren.length
  const includedPriorityExact = priorityExact.filter(u => limited.includes(u)).length
  const includedChildren = sortedChildren.filter(u => limited.includes(u)).length
  const includedNonPriority = nonPriority.filter(u => limited.includes(u)).length

  return {
    urls: limited,
    stats: {
      totalInput: urls.length,
      priorityExactCount: includedPriorityExact,
      priorityChildrenCount: includedChildren,
      nonPriorityCount: includedNonPriority + (homeUrl && limited.includes(homeUrl) ? 1 : 0),
      totalOutput: limited.length
    }
  }
}

/**
 * Parse priority URLs from CLI argument.
 * Accepts comma-separated paths or URLs.
 *
 * @example
 * ```typescript
 * const paths = parsePriorityUrlsArg('/health-professionals,/research,/departments')
 * // Returns: ['/health-professionals', '/research', '/departments']
 *
 * const paths = parsePriorityUrlsArg('https://example.com/about, https://example.com/contact')
 * // Returns: ['https://example.com/about', 'https://example.com/contact']
 * ```
 */
export function parsePriorityUrlsArg(arg: string): string[] {
  if (!arg || arg.trim() === '') {
    return []
  }

  return arg
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}
