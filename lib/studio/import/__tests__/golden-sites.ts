/**
 * Golden Sites Test List
 *
 * Curated list of diverse websites for testing post-processor generalization.
 * Each site represents a different industry/pattern type.
 *
 * Selection Criteria:
 * - Public websites (no auth required)
 * - Stable URLs (established organizations, unlikely to change)
 * - Representative of their category
 * - Mix of complexity levels
 */

export interface GoldenSite {
  url: string
  name: string
  category:
    | 'healthcare'
    | 'saas'
    | 'ecommerce'
    | 'blog'
    | 'portfolio'
    | 'institutional'
  expectedPatterns: {
    hasNavbar: boolean
    hasSidemenu?: boolean
    hasHero?: boolean
    hasContentFeed?: boolean
    primaryContentType?: string // blog, news, products, services, etc.
  }
  notes?: string
}

export const GOLDEN_SITES: GoldenSite[] = [
  // ============================================
  // Healthcare/Institutional (3)
  // ============================================
  {
    url: 'https://www.rch.org.au/',
    name: "Royal Children's Hospital",
    category: 'healthcare',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: true,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'news',
    },
    notes: 'Original test site - healthcare with complex mega-menu navigation',
  },
  {
    url: 'https://www.mayoclinic.org/',
    name: 'Mayo Clinic',
    category: 'healthcare',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: true,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'health-info',
    },
    notes: 'Major US healthcare - extensive content hierarchy, search-focused',
  },
  {
    url: 'https://www.hopkinsmedicine.org/',
    name: 'Johns Hopkins Medicine',
    category: 'healthcare',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: true,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'health-info',
    },
    notes: 'Academic medical center - mix of patient info and research',
  },

  // ============================================
  // SaaS/Tech (2)
  // ============================================
  {
    url: 'https://www.notion.so/',
    name: 'Notion',
    category: 'saas',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: false,
      hasHero: true,
      hasContentFeed: false,
      primaryContentType: 'product',
    },
    notes: 'Modern SaaS - clean hero, feature sections, CTAs',
  },
  {
    url: 'https://linear.app/',
    name: 'Linear',
    category: 'saas',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: false,
      hasHero: true,
      hasContentFeed: false,
      primaryContentType: 'product',
    },
    notes: 'Developer-focused SaaS - minimal, product-centric design',
  },

  // ============================================
  // E-commerce (2)
  // ============================================
  {
    url: 'https://www.allbirds.com/',
    name: 'Allbirds',
    category: 'ecommerce',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: false,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'products',
    },
    notes: 'DTC e-commerce - product grid, category navigation',
  },
  {
    url: 'https://www.patagonia.com/',
    name: 'Patagonia',
    category: 'ecommerce',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: false,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'products',
    },
    notes: 'Outdoor brand - product categories, story-driven content',
  },

  // ============================================
  // Blog/WordPress (2)
  // ============================================
  {
    url: 'https://www.smashingmagazine.com/',
    name: 'Smashing Magazine',
    category: 'blog',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: true,
      hasHero: false,
      hasContentFeed: true,
      primaryContentType: 'articles',
    },
    notes: 'Tech blog - article feed, category sidebar, author pages',
  },
  {
    url: 'https://css-tricks.com/',
    name: 'CSS-Tricks',
    category: 'blog',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: true,
      hasHero: false,
      hasContentFeed: true,
      primaryContentType: 'articles',
    },
    notes: 'Developer blog - tutorials, guides, code snippets',
  },

  // ============================================
  // Portfolio (1)
  // ============================================
  {
    url: 'https://www.stripe.com/press',
    name: 'Stripe Press',
    category: 'portfolio',
    expectedPatterns: {
      hasNavbar: true,
      hasSidemenu: false,
      hasHero: true,
      hasContentFeed: true,
      primaryContentType: 'books',
    },
    notes: 'Publishing portfolio - clean grid layout, minimal navigation',
  },
]

/**
 * Filter golden sites by category
 */
export function getGoldenSitesByCategory(
  category: GoldenSite['category']
): GoldenSite[] {
  return GOLDEN_SITES.filter((site) => site.category === category)
}

/**
 * Get a random golden site for testing
 */
export function getRandomGoldenSite(): GoldenSite {
  return GOLDEN_SITES[Math.floor(Math.random() * GOLDEN_SITES.length)]
}

/**
 * Get all categories with their site counts
 */
export function getGoldenSiteCategories(): Record<
  GoldenSite['category'],
  number
> {
  return GOLDEN_SITES.reduce(
    (acc, site) => {
      acc[site.category] = (acc[site.category] || 0) + 1
      return acc
    },
    {} as Record<GoldenSite['category'], number>
  )
}

/**
 * Get golden sites by expected pattern
 */
export function getGoldenSitesByPattern(
  pattern: keyof GoldenSite['expectedPatterns'],
  value: boolean | string
): GoldenSite[] {
  return GOLDEN_SITES.filter((site) => site.expectedPatterns[pattern] === value)
}
