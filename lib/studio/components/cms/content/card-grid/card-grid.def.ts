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
    'Data requirements: "cards[]" must enumerate every visible card in DOM order. Each card may only use the documented nested CardItem fields: title, description, image, href, and icon.',
    'Never leave "cards" empty when the grid displays content; populate each card with real values rather than placeholders.',
    'Never emit null for optional card fields. If a card has no icon or image, omit that field entirely.',
    'Do not add id, type, link, url, linkText, badge, metadata, actions, date, category, backgroundColor, or arbitrary wrapper fields to card-grid.cards[].',
    '*** IMAGE EXTRACTION IS MANDATORY: For EVERY card, scan the card markup for <img> tags. When found: ***',
    '  1. Extract the FULL src attribute value (convert relative URLs to absolute using the page origin)',
    '  2. Extract the alt attribute value (use empty string if missing)',
    '  3. Populate image: { "src": { "mediaId": "detected:<stable-kebab-id>", "mediaType": "image", "url": "https://full-url/path/to/image.png" }, "alt": "alt text" }',
    '  4. Check inside <a> tags, <figure> tags, and nested divs - images are often wrapped in links',
    '  5. NEVER return a card without image when an <img> tag exists in its markup',
    '  6. For CSS background-image on the card element, extract the url() value into image.src.url',
    'Image extraction examples:',
    '  - <a href="/page"><img src="/images/photo.png" alt="Photo"></a> → image: { "src": { "mediaId": "detected:photo", "mediaType": "image", "url": "https://example.com/images/photo.png" }, "alt": "Photo" }',
    '  - <div style="background-image: url(/bg.jpg)"> → image: { "src": { "mediaId": "detected:bg", "mediaType": "image", "url": "https://example.com/bg.jpg" }, "alt": "" }',
    '  - Relative src="/uploadedImages/foo.png" on https://example.com → "src.url": "https://example.com/uploadedImages/foo.png"',
    'Store the anchor destination in the documented "href" SmartLink object. If anchor text is visually hidden, derive the card title from aria-label, title, image alt, or nearby button copy.',
    'When the section exposes category or filter chips above the cards, populate "filters[]" with one object per pill in visual order. Each filter may only include label and value.',
    'Do not drop filters[] just because the chips sit outside the grid container; capture them alongside heading/subheading so downstream templates can render the full experience.',
    'Missing filters[] when the UI renders chips (e.g., "View all", "Media releases", "Advice for consumers") is a contract violation—re-fetch the section until every pill is serialized with label/value instead of relying on importer fixes.',
    'Stick to contract fields (heading, subheading, cards, columns, gap, cardStyle, imagePosition, imageAspectRatio, filters). Drop ad-hoc summary narratives that are not part of the schema.',
    'Example card payload:',
    '  "cards": [',
    '    {',
    '      "title": "Latest Offers",',
    '      "description": "Discover current promotions and centre updates.",',
    '      "image": { "src": { "mediaId": "detected:promo-banner", "mediaType": "image", "url": "https://..." }, "alt": "Promo banner" },',
    '      "href": { "type": "internal", "pageId": "offers", "path": "/offers" }',
    '    }',
    '  ]',
    'If you cannot extract card content, re-read the DOM until you can populate cards[]. Returning an empty array is incorrect.',
    'A single page may have MULTIPLE card-grid sections (e.g., quick links grid + feature cards + resources). Emit each as a separate component.',
    '*** BACKGROUND COLOR EXTRACTION: For cards with distinct background colors: ***',
    '  1. Check each card element for inline style background-color or style attribute',
    '  2. Check for CSS classes that indicate color (e.g., bg-primary, bg-red-500, card-blue)',
    '  3. If the contract does not list a backgroundColor field, do not emit it; preserve the card title/image/link content instead.',
    '  4. Convert rgb(r,g,b) to hex format: rgb(162, 38, 11) → "#a2260b"',
    '  5. Common patterns: colored navigation tiles, feature cards with brand colors',
    '  6. Example: { "title": "Your guide to the RCH", "href": { "type": "internal", "pageId": "info", "path": "/info/" } }',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Our Services',
    subheading: 'Explore what we offer to help you succeed',
    cards: [
      {
        title: 'Web Development',
        description: 'Build modern, responsive websites tailored to your needs',
        image: {
          src: { mediaId: 'sample-web-dev', mediaType: 'image', url: '/images/web-dev.jpg' },
          alt: 'Web development service preview',
          originalUrl: '/images/web-dev.jpg',
        },
        href: { type: 'internal', pageId: 'web-development-services', path: '/services/web-development' },
      },
      {
        title: 'Mobile Apps',
        description: 'Create native and cross-platform mobile applications',
        image: {
          src: { mediaId: 'sample-mobile-apps', mediaType: 'image', url: '/images/mobile.jpg' },
          alt: 'Mobile app service preview',
          originalUrl: '/images/mobile.jpg',
        },
        href: { type: 'internal', pageId: 'mobile-app-services', path: '/services/mobile-apps' },
      },
      {
        title: 'Cloud Solutions',
        description: 'Scale your infrastructure with cloud-based services',
        image: {
          src: { mediaId: 'sample-cloud-solutions', mediaType: 'image', url: '/images/cloud.jpg' },
          alt: 'Cloud solutions service preview',
          originalUrl: '/images/cloud.jpg',
        },
        href: { type: 'internal', pageId: 'cloud-services', path: '/services/cloud' },
      },
    ],
    columns: 3,
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
