/**
 * Card Item Component Definition
 *
 * Basic card item with title, description, optional media and actions.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema, SmartLinkSchema } from '../../_core/value-objects'

/**
 * Card metadata schema
 */
const CardMetadataSchema = z.object({
  author: z.string().optional().describe('Author name'),
  date: z.string().optional().describe('Publication date'),
  category: z.string().optional().describe('Content category'),
  tags: z.array(z.string()).optional().describe('Associated tags'),
})

/**
 * Card action schema
 */
const CardActionSchema = z.object({
  label: z.string().describe('Action button label'),
  href: SmartLinkSchema.describe('Action destination (internal page or external URL)'),
  variant: z.enum(['primary', 'secondary', 'outline']).optional().describe('Button visual variant'),
})

/**
 * Card Item component definition
 */
export const CardItemDef = defineComponent({
  type: ComponentType.CardItem,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().describe('Card title or heading'),
    description: z.string().optional().describe('Card body text or description'),
    image: ImageSchema.optional().describe('Card image with alt text and metadata'),
    imageAlt: z.string().optional().describe('Alternative text for card image'),
    href: SmartLinkSchema.optional().describe('Card link destination (internal page or external URL)'),
    linkText: z.string().optional().describe('Card link label text'),
    badge: z.string().optional().describe('Badge or label displayed on the card'),
    icon: z.string().optional().describe('Icon displayed with the card'),
    metadata: CardMetadataSchema.optional().describe('Additional metadata (author, date, category, tags)'),
    actions: z.array(CardActionSchema).optional().describe('Action buttons displayed on the card'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'card',
      'card item',
      'content card',
      'info card',
      'feature card',
      'product card',
      'article card',
      'blog card',
      'tile',
    ],
    patterns: [
      'class.*card',
      'class.*card-item',
      'class.*content-card',
      'data-card',
      'card-wrapper',
    ],
    commonNames: [
      'Card',
      'CardItem',
      'ContentCard',
      'InfoCard',
      'FeatureCard',
      'ProductCard',
      'ArticleCard',
    ],
    pageLocation: ['main'],
    confidence: 0.85,
    relatedComponents: [ComponentType.CardGrid, ComponentType.PromoItem],
    industry: ['general', 'ecommerce', 'blog', 'corporate'],
    semanticRole: 'content-display',
    accessibility: {
      ariaLabel: 'Content card',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use card-item for individual cards within card-grid components',
    'Extract: title from card heading',
    'Extract: description from card body text',
    'Extract: image from card image element',
    'Extract: link from card click target or primary action',
    'Extract: badge from label or tag displayed on card',
    'Extract: metadata from author, date, category information',
    'Extract: actions from button elements within card',
    'Use card-item only where the selected component contract explicitly accepts this richer card-item shape. Do not assume card-grid.cards[] accepts standalone card-item fields.',
    'Data requirements: Each card-item must include title, description (if present), image (src MediaReference object + alt) mapped to image/imageAlt, href as a structured SmartLink object, linkText (anchor label), badge/icon when shown, and metadata (author/date/category/tags) when visibly rendered.',
    'Do not emit id, type, link, url, or arbitrary wrapper fields on card-item content. These fields are not in the CardItem contract.',
    'Descriptions must contain the full body text rendered on the card—convert inline HTML to plain text without trimming sentences or dropping trailing clauses.',
    'Capture badge/category/date metadata exactly as it appears (e.g., "Latest news", "12 Jun 2024") and store it on the card so downstream filters stay accurate.',
    'Flatten primary CTA anchors into href/linkText. Secondary CTAs belong in actions[] with { label, href, variant } objects using structured SmartLink href and variant names (primary/secondary/outline).',
    'When a primary link is present, populate href as a SmartLink and linkText from anchor text, aria-label, or nearby visible CTA copy.',
    'Do not emit placeholder summaries—only include fields rendered in the DOM.',
    'Ellipses ("...") or bare "Read more" labels without the surrounding summary text fail the completeness check—fetch the section again if you cannot capture the full description.',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Getting Started Guide',
    description: 'Learn the basics of our platform in just 10 minutes',
    image: {
      src: { mediaId: 'sample-guide-thumbnail', mediaType: 'image', url: '/images/guide-thumbnail.jpg' },
      alt: 'Getting started guide thumbnail',
      originalUrl: '/images/guide-thumbnail.jpg',
    },
    imageAlt: 'Getting started guide thumbnail',
    href: { type: 'internal', pageId: 'getting-started-guide', path: '/guides/getting-started' },
    linkText: 'Read Guide',
    badge: 'New',
    metadata: {
      author: 'John Doe',
      date: '2025-12-15',
      category: 'Documentation',
      tags: ['tutorial', 'beginner'],
    },
    actions: [
      { label: 'Read More', href: { type: 'internal', pageId: 'getting-started-guide', path: '/guides/getting-started' }, variant: 'primary' },
    ],
  },

  // Human-readable description
  description: 'Basic card item with title, description, optional media and actions.',
})

// Export inferred TypeScript type
export type CardItemContent = z.infer<typeof CardItemDef.schema>
