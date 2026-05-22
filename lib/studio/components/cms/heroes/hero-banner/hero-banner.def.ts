/**
 * Hero Banner Component Definition
 *
 * Prominent top-of-page section featuring a primary message, background media, and optional CTAs.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * Overlay configuration schema
 */
const OverlaySchema = z.object({
  enabled: z.boolean(),
  color: z.string().optional(),
  opacity: z.number().optional(),
  gradient: z.string().optional(),
}).optional()

/**
 * Hero Banner component definition
 */
export const HeroBannerDef = defineComponent({
  type: ComponentType.HeroBanner,
  category: ComponentCategory.Heroes,

  // Aliases for component type resolution
  aliases: [
    'hero-banner',
    'banner',
    'jumbotron',
    'masthead',
    'splash',
    'hero-image',
    'image-hero',
  ],

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().describe('Primary headline text'),
    subheading: z.string().optional().describe('Secondary supporting text'),
    body: z.string().optional().describe('Longer descriptive copy'),
    backgroundImage: z.string().describe('Hero background image URL (required for banner)'),
    overlay: OverlaySchema.describe('Background overlay settings'),
    ctaButtons: z.array(CTAButtonSchema).optional().describe('Buttons with labels and links'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Content alignment'),
    parallax: z.boolean().optional().describe('Enable parallax scrolling effect'),
    height: z.enum(['small', 'medium', 'large', 'full']).optional().describe('Hero section height'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'hero',
      'banner',
      'hero-banner',
      'jumbotron',
      'masthead',
      'splash',
    ],
    patterns: [
      'hero.*banner',
      'jumbotron',
      'masthead',
      'splash',
    ],
    commonNames: [
      'hero banner',
      'jumbotron',
      'masthead',
      'splash section',
      'hero section',
    ],
    pageLocation: ['hero'],
    confidence: 0.90,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    relatedComponents: [
      ComponentType.HeroSimple,
      ComponentType.HeroSplit,
      ComponentType.HeroVideo,
    ],
    industry: ['general', 'marketing', 'corporate', 'startup'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Hero banner section',
      role: 'banner',
    },
  },

  // LLM extraction directives
  directives: [
    'Use hero-banner for homepage hero sections with background images and CTA buttons.',
    '',
    'Do NOT use hero-banner for:',
    '  - Article/content page titles (use html-block or blog-post instead)',
    '  - Simple H1 headings without background images or CTAs',
    '  - Pages with sidebar navigation (those are content pages, not hero pages)',
    '',
    'Data requirements: Extract heading (primary headline), subheading (secondary text), and body (descriptive copy) from the hero section.',
    'backgroundImage is REQUIRED - use searchImages tool to find an appropriate image. If no image needed, use hero-simple instead.',
    'For overlay styling, populate overlay with { enabled, color, opacity, gradient } based on visible effects.',
    'ctaButtons[] must include every visible CTA with { label, href, variant }. Use variant values: primary, secondary, outline.',
    'Set alignment to "left", "center", or "right" based on text positioning.',
    'Set height to "small", "medium", "large", or "full" based on the hero size.',
    'Do NOT add fields not in the contract: eyebrow, region, metadata are NOT valid fields for hero-banner.',
    'If you need to capture a kicker/eyebrow text, include it at the start of the heading or subheading.',
    'Example payload:',
    '  {',
    '    "heading": "Welcome to Our Centre",',
    '    "subheading": "Discover what makes us special",',
    '    "body": "Experience world-class shopping, dining, and entertainment.",',
    '    "backgroundImage": "https://example.com/hero.jpg",',
    '    "overlay": { "enabled": true, "color": "#000000", "opacity": 0.4 },',
    '    "ctaButtons": [{ "label": "Explore Now", "href": "/explore", "variant": "primary" }],',
    '    "alignment": "center",',
    '    "height": "large"',
    '  }',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Build Better Websites Faster',
    subheading: 'The all-in-one platform for modern web development',
    body: 'Create stunning, performant websites with our powerful CMS and design tools',
    backgroundImage: '/images/hero-background.jpg',
    overlay: {
      enabled: true,
      color: '#000000',
      opacity: 0.5,
    },
    ctaButtons: [
      { label: 'Get Started Free', href: { type: 'internal', pageId: 'signup', path: '/signup' }, variant: 'primary' },
      { label: 'Watch Demo', href: { type: 'internal', pageId: 'demo', path: '/demo' }, variant: 'outline' },
    ],
    alignment: 'center',
    parallax: false,
    height: 'large',
  },

  // Human-readable description
  description: 'Prominent top-of-page section featuring a primary message, background media, and optional call-to-action buttons.',
})

// Export inferred TypeScript type
export type HeroBannerContent = z.infer<typeof HeroBannerDef.schema>
