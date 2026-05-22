/**
 * CTA Simple Component Definition
 *
 * Compact call-to-action card with headline, supporting copy, and primary action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * CTA Simple component definition
 */
export const CTASimpleDef = defineComponent({
  type: ComponentType.CTASimple,
  category: ComponentCategory.CTA,

  // Aliases for component type resolution
  aliases: [
    'cta',
    'cta-simple',
    'call-to-action',
    'cta-card',
    'action-card',
    'promo',
    'promo-block',
    'quick-exit',
    'hotline',
  ],

  // Processing rules for post-detection transformations
  processing: {
    deduplication: {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn, ComponentType.Timeline],
      context: 'adjacent',
    },
  },

  // Zod schema (single source of truth for props)
  schema: z.object({
    eyebrow: z.string().optional().describe('Optional eyebrow text displayed above the heading'),
    heading: z.string().describe('Primary call-to-action headline'),
    body: z.string().optional().describe('Supporting copy providing context or motivation'),
    primaryButton: CTAButtonSchema.describe('Primary action button'),
    secondaryButton: CTAButtonSchema.optional().describe('Optional secondary action button'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Content alignment within the card'),
    backgroundVariant: z.enum(['surface', 'accent', 'inverted']).optional().describe('Visual variant affecting background and text colors'),
  }),

  // Detection metadata (replaces cta-simple.ai.ts)
  detection: {
    keywords: ['cta', 'call to action', 'cta card', 'promo', 'action block', 'quick exit', 'hotline'],
    patterns: [
      'simple[\\s-]?cta',
      'cta[\\s-]?card',
      'call[\\s-]?to[\\s-]?action',
      'promo[\\s-]?block',
      'quick[\\s-]?exit',
      'hotline',
    ],
    commonNames: ['CTASimple', 'ActionCard', 'CallToAction'],
    pageLocation: ['header', 'main', 'sidebar'],
    confidence: 0.8,
    relatedComponents: [ComponentType.CTABanner, ComponentType.CTAButtonGroup],
  },

  // LLM extraction directives
  directives: [
    'Use for compact standalone CTAs or utility banners (e.g., quick-exit links, hotline prompts) that render outside the main content flow, including pre-header strips and header utility rows.',
    'When the strip appears above or alongside the navigation, set region="header" so it stays attached to the header stack. Header utility CTAs MUST output before the navbar component even if the DOM nests them later.',
    'When DOM shows the strip above nav/hero but the wrapper uses main tags, still force region="header" so styling stays scoped to the header stack. If no actionable button is present, emit a text-block banner in the header instead of dropping the alert.',
    'Trading-hours badges or status strips like "Shop today from 9AM" + "NOW OPEN" belong in cta-simple: capture the lead text in heading/body, include any inline badge text, and surface accompanying quick links (e.g., Getting Here) as either CTA buttons on the component or as a sibling feature-list.',
    'Always populate heading with the visible call-to-action text. When the UI is limited to a single link label, reuse that label for the heading so the component renders meaningful copy.',
    'Keep primaryButton.text/url exactly as shown; only emit a standalone CTA component when the button is visually separate from surrounding copy. Inline buttons inside two-column or text sections should stay inside that parent container.',
    'Hotline or contact snippets surfaced in header utility bars must either populate primaryButton (href=tel:...) on this component or emit a sibling cta-simple so the phone number is captured.',
  ],

  // Sample content for AI tools and testing
  sample: {
    eyebrow: 'Special Offer',
    heading: 'Start Your Free Trial',
    body: 'No credit card required. Get started in minutes.',
    primaryButton: { label: 'Try It Free', href: { type: 'internal', pageId: 'trial', path: '/trial' }, variant: 'primary' },
    secondaryButton: { label: 'See Pricing', href: { type: 'internal', pageId: 'pricing', path: '/pricing' }, variant: 'outline' },
    alignment: 'center',
    backgroundVariant: 'surface',
  },

  // Human-readable description
  description: 'Compact call-to-action card with headline, supporting copy, and primary action.',
})

// Export inferred TypeScript type
export type CTASimpleContent = z.infer<typeof CTASimpleDef.schema>
