/**
 * Card Grid Component Definition
 *
 * Grid of cards with images, text, metadata, and optional actions; configurable columns and layout.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CardItemSchema, FilterSchema } from '../../_core/value-objects'

/**
 * Card Grid component definition
 */
export const CardGridDef = defineComponent({
  type: ComponentType.CardGrid,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Section heading displayed above the card grid'),
    subheading: z.string().optional().describe('Supporting text displayed below the heading'),
    cards: z.array(CardItemSchema).describe('List of cards as nested components (card-item or promo-item)'),
    columns: z.number().int().min(1).max(6).optional().describe('Number of columns in the grid layout (1-6)'),
    gap: z.enum(['small', 'medium', 'large']).optional().describe('Spacing between cards'),
    cardStyle: z.enum(['vertical', 'horizontal', 'compact']).optional().describe('Visual style for card presentation'),
    imagePosition: z.enum(['top', 'left', 'right', 'background']).optional().describe('Position of the card image'),
    imageAspectRatio: z.enum(['16:9', '4:3', '1:1', '3:2']).optional().describe('Aspect ratio for card images'),
    filters: z.array(FilterSchema).optional().describe('Optional filter chips rendered with the section heading'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'card grid',
      'card layout',
      'grid cards',
      'card list',
      'feature cards',
      'product cards',
      'team cards',
      'service cards',
      'portfolio grid',
      'card gallery',
      'content cards',
      'info cards',
      'tile grid',
      'card collection',
    ],
    patterns: [
      'class.*card-grid',
      'class.*cards-container',
      'class.*grid.*card',
      'class.*card-list',
      'class.*feature-cards',
      'class.*product-grid',
      'class.*team-grid',
      'class.*portfolio',
      'data-cards',
      'card-wrapper',
      'cards-row',
      'card-deck',
    ],
    commonNames: [
      'CardGrid',
      'CardsGrid',
      'CardList',
      'FeatureCards',
      'ProductCards',
      'TeamCards',
      'ServiceCards',
      'PortfolioGrid',
      'CardGallery',
      'ContentCards',
      'GridCards',
      'TileGrid',
    ],
    pageLocation: ['main', 'hero'],
    confidence: 0.86,
    relatedComponents: [ComponentType.FeatureGrid, ComponentType.TeamGrid, ComponentType.ImageGallery],
    industry: ['general', 'ecommerce', 'portfolio', 'corporate', 'blog'],
    semanticRole: 'content-display',
    accessibility: {
      ariaLabel: 'Content Cards',
      role: 'list',
    },
  },

  // LLM extraction directives
  directives: [
    '*** DO NOT use card-grid for news feeds, blog listings, or article sections. Use content-feed instead when items are chronological, dated, or link to article detail pages. ***',
    '*** USE card-grid for: service/department cards, feature cards, resource cards, colored navigation tiles, and any static (non-chronological) content grids. ***',
    'Common use cases requiring card-grid:',
    '  - Service/department cards: "Emergency Department", "Outpatient Clinics", "Research Programs"',
    '  - Feature cards: Colorful 2x2 or 3x3 grids below hero showcasing key site sections',
    '  - Resource cards: Downloads, guides, quick links with icons/images',
    '  - Navigation tiles: Large clickable tiles linking to main site sections',
    'Data requirements: "cards[]" must enumerate every visible card in DOM order with the proper type (card-item or promo-item). Capture title, description, media (image.src + alt), link/linkText strings, badges, and metadata exactly as rendered.',
    'Never leave "cards" empty when the grid displays content; populate each card with real values rather than placeholders.',
    'Each card MUST include a stable "id" using kebab-case of the visible title prefixed with "card-item-" (e.g., "card-item-early-learning-centres"). Do not rely on importer-generated IDs.',
    '*** IMAGE EXTRACTION IS MANDATORY: For EVERY card, scan the card markup for <img> tags. When found: ***',
    '  1. Extract the FULL src attribute value (convert relative URLs to absolute using the page origin)',
    '  2. Extract the alt attribute value (use empty string if missing)',
    '  3. Populate image: { "src": "https://full-url/path/to/image.png", "alt": "alt text" }',
    '  4. Check inside <a> tags, <figure> tags, and nested divs - images are often wrapped in links',
    '  5. NEVER return a card without image when an <img> tag exists in its markup',
    '  6. For CSS background-image on the card element, extract the url() value into image.src',
    'Image extraction examples:',
    '  - <a href="/page"><img src="/images/photo.png" alt="Photo"></a> → image: { "src": "https://example.com/images/photo.png", "alt": "Photo" }',
    '  - <div style="background-image: url(/bg.jpg)"> → image: { "src": "https://example.com/bg.jpg", "alt": "" }',
    '  - Relative src="/uploadedImages/foo.png" on https://example.com → "src": "https://example.com/uploadedImages/foo.png"',
    'Flatten CTAs: store the anchor href in "link" (string) and button label in "linkText". For grids with multiple CTAs per tile, populate "actions[]" with { label, url, variant } objects. Never wrap link/linkText inside objects.',
    'If anchor text is visually hidden, derive linkText from aria-label, title, or button copy—do not omit linkText when a link exists.',
    'When the section exposes category or filter chips above the cards, populate "filters[]" with type "filter-chip" entries for every pill in visual order. Each filter must include id ("filter-chip-<slug>"), label, optional value/slug, href if clicking navigates, icon text/emoji when rendered, and isActive=true for the selected pill.',
    'Do not drop filters[] just because the chips sit outside the grid container; capture them alongside heading/subheading so downstream templates can render the full experience.',
    'Missing filters[] when the UI renders chips (e.g., "View all", "Media releases", "Advice for consumers") is a contract violation—re-fetch the section until every pill is serialized with id/label/href/isActive metadata instead of relying on importer fixes.',
    'Stick to contract fields (heading, subheading, cards, columns, gap, cardStyle, imagePosition, imageAspectRatio). Drop ad-hoc summary narratives that are not part of the schema.',
    'Example card payload:',
    '  "cards": [',
    '    {',
    '      "type": "card-item",',
    '      "title": "Latest Offers",',
    '      "description": "Discover current promotions and centre updates.",',
    '      "image": { "src": "https://...", "alt": "Promo banner" },',
    '      "link": "/offers",',
    '      "linkText": "View offers",',
    '      "metadata": { "category": "Retail" }',
    '    }',
    '  ]',
    'If you cannot extract card content, re-read the DOM until you can populate cards[]. Returning an empty array is incorrect.',
    'A single page may have MULTIPLE card-grid sections (e.g., quick links grid + feature cards + resources). Emit each as a separate component.',
    '*** BACKGROUND COLOR EXTRACTION: For cards with distinct background colors: ***',
    '  1. Check each card element for inline style background-color or style attribute',
    '  2. Check for CSS classes that indicate color (e.g., bg-primary, bg-red-500, card-blue)',
    '  3. When a card has a visible background color, add: "backgroundColor": "#hexvalue"',
    '  4. Convert rgb(r,g,b) to hex format: rgb(162, 38, 11) → "#a2260b"',
    '  5. Common patterns: colored navigation tiles, feature cards with brand colors',
    '  6. Example: { "type": "card-item", "title": "Your guide to the RCH", "backgroundColor": "#a2260b", "link": "/info/" }',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Our Services',
    subheading: 'Explore what we offer to help you succeed',
    cards: [
      {
        title: 'Web Development',
        description: 'Build modern, responsive websites tailored to your needs',
        image: '/images/web-dev.jpg',
        href: { type: 'internal', pageId: 'web-development-services' },
      },
      {
        title: 'Mobile Apps',
        description: 'Create native and cross-platform mobile applications',
        image: '/images/mobile.jpg',
        href: { type: 'internal', pageId: 'mobile-app-services' },
      },
      {
        title: 'Cloud Solutions',
        description: 'Scale your infrastructure with cloud-based services',
        image: '/images/cloud.jpg',
        href: { type: 'internal', pageId: 'cloud-services' },
      },
    ],
    columns: '3',
    gap: 'medium',
    cardStyle: 'vertical',
    imagePosition: 'top',
    imageAspectRatio: '16:9',
  },

  // Human-readable description
  description: 'Grid of cards with images, text, metadata, and optional actions; configurable columns and layout.',
})

// Export inferred TypeScript type
export type CardGridContent = z.infer<typeof CardGridDef.schema>
