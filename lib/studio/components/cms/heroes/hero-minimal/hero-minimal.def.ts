/**
 * Hero Minimal Component Definition
 *
 * Minimal hero layout with focused copy, optional CTAs, and subtle styling controls.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * Hero Minimal component definition
 */
export const HeroMinimalDef = defineComponent({
  type: ComponentType.HeroMinimal,
  category: ComponentCategory.Heroes,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().describe('Primary headline text displayed prominently'),
    subheading: z.string().optional().describe('Supporting copy shown below the headline'),
    ctaButtons: z.array(CTAButtonSchema).optional().describe('List of call-to-action buttons rendered beneath the copy'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Controls horizontal alignment of the text block'),
    backgroundPattern: z.string().optional().describe('Background pattern identifier or CSS class'),
    padding: z.enum(['small', 'medium', 'large', 'xlarge']).optional().describe('Vertical spacing around the hero content'),
    backgroundColor: z.string().optional().describe('Background color token or hex value'),
    textColor: z.string().optional().describe('Text color token or hex value'),
    maxWidth: z.enum(['small', 'medium', 'large', 'full']).optional().describe('Maximum width constraint for the content container'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'hero',
      'minimal',
      'simple',
      'centered',
      'clean',
      'text-focused',
    ],
    patterns: [
      'minimal.*hero',
      'simple.*hero',
      'centered.*hero',
      'clean.*hero',
    ],
    commonNames: [
      'minimal hero',
      'simple hero',
      'centered hero',
      'clean hero',
    ],
    pageLocation: ['hero'],
    confidence: 0.82,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [
      ComponentType.HeroBanner,
      ComponentType.HeroSplit,
      ComponentType.HeroVideo,
      ComponentType.HeroSimple,
    ],
    industry: ['general', 'portfolio', 'blog', 'personal'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Minimal hero section',
      role: 'banner',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use hero-minimal for clean, text-focused hero sections without media',
    'Extract: heading from h1/h2 tags',
    'Extract: subheading from supporting paragraph',
    'Extract: ctaButtons from buttons below heading',
    'Extract: alignment from content positioning (left/center/right)',
    'Extract: backgroundPattern from decorative background elements',
    'Extract: padding from section spacing',
    'Extract: backgroundColor and textColor from styling',
    'Extract: maxWidth from content container width',
    'NEVER nest hero components - must be top-level section',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Welcome to Our Platform',
    subheading: 'Simple, powerful, and built for you',
    ctaButtons: [
      { label: 'Get Started', href: { type: 'internal', pageId: 'signup', path: '/signup' }, variant: 'primary' },
      { label: 'Learn More', href: { type: 'internal', pageId: 'about', path: '/about' }, variant: 'outline' },
    ],
    alignment: 'center',
    padding: 'large',
    maxWidth: 'medium',
  },

  // Human-readable description
  description: 'Minimal hero layout with focused copy, optional CTAs, and subtle styling controls.',
})

// Export inferred TypeScript type
export type HeroMinimalContent = z.infer<typeof HeroMinimalDef.schema>
