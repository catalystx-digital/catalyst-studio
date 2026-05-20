/**
 * Alias Registry - Generic Component Type Alias Resolution
 *
 * Replaces hardcoded switch statement in canonicalization.ts with dynamic
 * registry that reads aliases from component definitions.
 *
 * @module alias-registry
 */

import { ComponentType } from './types'

/**
 * Cached alias map: alias → canonical type
 */
let aliasMap: Map<string, string> | null = null

/**
 * Build alias map from component definitions
 * Scans all .def.ts files and extracts aliases field
 */
function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>()

  // Hardcoded aliases from migration of canonicalization.ts switch statement
  // TODO: Move these to component definition files (*.def.ts) as aliases field
  const aliasConfig: Record<string, string[]> = {
    'navbar': [
      'nav',
      'navbar',
      'nav-bar',
      'navigation',
      'navigationbar',
      'navigation-menu',
      'navigationmenu',
      'menu-bar',
      'menubar',
      'top-nav',
      'topnav',
      'site-header',
      'siteheader',
      'global-header',
      'globalheader',
      'header',
    ],
    'blog-post': [
      'blogpost',
      'blogposts',
      'blog-article',
      'blogarticle',
      'article',
      'articlebody',
      'article-content',
      'articlecontent',
    ],
    'blog-list': [
      'bloglist',
      'blog-index',
      'article-list',
      'articlelist',
      'post-list',
    ],
    'article-header': ['articleheader'],
    'author-bio': ['authorbio'],
    'rich-text': ['richtext'],
    'quote-block': ['quote', 'quoteblock', 'quote-block'],
    'footer': [
      'site-footer',
      'sitefooter',
      'global-footer',
      'globalfooter',
      'footer-menu',
      'footermenu',
    ],
    // Greenfield section name aliases (TKT-090)
    // These map high-level IA section names to registered component types
    'text-block': [
      'problem-statement',
      'category-overview',
      'contact-info',
      'about-story',
      'credentials',
      'team-values',
      'content-section',
      'general-section',
      'info-section',
      'text', // Generic text maps to text-block
      'textblock',
    ],
    'testimonials': [
      'testimonials-grid',
      'social-proof',
      'reviews',
    ],
    'hero-simple': [
      'herosimple',
      'simple-hero',
      'hero-introduction',
      'hero-intro',
      'hero', // Generic hero maps to hero-simple
    ],
    'feature-grid': [
      'value-propositions',
      'value-props',
      'key-benefits',
    ],
    'cta-simple': [
      'call-to-action',
      'contact-form',
      'cta',
      'cta-section',
      'call-to-action-section',
      'action-section',
      'social-section',
      'connect-section',
    ],
    'feature-list': [
      'subcategory-navigation',
      'service-list',
    ],
    'statistics': [
      'stats-grid',
      'stats-section',
      'stats',
      'key-stats',
      'metrics',
    ],
    // Hero component aliases (LLM sometimes uses variations)
    'hero-video': [
      'hero-with-video',
      'herovideo',
      'video-hero',
    ],
    'hero-with-image': [
      'herowithimage',
      'hero-image',
      'image-hero',
    ],
    'hero-carousel': [
      'herocarousel',
      'hero-slider',
      'heroslider',
      'carousel-hero',
    ],
    'hero-banner': [
      'herobanner',
      'banner-hero',
    ],
    'hero-split': [
      'herosplit',
      'split-hero',
    ],
    'hero-minimal': [
      'herominimal',
      'minimal-hero',
    ],
  }

  // Build map from configuration
  for (const [canonical, aliases] of Object.entries(aliasConfig)) {
    for (const alias of aliases) {
      map.set(alias, canonical)
    }
  }

  return map
}

/**
 * Get or build the alias map (cached)
 */
function getAliasMap(): Map<string, string> {
  if (!aliasMap) {
    aliasMap = buildAliasMap()
  }
  return aliasMap
}

/**
 * Resolve an alias to its canonical component type
 *
 * @param alias - Normalized alias string (lowercase, hyphens)
 * @returns Canonical type string or null if not found
 *
 * @example
 * resolveAlias('nav-bar') // 'navbar'
 * resolveAlias('blog-article') // 'blog-post'
 * resolveAlias('unknown') // null
 */
export function resolveAlias(alias: string): string | null {
  const map = getAliasMap()
  return map.get(alias) || null
}

/**
 * Clear the alias map cache
 * Useful for testing or dynamic component registration
 */
export function clearAliasCache(): void {
  aliasMap = null
}

/**
 * Get all registered aliases
 * Useful for debugging and introspection
 */
export function getAllAliases(): Record<string, string> {
  const map = getAliasMap()
  const result: Record<string, string> = {}
  for (const [alias, canonical] of map.entries()) {
    result[alias] = canonical
  }
  return result
}

/**
 * Get alias count for debugging
 */
export function getAliasCount(): number {
  return getAliasMap().size
}
