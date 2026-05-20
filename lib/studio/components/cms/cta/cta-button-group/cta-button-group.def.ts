/**
 * CTA Button Group Component Definition
 *
 * Group of call-to-action buttons with alignment, orientation, and spacing controls.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * CTA Button Group component definition
 */
export const CTAButtonGroupDef = defineComponent({
  type: ComponentType.CTAButtonGroup,
  category: ComponentCategory.CTA,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Optional heading above the button group'),
    subheading: z.string().optional().describe('Optional subheading providing context'),
    buttons: z.array(CTAButtonSchema).describe('Array of call-to-action buttons to display'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Horizontal alignment of the button group'),
    orientation: z.enum(['horizontal', 'vertical']).optional().describe('Layout direction for buttons'),
    spacing: z.enum(['tight', 'normal', 'loose']).optional().describe('Gap between buttons'),
    fullWidthOnMobile: z.boolean().optional().describe('Whether buttons should span full width on mobile devices'),
  }),

  // Detection metadata (replaces cta-button-group.ai.ts)
  detection: {
    keywords: ['buttons', 'actions', 'button group', 'cta buttons', 'action buttons'],
    patterns: [
      'button[\\s-]?group',
      'action[\\s-]?buttons',
      'cta[\\s-]?buttons',
      'multiple[\\s-]?actions',
    ],
    commonNames: ['ButtonGroup', 'CTAButtonGroup', 'ActionButtons'],
    pageLocation: ['main', 'hero'],
    confidence: 0.75,
    relatedComponents: [ComponentType.CTASimple, ComponentType.CTABanner],
  },

  // LLM extraction directives
  directives: [
    '*** Use cta-button-group for rows of 3-5 prominent navigation buttons/tiles that appear immediately below the hero. ***',
    'Common patterns: Quick links bar, action buttons row, primary navigation tiles (e.g., "I need help now", "Visit & Support", "Make a Donation", "Patient Information").',
    'Data requirements: Populate buttons[] array with each button including text, url, and variant. Preserve the exact button labels and link destinations.',
    '*** BUTTON BACKGROUND COLOR EXTRACTION: For buttons with distinct background colors: ***',
    '  1. Check each button element for inline style background-color or style attribute',
    '  2. Check for CSS classes that indicate color (e.g., bg-primary, bg-red-500)',
    '  3. When a button has a visible background color different from the default, add: "backgroundColor": "#hexvalue"',
    '  4. Convert rgb(r,g,b) to hex format: rgb(162, 38, 11) → "#a2260b"',
    '  5. Common patterns: colored CTA buttons, emergency buttons (red), donation buttons (green), info buttons (blue)',
    '  6. Example: { "text": "I need help now", "url": "/emergency", "variant": "primary", "backgroundColor": "#dc2626" }',
    'Do NOT confuse with card-grid: cta-button-group is for button-style links in a single row; card-grid is for larger cards with images/descriptions.',
    'Example payload:',
    '  {',
    '    "heading": "Quick Links",',
    '    "buttons": [',
    '      { "text": "I need help now", "url": "/emergency", "variant": "danger", "backgroundColor": "#dc2626" },',
    '      { "text": "Visit & Support", "url": "/visit", "variant": "primary", "backgroundColor": "#2563eb" },',
    '      { "text": "Make a Donation", "url": "/donate", "variant": "secondary", "backgroundColor": "#16a34a" },',
    '      { "text": "Patient Info", "url": "/patients", "variant": "outline" }',
    '    ],',
    '    "alignment": "center",',
    '    "orientation": "horizontal"',
    '  }',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Choose Your Action',
    buttons: [
      { label: 'Get Started', href: '/signup', variant: 'primary' },
      { label: 'Learn More', href: '/features', variant: 'outline' },
      { label: 'Contact Us', href: '/contact', variant: 'secondary' },
    ],
    alignment: 'center',
    orientation: 'horizontal',
    spacing: 'normal',
    fullWidthOnMobile: true,
  },

  // Human-readable description
  description: 'Group of call-to-action buttons with alignment, orientation, and spacing controls.',
})

// Export inferred TypeScript type
export type CTAButtonGroupContent = z.infer<typeof CTAButtonGroupDef.schema>
