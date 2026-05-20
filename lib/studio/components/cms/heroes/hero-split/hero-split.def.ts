/**
 * Hero Split Component Definition
 *
 * Hero section with split layout: text on one side and media (image/video/embed) on the other.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema, MediaReferenceSchema } from '../../_core/value-objects'

/**
 * Media configuration schema
 */
const MediaSchema = z.object({
  type: z.enum(['image', 'video', 'embed']),
  src: MediaReferenceSchema,
  alt: z.string().optional(),
  poster: MediaReferenceSchema.optional(),
}).optional()

/**
 * Hero Split component definition
 */
export const HeroSplitDef = defineComponent({
  type: ComponentType.HeroSplit,
  category: ComponentCategory.Heroes,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().describe('Primary headline text'),
    subheading: z.string().optional().describe('Supporting statement'),
    body: z.string().optional().describe('Additional descriptive copy'),
    media: MediaSchema.describe('Media content (image, video, or embed)'),
    mediaPosition: z.enum(['left', 'right']).optional().describe('Which side the media appears on'),
    splitRatio: z.enum(['50-50', '60-40', '40-60']).optional().describe('Content to media ratio'),
    ctaButtons: z.array(CTAButtonSchema).optional().describe('Call-to-action buttons'),
    verticalAlign: z.enum(['top', 'center', 'bottom']).optional().describe('Vertical alignment of content'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'hero',
      'split',
      'two-column',
      'side-by-side',
      'image',
      'content',
    ],
    patterns: [
      'split.*hero',
      'two.*column.*hero',
      'hero.*with.*image',
      'side.*by.*side',
    ],
    commonNames: [
      'split hero',
      'two-column hero',
      'hero with image',
      'side-by-side layout',
    ],
    pageLocation: ['hero'],
    confidence: 0.85,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [
      ComponentType.HeroBanner,
      ComponentType.HeroMinimal,
      ComponentType.HeroVideo,
    ],
    industry: ['general', 'saas', 'technology', 'product'],
    semanticRole: 'banner',
    accessibility: {
      role: 'banner',
      ariaLabel: 'Split hero section',
    },
  },

  // LLM extraction directives
  directives: [
    'Canonical output must use hero-with-image for split hero layouts. When you encounter a two-column hero with copy and media, return type "hero-with-image" and map media positioning via layout ("image-left" or "image-right"). Do NOT respond with hero-split.',
    'Apply hero-with-image rules: include eyebrow, heading, subheading, body, image.src + alt, layout, theme, and ctaButtons[] with variant (primary|secondary|outline). Legacy keys like "style" must be omitted.',
    'If the source markup labels the component as hero-split, still convert it to hero-with-image so downstream contracts stay aligned.',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Design That Speaks to Your Audience',
    subheading: 'Create beautiful, responsive websites without writing code',
    body: 'Our intuitive visual editor makes it easy to build professional websites that convert visitors into customers.',
    media: {
      type: 'image',
      src: { mediaId: 'sample-hero-split', mediaType: 'image', url: '/images/hero-split.jpg' },
      alt: 'Website builder interface',
    },
    mediaPosition: 'right',
    splitRatio: '50-50',
    ctaButtons: [
      { label: 'Start Building', href: '/signup', variant: 'primary' },
      { label: 'View Templates', href: '/templates', variant: 'outline' },
    ],
    verticalAlign: 'center',
  },

  // Human-readable description
  description: 'Hero section with split layout: text on one side and media (image/video/embed) on the other.',
})

// Export inferred TypeScript type
export type HeroSplitContent = z.infer<typeof HeroSplitDef.schema>
