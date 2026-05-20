/**
 * Navigation Patterns
 *
 * Constants and patterns for navigation analysis in detection post-processing.
 * Extracted from detection-post-processor.ts
 *
 * @module navigation-patterns
 */

/**
 * Utility navigation labels - these should go in utilityNav, not menuItems.
 * Matched case-insensitively.
 */
export const UTILITY_NAV_LABELS = new Set([
  'home',
  'about',
  'about us',
  'news',
  'careers',
  'jobs',
  'shop',
  'store',
  'contact',
  'contact us',
  'login',
  'sign in',
  'signin',
  'log in',
  'register',
  'sign up',
  'signup',
  'portal',
  'my account',
  'account',
  'search',
  'faq',
  'help',
  'support',
  'donate',
  'give',
  'cart',
  'basket',
  'checkout'
])

/**
 * Section/department navigation labels - these are primary nav items.
 * They typically represent major site sections with substantial content.
 * Multi-industry patterns: generic, e-commerce, SaaS, media/blog.
 */
export const PRIMARY_NAV_PATTERNS = [
  // Generic patterns
  /^(departments?|services?)(\s*(and|&)\s*(services?|departments?))?$/i,
  /^research$/i,
  /^education$/i,
  /^training$/i,
  /^programs?$/i,
  /^resources?$/i,
  /^publications?$/i,
  /^solutions?$/i,
  /^products?$/i,
  /^platform$/i,
  /^industries?$/i,
  /^sectors?$/i,
  /^enterprise$/i,
  /^pricing$/i,
  /^plans?$/i,
  /^features?$/i,
  /^capabilities$/i,
  /^company$/i,
  /^team$/i,
  /^partners?$/i,
  /^community$/i,

  // E-Commerce patterns
  /^shop$/i,
  /^store$/i,
  /^collections?$/i,
  /^categories?$/i,
  /^catalog$/i,
  /^brands?$/i,
  /^deals?$/i,
  /^sale$/i,
  /^new\s*arrivals?$/i,
  /^best\s*sellers?$/i,
  /^clearance$/i,

  // SaaS patterns
  /^docs?$/i,
  /^documentation$/i,
  /^api$/i,
  /^developers?$/i,
  /^integrations?$/i,
  /^use\s*cases?$/i,
  /^customers?$/i,
  /^case\s*studies?$/i,
  /^templates?$/i,
  /^changelog$/i,
  /^status$/i,

  // Media/Blog patterns
  /^blog$/i,
  /^articles?$/i,
  /^podcasts?$/i,
  /^videos?$/i,
  /^news$/i,
  /^press$/i,
  /^media$/i,
  /^stories?$/i,
  /^insights?$/i,
  /^learn$/i,
  /^guides?$/i,
  /^tutorials?$/i,
  /^webinars?$/i,
  /^events?$/i
]

/**
 * Patterns that indicate a section-specific sidemenu rather than a global navbar.
 * These are typically department/section navigation that should NOT be the main navbar.
 *
 * Generic patterns only - no site-specific patterns should be added here.
 */
export const SIDEMENU_HREF_PATTERNS = [
  /^\/[^/]+\/[^/]+\//i,  // Deep paths (2+ levels) like /section/subsection/page
]

/**
 * Labels that strongly suggest a section sidemenu rather than global nav.
 */
export const SIDEMENU_LABEL_INDICATORS = [
  'about us',
  'our team',
  'our vision',
  'our mission',
  'contact us',
  'how we help',
  'what we do',
  'getting here',
  'directions',
  'location',
  'our services',
  'resources',
  'publications',
  'media',
  'gallery',
  'events',
  'news'
]

/**
 * Check if a menu item label indicates a utility navigation item
 *
 * @param label - Menu item label to check
 * @returns True if it's a utility nav item
 */
export function isUtilityNavLabel(label: string): boolean {
  if (!label) {
    return false
  }
  const normalized = label.toLowerCase().trim()
  if (UTILITY_NAV_LABELS.has(normalized)) {
    return true
  }
  // Check for portal-like items (e.g., "My Account Portal", "Staff Portal")
  if (/\bportal\b/i.test(normalized) || /^my\s+\w+$/i.test(normalized)) {
    return true
  }
  return false
}

/**
 * Check if a menu item label indicates a primary (category) navigation item
 *
 * @param label - Menu item label to check
 * @returns True if it's a primary nav item
 */
export function isPrimaryNavLabel(label: string): boolean {
  if (!label) {
    return false
  }
  const normalized = label.trim()
  return PRIMARY_NAV_PATTERNS.some(pattern => pattern.test(normalized))
}

/**
 * Menu item interface for navigation analysis.
 */
export interface MenuItemLike {
  label?: string
  text?: string
  href?: string
  url?: string
  external?: boolean
  children?: MenuItemLike[]
  [key: string]: unknown
}
