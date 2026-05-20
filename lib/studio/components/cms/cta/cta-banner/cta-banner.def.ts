/**
 * CTA Banner Component Definition
 *
 * Full-width call-to-action section with headline and primary/secondary buttons.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * CTA Banner component definition
 */
export const CTABannerDef = defineComponent({
  type: ComponentType.CTABanner,
  category: ComponentCategory.CTA,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().describe('Primary call-to-action headline'),
    subheading: z.string().optional().describe('Supporting text reinforcing the main message'),
    primaryButton: CTAButtonSchema.describe('Primary action button'),
    secondaryButton: CTAButtonSchema.optional().describe('Optional secondary action button'),
    backgroundColor: z.string().optional().describe('Background color for the banner section'),
    backgroundImage: z.string().optional().describe('Background image URL for visual impact'),
    textColor: z.string().optional().describe('Text color override for custom backgrounds'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Content alignment within the banner'),
    fullWidth: z.boolean().optional().describe('Whether to render at full viewport width without container constraints'),
  }),

  // Detection metadata (replaces cta-banner.ai.ts)
  detection: {
    keywords: ['cta', 'call to action', 'banner', 'action section', 'get started', 'sign up'],
    patterns: [
      'call[\\s-]?to[\\s-]?action',
      'cta[\\s-]?banner',
      'action[\\s-]?section',
      'get[\\s-]?started',
      'sign[\\s-]?up[\\s-]?now',
    ],
    commonNames: ['CTABanner', 'CallToAction', 'ActionBanner'],
    pageLocation: ['main', 'footer'],
    confidence: 0.85,
    relatedComponents: [ComponentType.CTAWithForm, ComponentType.CTASimple],
  },

  // LLM extraction directives
  directives: [
    '*** Use cta-banner for TEXT-ONLY full-width CTA sections AND section title banners WITHOUT prominent images. ***',
    '*** CRITICAL DISTINCTION: If the banner section contains a PROMINENT IMAGE (<img> tag or CSS background-image), use hero-with-image instead. ***',
    '*** cta-banner is for text-focused sections: headings, subheadings, and CTA buttons WITHOUT large imagery. ***',
    '',
    'Common patterns requiring cta-banner (TEXT-ONLY, no prominent images):',
    '  - "Support Us" / "Ways to Give" / "Make a Donation" sections (text + buttons only)',
    '  - "Subscribe to Newsletter" with large input forms (no hero image)',
    '  - "Contact Us" / "Get in Touch" sections with prominent buttons (no hero image)',
    '  - "Join Our Community" / "Become a Member" CTAs (no hero image)',
    '  - *** SECTION TITLE BANNERS: H2 section headings that appear between breadcrumbs and main content ***',
    '',
    '*** SECTION TITLE BANNER DETECTION (CRITICAL FOR SUBSECTION PAGES): ***',
    '  - Pattern: A prominent H2 heading (NOT H1) that appears AFTER breadcrumbs but BEFORE the main content area',
    '  - Common HTML: <div class="panel"><h2>Section Name</h2></div> or similar wrapper',
    '  - Examples: "Advance Care Planning", "Emergency Department", "Research Programs", "Patient Services"',
    '  - These banners identify which department/section of the site the user is viewing',
    '  - Emit as cta-banner with heading only (no buttons required)',
    '  - Example section banner payload: { "heading": "Advance Care Planning", "alignment": "left" }',
    '',
    '*** WRONG: Using cta-banner when there is an <img> tag in the banner area - use hero-with-image instead ***',
    '',
    'Data requirements: Populate heading, subheading (if present), and button configurations.',
    'primaryButton and secondaryButton should capture text, url, and variant exactly as shown.',
    'When background has a distinct color or image, note it in backgroundVariant or image fields.',
    'A page may have MULTIPLE cta-banner sections. Each distinct CTA section should be a separate component.',
    '',
    'Example CTA payload:',
    '  {',
    '    "heading": "Support the Hospital",',
    '    "subheading": "Your donation helps provide world-class care to children.",',
    '    "primaryButton": { "text": "Donate Now", "url": "/donate", "variant": "primary" },',
    '    "secondaryButton": { "text": "Learn More", "url": "/foundation", "variant": "outline" },',
    '    "alignment": "center",',
    '    "fullWidth": true',
    '  }',
    '',
    'Example section banner payload (heading only):',
    '  {',
    '    "heading": "Advance Care Planning",',
    '    "alignment": "left"',
    '  }'
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Ready to Get Started?',
    subheading: 'Join thousands of users already transforming their workflow',
    primaryButton: { label: 'Sign Up Now', href: '/signup', variant: 'primary' },
    secondaryButton: { label: 'Learn More', href: '/features', variant: 'outline' },
    alignment: 'center',
    fullWidth: true,
  },

  // Human-readable description
  description: 'Full-width call-to-action section with headline and primary/secondary buttons.',
})

// Export inferred TypeScript type
export type CTABannerContent = z.infer<typeof CTABannerDef.schema>
