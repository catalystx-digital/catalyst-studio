/**
 * HeroWithImage Component Definition
 *
 * Zod-first component definition using the new defineComponent() pattern.
 * This single file replaces:
 * - hero-with-image.propsmeta.ts (schema defines props)
 * - hero-with-image.ai.ts (detection field)
 * - hero-with-image.types.ts (types inferred from schema)
 *
 * The Zod schema is the single source of truth.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema, ImageSchema } from '../../_core/value-objects'

/**
 * Hero with Image component definition
 *
 * Primary hero section pairing marketing copy with a supporting image
 * and optional CTA buttons.
 */
export const HeroWithImageDef = defineComponent({
  type: ComponentType.HeroWithImage,
  category: ComponentCategory.Heroes,

  description: 'Primary hero section pairing marketing copy with a supporting image and optional CTA buttons.',

  // Zod schema is the single source of truth
  schema: z.object({
    /** Short label shown above the headline */
    eyebrow: z.string().optional().describe('Short label shown above the headline.'),

    /** Primary headline for the hero */
    heading: z.string().describe('Primary headline for the hero.'),

    /** Supporting headline that reinforces the message */
    subheading: z.string().optional().describe('Supporting headline that reinforces the message.'),

    /** Optional descriptive copy below the headings */
    body: z.string().optional().describe('Optional descriptive copy below the headings.'),

    /** Controls text alignment within the hero copy column */
    alignment: z.enum(['left', 'center']).optional().describe('Controls text alignment within the hero copy column.'),

    /** Determines whether the supporting image renders to the right or left of the copy */
    layout: z.enum(['image-right', 'image-left']).optional().describe('Determines whether the supporting image renders to the right or left of the copy.'),

    /** Optional visual theme override for the section background */
    theme: z.enum(['light', 'dark']).optional().describe('Optional visual theme override for the section background.'),

    /** Hero artwork rendered alongside the marketing copy */
    image: ImageSchema.optional().describe('Hero artwork rendered alongside the marketing copy.'),

    /** Primary and secondary calls to action */
    ctaButtons: z.array(CTAButtonSchema).optional().describe('Primary and secondary calls to action.')
  }),

  // AI detection metadata (replaces hero-with-image.ai.ts)
  detection: {
    keywords: ['hero', 'image hero', 'marketing hero', 'headline', 'cta'],
    patterns: [
      'hero.*image',
      'primary.*hero',
      'hero.*with.*visual',
      'hero.*cta'
    ],
    commonNames: ['hero with image', 'marketing hero', 'product hero'],
    pageLocation: ['hero'],
    confidence: 0.9,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [ComponentType.HeroSplit, ComponentType.HeroBanner, ComponentType.HeroMinimal],
    industry: ['general', 'saas', 'retail', 'commerce'],
    semanticRole: 'banner',
    accessibility: {
      role: 'banner',
      ariaLabel: 'Hero section with supporting image'
    }
  },

  // LLM directives for data extraction (replaces centralized directives.ts entry)
  directives: [
    '*** PRIORITY SELECTION: Use hero-with-image (NOT cta-banner) for ANY page-level banner section at the top of the page that contains a PROMINENT IMAGE. ***',
    '*** HERO IMAGE DETECTION: Scan for <img> tags with large/full-width images, CSS background-image on banner containers, or image elements within wrapper divs like .banner, .hero, .plhBanner, .jumbotron, .masthead. ***',
    '*** If you find an <img> tag in the top banner area of a page, it is ALWAYS hero-with-image, not cta-banner. cta-banner is for TEXT-ONLY banners without imagery. ***',
    '*** CRITICAL: hero-with-image MUST be a TOP-LEVEL component. NEVER nest it inside two-column, multi-column, or any layout container. ***',
    '*** Heroes are primary visual anchors meant to span the full page width and appear directly in the components[] array. ***',
    '*** If you detect a hero image inside a sidebar+content layout, emit it as a SEPARATE top-level component BEFORE the two-column layout. ***',
    'Common HTML patterns for hero banners with images:',
    '  - <div id="plhBanner"><img src="...PatientsFamilies.jpg" alt="..."></div>',
    '  - <div class="hero-banner"><img src="..." alt="..."></div>',
    '  - <section class="banner" style="background-image: url(...)">',
    '  - Any container with a large image near the page heading that spans a significant width',
    'Data requirements: Extract full hero copy (eyebrow, heading, subheading, body) plus layout/theme values when present. Include image.src with absolute URL, image.alt (or descriptive fallback), and any overlay/background options.',
    'If CTA buttons render, populate ctaButtons[] with label, href, and variant/icon data. Do not collapse them into summary text.',
    'Emit CTA button style under "variant" (primary|secondary|outline). Never return legacy keys like "style", "buttonStyle", or "type" for button appearance—only label, href, variant (and icon when present).',
    'Preserve every CTA rendered in the hero—include both primary and secondary actions when present.',
    'Do not emit hero-with-image until heading and image fields are populated. Summary text alone is insufficient.',
    'Example payload:',
    '  {',
    '    "eyebrow": "Discover Catholic education",',
    '    "heading": "Belonging starts here",',
    '    "subheading": "Opportunities for every learner.",',
    '    "body": "Our schools nurture curiosity, faith, and growth from the first day.",',
    '    "layout": "image-right",',
    '    "image": { "src": "https://...", "alt": "Students collaborating in class" },',
    '    "ctaButtons": [{ "label": "Explore schools", "href": "/schools", "variant": "primary" }]',
    '  }',
    'Mapping guidance: use the hero headline (h1/h2) for "heading", supporting line for "subheading", paragraph copy for "body", and capture eyebrow tags or badges as "eyebrow". Pull the hero <img> absolute URL + alt into image.src/alt and convert CTA anchors into ctaButtons[] entries with href, label, and variant classes.',
    'Combine inline-styled heading fragments (e.g., <strong>Free</strong> <strong>and</strong> <strong>fair trading</strong>) into a single heading string; do not split the words into separate fields just because the DOM wraps each word.',
    'Move any paragraph immediately following the headline (including .field-position-statement copy) into "body". Returning hero-with-image without body when that paragraph exists is invalid—fetch the hero section again and provide the missing text.',
    'When the DOM hero renders text over a CSS background image (no explicit <img>), resolve the background-image URL into image.src, set theme="dark", include overlay metadata (image.overlayColor/overlayOpacity or background tokens), and mirror that absolute URL in image.originalUrl so importer fixes stay at zero.',
    'Whenever image.src is provided, also set image.originalUrl to the same absolute URL (or the source asset before CDN rewriting). Heroes without originalUrl are considered incomplete and must be re-harvested.',
    'If any hero field is missing, request get_section for the hero DOM (hero/main region) and re-run extraction before finalizing.'
  ],

  // Sample data for testing/demos
  sample: {
    eyebrow: 'New Product Launch',
    heading: 'Transform Your Digital Experiences',
    subheading: 'Build modern, responsive websites with powerful tools and intuitive design',
    body: 'Our platform combines cutting-edge technology with user-friendly interfaces to help you create stunning digital experiences that engage your audience and drive results.',
    alignment: 'left',
    layout: 'image-right',
    theme: 'light',
    image: {
      src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=800&fit=crop',
      alt: 'Team collaborating on digital project',
      width: 1200,
      height: 800,
      objectFit: 'cover',
      backgroundPosition: 'center'
    },
    ctaButtons: [
      {
        label: 'Get Started',
        href: '/signup',
        variant: 'primary'
      },
      {
        label: 'Learn More',
        href: '/features',
        variant: 'secondary'
      }
    ]
  }
})

// TypeScript type is automatically inferred from the Zod schema
export type HeroWithImageContent = z.infer<typeof HeroWithImageDef.schema>

// For backward compatibility with existing component props pattern
export interface HeroWithImageProps {
  id: string
  type: ComponentType.HeroWithImage
  category: ComponentCategory.Heroes
  content: HeroWithImageContent
  className?: string
  theme?: 'light' | 'dark'
}
