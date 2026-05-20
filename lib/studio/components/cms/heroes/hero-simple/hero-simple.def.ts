/**
 * Hero Simple Component Definition
 *
 * Compact hero layout with headline, supporting copy, and primary call to action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema, LinkSchema, ImageSchema } from '../../_core/value-objects'

/**
 * Background configuration schema
 */
const HeroSimpleBackgroundSchema = z.object({
  color: z.string().optional().describe('Background color'),
  gradient: z.string().optional().describe('CSS gradient background'),
  image: ImageSchema.nullable().optional().describe('Background image'),
  overlayColor: z.string().optional().describe('Overlay color for image backgrounds'),
  overlayOpacity: z.number().optional().describe('Overlay opacity (0-1)'),
})

/**
 * Hero height options for viewport sizing
 */
const HeroHeightSchema = z.enum(['small', 'medium', 'large', 'full']).describe(
  'Hero height: small=50-60vh, medium=60-80vh (default), large=75-90vh, full=100vh (full viewport). Homepage heroes should use "full".'
)

/**
 * Hero Simple component definition
 */
export const HeroSimpleDef = defineComponent({
  type: ComponentType.HeroSimple,
  category: ComponentCategory.Heroes,

  // Aliases for component type resolution
  aliases: [
    'hero',
    'hero-simple',
    'hero-section',
    'simple-hero',
    'compact-hero',
    'landing-hero',
    'headline-hero',
  ],

  // Processing rules for post-detection transformations
  processing: {
    backgroundPromotion: {
      enabled: true,
      domSelectors: ['banner-wrap', 'banner-wrap-mobile', 'hero-bg', 'hero-background'],
    },
  },

  // Zod schema (single source of truth for props)
  schema: z.object({
    eyebrow: z.string().optional().describe('Optional eyebrow text displayed above the heading'),
    heading: z.string().describe('Primary headline introducing the page or campaign'),
    subheading: z.string().optional().describe('Supporting statement reinforcing the main headline'),
    body: z.string().optional().describe('Additional descriptive copy shown below the subheading'),
    ctaButtons: z.array(CTAButtonSchema).optional().describe('List of call-to-action buttons displayed beneath the copy'),
    supportingLinks: z.array(LinkSchema).optional().describe('Secondary text links rendered after the primary CTAs for supplemental actions'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Controls horizontal alignment for hero content and call-to-actions'),
    background: HeroSimpleBackgroundSchema.optional().describe('Background presentation settings including colors, gradients, and optional imagery'),
    height: HeroHeightSchema.optional().describe('Hero height setting. Homepage heroes should use "full" for immersive impact.'),
  }),

  // Detection metadata (replaces hero-simple.ai.ts)
  detection: {
    keywords: [
      'hero',
      'simple hero',
      'compact hero',
      'landing hero',
      'headline hero',
      'banner',
    ],
    patterns: [
      'hero.*simple',
      'compact.*hero',
      'landing.*hero',
      'hero.*headline',
      'banner.*hero',
    ],
    commonNames: [
      'simple hero',
      'headline hero',
      'landing hero',
      'marketing hero',
    ],
    pageLocation: ['hero'],
    confidence: 0.9,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [
      ComponentType.HeroBanner,
      ComponentType.HeroSplit,
      ComponentType.HeroWithImage,
      ComponentType.HeroMinimal,
    ],
    industry: ['general', 'marketing', 'saas', 'public-sector'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Page hero section',
      role: 'banner',
    },
  },

  // LLM extraction directives
  directives: [
    'Use hero-simple ONLY for actual hero sections with visual prominence (background color/image, large text).',
    '',
    'Do NOT use hero-simple for:',
    '  - Content page titles (use html-block instead)',
    '  - Article/blog post headings (use blog-post instead)',
    '  - Simple H1 headings followed by prose content',
    '  - Pages with sidebar navigation (those are content pages)',
    '',
    'If you see sidebar + H1 + paragraphs → that is a content page, use html-block, NOT hero-simple.',
  ],

  // Sample content for AI tools and testing
  sample: {
    eyebrow: 'Welcome to',
    heading: 'Transform Your Digital Experience',
    subheading: 'Our platform helps businesses succeed in the modern digital landscape',
    body: 'Join thousands of companies already growing with our solution',
    ctaButtons: [
      { label: 'Get Started', href: '/signup', variant: 'primary' },
      { label: 'Learn More', href: '/about', variant: 'outline' },
    ],
    supportingLinks: [
      { label: 'View Demo', href: '/demo' },
      { label: 'Contact Sales', href: '/contact' },
    ],
    alignment: 'center',
    height: 'full',
    background: {
      gradient: 'linear-gradient(to right, #667eea 0%, #764ba2 100%)',
      overlayColor: '#000000',
      overlayOpacity: 0.3,
    },
  },

  // Human-readable description
  description: 'Compact hero with headline, supporting copy, and primary calls-to-action for quick conversions.',
})

// Export inferred TypeScript type
export type HeroSimpleContent = z.infer<typeof HeroSimpleDef.schema>
