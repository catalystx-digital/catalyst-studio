/**
 * Import Planner Types
 *
 * Types for the LLM-driven import strategy planner.
 * This module enables flexible URL crawling strategies based on user intent.
 *
 * @module import-planner.types
 */

// =============================================================================
// Core Strategy Types
// =============================================================================

/**
 * Import strategy determines how URLs are discovered and processed.
 *
 * - `sitemap`: Use the website's sitemap.xml to discover pages
 * - `crawl_from_root`: Start from a URL and follow links (BFS crawl)
 * - `specific_urls`: Import exact URLs provided by the user
 */
export type ImportStrategy = 'sitemap' | 'crawl_from_root' | 'specific_urls'

/**
 * Link scope determines which links are followed during crawl.
 *
 * - `same_path`: Only follow links that start with the base URL's path
 * - `same_domain`: Follow any link on the same domain
 * - `none`: Don't follow links, only import the exact URLs provided
 */
export type LinkScope = 'same_path' | 'same_domain' | 'none'

// =============================================================================
// Import Plan Types
// =============================================================================

/**
 * The result of the import planning process.
 * Contains the selected strategy and configuration for URL discovery.
 */
export interface ImportPlan {
  /** Selected import strategy */
  strategy: ImportStrategy

  /** Starting URLs for the import */
  urls: string[]

  /** Whether to follow links from discovered pages */
  followLinks: boolean

  /** Scope for link following */
  linkScope: LinkScope

  /** Maximum pages to import */
  maxPages: number

  /** LLM's reasoning for the chosen strategy */
  reasoning: string
}

/**
 * Input to the import planner service.
 * Supports multiple input modes: natural language, single URL, or multiple URLs.
 */
export interface ImportPlannerInput {
  /** Natural language request (e.g., "import all courses pages") */
  request?: string

  /** Single URL (existing behavior) */
  url?: string

  /** Multiple URLs (new: for specific page imports) */
  urls?: string[]

  /** Whether to crawl subpages of provided URLs */
  followSubpages?: boolean

  /** Maximum link depth to crawl */
  maxDepth?: number
}

// =============================================================================
// Tool Result Types
// =============================================================================

/**
 * Result from the check_sitemap tool.
 * Used by the LLM to determine if sitemap-based import is viable.
 */
export interface SitemapCheckResult {
  /** Whether a sitemap was found */
  exists: boolean

  /** The sitemap URL that was checked */
  url: string

  /** Number of URLs in the sitemap (if found and parseable) */
  urlCount?: number

  /** Error message if check failed */
  error?: string
}

/**
 * Result from the probe_page_links tool.
 * Used by the LLM to understand site structure and decide on crawl strategy.
 */
export interface PageLinksResult {
  /** The page URL that was probed */
  url: string

  /** Total number of unique links found */
  linkCount: number

  /** Sample of internal links (up to 10) */
  sampleLinks: string[]

  /** Count of links pointing to same domain */
  internalLinkCount: number

  /** Count of links pointing to external domains */
  externalLinkCount: number

  /** Error message if probe failed */
  error?: string
}

/**
 * Arguments for the set_import_plan tool.
 * Called by the LLM to finalize the import strategy.
 */
export interface SetImportPlanArgs {
  /** The import strategy to use */
  strategy: ImportStrategy

  /** Starting URLs for the import */
  urls: string[]

  /** Whether to follow links from discovered pages */
  followLinks: boolean

  /** Scope for link following */
  linkScope: LinkScope

  /** Brief explanation of why this strategy was chosen */
  reasoning: string
}

// =============================================================================
// Planner Service Types
// =============================================================================

/**
 * Configuration for the import planner service.
 */
export interface ImportPlannerConfig {
  /** Model to use for planning */
  model: string

  /** Maximum tool iterations before fallback */
  maxIterations: number

  /** Enable deterministic planning for structured input (skip LLM) */
  enableDeterministic: boolean

  /** Log planner decisions */
  logDecisions: boolean
}

/**
 * Result of a planner tool execution.
 */
export interface ToolExecutionResult {
  /** Tool name that was executed */
  toolName: string

  /** Tool call ID from the LLM response */
  toolCallId: string

  /** Result of the tool execution */
  result: unknown

  /** Whether the tool execution was successful */
  success: boolean

  /** Error message if execution failed */
  error?: string
}
