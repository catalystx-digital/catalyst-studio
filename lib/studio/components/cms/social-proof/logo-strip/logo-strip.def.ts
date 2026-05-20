/**
 * Logo Strip Component Definition
 *
 * Row of client/partner logos with optional scrolling animation and caption.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema, SmartLinkSchema } from '../../_core/value-objects'

/**
 * Logo with additional metadata schema
 */
const LogoItemSchema = ImageSchema.extend({
  id: z.string().describe('Unique identifier for the logo'),
  href: SmartLinkSchema.optional().describe('Optional link destination for the logo (internal page or external URL)'),
  caption: z.string().optional().describe('Optional caption or tooltip text for the logo'),
})

/**
 * Logo Strip component definition
 */
export const LogoStripDef = defineComponent({
  type: ComponentType.LogoCloud,
  category: ComponentCategory.SocialProof,

  // Zod schema (single source of truth for props)
  schema: z.object({
    logos: z.array(LogoItemSchema).describe('Array of logo images with optional links and captions'),
    size: z.enum(['small', 'medium', 'large']).optional().describe('Size of the logo images'),
    animateScroll: z.boolean().optional().describe('Whether to enable automatic scrolling animation'),
    scrollSpeed: z.number().optional().describe('Scroll speed in pixels per second'),
    grayscale: z.boolean().optional().describe('Whether to display logos in grayscale'),
    caption: z.string().optional().describe('Optional caption text displayed above or below logos'),
  }),

  // Detection metadata (replaces logo-strip.ai.ts)
  detection: {
    keywords: ['logo', 'client', 'partner', 'brand', 'company', 'trust', 'featured', 'sponsors'],
    patterns: [
      'logo[\\s-]?(strip|bar|row|banner)',
      '(our[\\s-]?)?(clients?|partners?|brands?)',
      'featured[\\s-]?(in|on|by)',
      'trusted[\\s-]?by',
      'partner[\\s-]?logos?',
      'client[\\s-]?logos?',
      'sponsor[\\s-]?strip',
    ],
    commonNames: ['LogoStrip', 'ClientLogos', 'PartnerBanner', 'BrandBar', 'LogoCloud', 'TrustedBy'],
    pageLocation: ['main'],
    confidence: 0.80,
    suggestedVariants: ['default', 'minimal'],
    relatedComponents: [ComponentType.LogoCloud],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Our partners and clients',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use logo-strip for horizontal rows of partner/client logos',
    'Extract: logos from image elements with company branding',
    'Extract: size from logo dimensions (small: <80px, medium: 80-120px, large: >120px)',
    'Extract: animateScroll flag if logos scroll automatically',
    'Extract: grayscale flag if logos are displayed in monochrome',
    'Extract: caption from "Trusted by" or "Featured in" text',
    'NEVER nest logo-strip - must be top-level section',
  ],

  // Sample content for AI tools and testing
  sample: {
    logos: [
      { id: '1', src: '/logos/company-a.png', alt: 'Company A' },
      { id: '2', src: '/logos/company-b.png', alt: 'Company B', href: { type: 'external', url: 'https://companyb.com' } },
      { id: '3', src: '/logos/company-c.png', alt: 'Company C' },
    ],
    size: 'medium',
    animateScroll: false,
    scrollSpeed: 50,
    grayscale: true,
    caption: 'Trusted by industry leaders',
  },

  // Human-readable description
  description: 'Row of client/partner logos with optional scrolling animation and caption.',
})

// Export inferred TypeScript type
export type LogoStripContent = z.infer<typeof LogoStripDef.schema>
