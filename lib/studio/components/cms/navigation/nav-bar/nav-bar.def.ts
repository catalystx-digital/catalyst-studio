/**
 * NavBar Component Definition
 *
 * Primary site navigation with brand logo, hierarchical menu items, and optional call-to-action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { LogoSchema, CTAButtonSchema, MenuItemSchema, NavBarSearchSchema } from '../../_core/value-objects'

const NavBarRowStyleSchema = z.object({
  backgroundColor: z.string().optional().describe('Source-captured row background color, preferably a hex, rgb(), hsl(), or CSS variable value'),
  textColor: z.string().optional().describe('Source-captured row foreground/text color'),
  borderColor: z.string().optional().describe('Source-captured row separator/border color'),
})

const NavBarItemStyleSchema = NavBarRowStyleSchema.extend({
  label: z.string().describe('Menu item label this style belongs to'),
})

const NavBarStylesSchema = z.object({
  utilityRow: NavBarRowStyleSchema.optional().describe('Styles for the logo/utility/CTA row in multi-row headers'),
  primaryRow: NavBarRowStyleSchema.optional().describe('Styles for the primary category/audience row in multi-row headers'),
  primaryItems: z.array(NavBarItemStyleSchema).optional().describe('Source-captured styles for individual primary nav items'),
})

/**
 * NavBar component definition
 */
export const NavBarDef = defineComponent({
  type: ComponentType.NavBar,
  category: ComponentCategory.Navigation,

  // Aliases for component type resolution
  aliases: [
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

  // Processing rules for post-detection transformations
  processing: {
    multiRowDetection: {
      enabled: true,
      utilityPatterns: [
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
        'checkout',
      ],
    },
  },

  // Zod schema (single source of truth for props)
  schema: z.object({
    logo: LogoSchema.optional().describe('Logo configuration including image source, alt text, and optional fallback text'),
    utilityNav: z.array(MenuItemSchema).optional().describe('Utility navigation items displayed in a secondary row above the main nav (Home, About, News, Careers, etc.)'),
    menuItems: z.array(MenuItemSchema).describe('Primary navigation items managed as nested nav-menu-item subcomponents'),
    cta: CTAButtonSchema.optional().describe('Optional call-to-action button displayed alongside the menu'),
    search: NavBarSearchSchema.optional().describe('Search functionality configuration'),
    styles: NavBarStylesSchema.optional().describe('Source-captured row styles for imported navigation layouts'),
    mobileBreakpoint: z.number().optional().describe('Viewport width (px) at which the mobile menu activates'),
    sticky: z.boolean().optional().describe('Fix the navbar to the top of the viewport on scroll'),
    transparent: z.boolean().optional().describe('Render the navbar with an initial transparent background'),
    layout: z.enum(['single-row', 'multi-row']).optional().describe("Layout mode: 'single-row' for all items in one row, 'multi-row' for utility nav above main nav"),
  }),

  // Detection metadata
  detection: {
    keywords: ['navigation', 'navbar', 'header', 'menu', 'nav', 'top bar'],
    patterns: ['nav(?:bar|igation)?', 'menu', 'header', 'top.*bar'],
    commonNames: ['navigation bar', 'nav bar', 'header', 'main menu', 'top menu'],
    pageLocation: ['header'],
    confidence: 0.95,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    semanticRole: 'navigation',
    accessibility: {
      role: 'navigation',
      ariaLabel: 'Main navigation',
    },
  },

  // LLM extraction directives
  directives: [
    'Capture header utility content that ships with the navigation stack. Phone numbers, hotlines, or emergency CTAs rendered above the primary menu must be preserved either via the navbar CTA slot or as adjacent cta-simple/text-block components—never drop the contact snippet.',
    'When a tel: link or secondary CTA appears alongside the logo/search row, emit a sibling cta-simple ahead of the hero so the ordering matches the visual header.',
    'Multi-row headers must be serialized row-by-row: emit the trading-hours/status strip as cta-simple, the icon-based quick links as feature-list or nav menu items, and keep the primary category bar inside navbar.menuItems. Preserve search icons/buttons that live in the header so users can navigate the same way they can on the live site.',
    'Do not merge structurally distinct header bars (quick exit strips, search utilities, contact hotlines) into navbar copy when they occupy separate rows; keep them as ordered sibling components with accurate regions, and ensure navbar.menuItems includes every category entry ("Visit", "Stores", "Community", etc.) in DOM order in addition to any quick-link set the LLM surfaces.',
    'menuItems is required. Always emit menuItems as an array. Populate every visible primary navigation link in DOM order; if no primary navigation links exist after fetching the header, emit menuItems: [] rather than omitting the field.',
    'Logos must return logo.src as a MediaReference object ({ mediaId, mediaType: "image", url }) and logo.originalUrl as an absolute URL, plus alt/href metadata. logo.href is a plain string URL/path, not a SmartLink object. When the DOM supplies only a relative path, resolve it before populating src.url/originalUrl; missing originalUrl requires re-fetching the header.',
    'Navbar CTA variant must be one of the CTAButton contract values (primary, secondary, outline). Do not copy CSS class names such as "btn btn-skin-2" into variant; map prominent filled CTAs to primary, alternate filled CTAs to secondary, outlined/ghost CTAs to outline, or omit variant if uncertain.',
    'For multi-row headers, capture actual computed row colors when available. Put the logo/utility row colors in styles.utilityRow, the primary/category row colors in styles.primaryRow, and per-link category colors in styles.primaryItems[]. Use backgroundColor, textColor, and borderColor with source CSS values such as "#6f8434", "rgb(111, 132, 52)", or "hsl(...)". Do not invent colors.',
    'SEARCH DETECTION: When a search icon, search input, or search button appears in the header/navbar, set search.enabled=true. Extract search.placeholder from the input placeholder attribute verbatim (including punctuation). If suggestions or recent searches are visible, set search.showSuggestions=true and populate search.suggestions[] with { text, category?, url? } for each item. Extract search.action from the form action URL if detectable.',
    'Do NOT emit a separate search-bar component—search functionality is part of navbar. Example search payload:',
    '  "search": {',
    '    "enabled": true,',
    '    "placeholder": "Search...",',
    '    "showSuggestions": true,',
    '    "suggestions": [{ "text": "Find a school", "url": "/schools" }]',
    '  }',
  ],

  // Sample content for AI tools and testing
  // NOTE: menuItems should only reference pages that actually exist in the site structure
  sample: {
    logo: {
      src: { mediaId: 'sample-logo', mediaType: 'image', url: '/logo.svg' },
      alt: 'Company Logo',
      text: 'Company Name',
      href: '/',
      width: 120,
      height: 40,
    },
    // Example structure only - actual items should match site pages
    menuItems: [
      { label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } },
      { label: 'About', href: { type: 'internal', pageId: 'about', path: '/about' } },
      { label: 'Contact', href: { type: 'internal', pageId: 'contact', path: '/contact' } },
    ],
    cta: {
      label: 'Get Started',
      href: { type: 'internal', pageId: 'signup', path: '/signup' },
      variant: 'primary',
    },
    search: {
      enabled: true,
      placeholder: 'Search...',
      showSuggestions: true,
    },
    sticky: true,
    layout: 'single-row',
  },

  // Human-readable description
  description: 'Primary site navigation with brand logo, hierarchical menu items, and optional call-to-action.',
})

// Export inferred TypeScript type
export type NavBarContent = z.infer<typeof NavBarDef.schema>
