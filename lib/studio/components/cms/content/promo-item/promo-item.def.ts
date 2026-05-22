/**
 * Promo Item Component Definition
 *
 * Promotional item with headline, body, media, and call-to-action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema, ImageSchema } from '../../_core/value-objects'

/**
 * Promo Item component definition
 */
export const PromoItemDef = defineComponent({
  type: ComponentType.PromoItem,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    headline: z.string().describe('Promotional headline or main message'),
    body: z.string().optional().describe('Supporting description or promotional copy'),
    image: ImageSchema.optional().describe('Promotional image with alt text and metadata'),
    imageAlt: z.string().optional().describe('Alternative text for promotional image'),
    cta: CTAButtonSchema.optional().describe('Call-to-action button with label, URL, and variant'),
    ribbon: z.string().optional().describe('Ribbon or banner text (e.g., "Sale", "Limited Time")'),
    price: z.string().optional().describe('Price display for promotional offers'),
    tag: z.string().optional().describe('Tag or label for categorization'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'promo',
      'promotion',
      'promotional',
      'offer',
      'deal',
      'sale',
      'special',
      'featured',
      'highlight',
      'product promo',
      'marketing promo',
    ],
    patterns: [
      'class.*promo',
      'class.*promotion',
      'class.*offer',
      'class.*deal',
      'class.*sale',
      'data-promo',
      'promo-item',
      'promotional',
    ],
    commonNames: [
      'PromoItem',
      'Promotion',
      'Promo',
      'OfferCard',
      'DealCard',
      'SaleItem',
      'FeaturedPromo',
      'MarketingPromo',
    ],
    pageLocation: ['main', 'hero', 'sidebar'],
    confidence: 0.87,
    relatedComponents: [ComponentType.CardItem, ComponentType.CardGrid, ComponentType.CTASimple],
    industry: ['ecommerce', 'marketing', 'retail', 'services'],
    semanticRole: 'content-display',
    accessibility: {
      ariaLabel: 'Promotional item',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use promo-item for promotional content, sales, offers, or featured products',
    'Extract: headline from promotional heading or offer title',
    'Extract: body from promotional description or offer details',
    'Extract: image from promotional image or product photo',
    'Extract: cta from call-to-action button (label, URL, variant)',
    'Extract: ribbon from "Sale", "New", "Limited Time" badges',
    'Extract: price from price display or discount information',
    'Extract: tag from category or promotional tag',
    'NEVER use as standalone - should be nested within card-grid or promo section',
    'Ideal for sales promotions, featured products, special offers',
    'Data requirements: Provide id, headline, body, ribbon/tag, price (if visible), image (src + alt), metadata (category/date/tags), and CTA captured under actions[] with label/url/variant.',
    'Generate ids using kebab-case of headline prefixed with "promo-item-".',
    'Flatten CTA hyperlinks into actions[]. Avoid legacy fields like ctaUrl/ctaLabel—emit the canonical structure directly.',
  ],

  // Sample content for AI tools and testing
  sample: {
    headline: 'Limited Time Offer',
    body: 'Save 30% on all studio plans this week only',
    image: {
      src: { mediaId: 'sample-promo-studio', mediaType: 'image', url: '/images/promo-studio.jpg' },
      alt: 'Studio plan promotion',
      originalUrl: '/images/promo-studio.jpg',
    },
    imageAlt: 'Studio plan promotion',
    cta: {
      label: 'Claim Offer',
      href: { type: 'internal', pageId: 'pricing', path: '/pricing?promo=30off' },
      variant: 'primary',
    },
    ribbon: 'Save 30%',
    price: '$69/month',
    tag: 'Limited Time',
  },

  // Human-readable description
  description: 'Promotional item with headline, body, media, and call-to-action.',
})

// Export inferred TypeScript type
export type PromoItemContent = z.infer<typeof PromoItemDef.schema>
