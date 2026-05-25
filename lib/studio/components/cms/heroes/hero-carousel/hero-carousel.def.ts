/**
 * Hero Carousel Component Definition
 *
 * Carousel-style hero section rotating featured stories or promotions with imagery and calls to action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { HeroSlideSchema } from '../../_core/value-objects'

/**
 * Hero Carousel component definition
 */
export const HeroCarouselDef = defineComponent({
  type: ComponentType.HeroCarousel,
  category: ComponentCategory.Heroes,

  // Zod schema (single source of truth for props)
  schema: z.object({
    slides: z.array(HeroSlideSchema).describe('Ordered collection of hero slides'),
    autoPlay: z.boolean().optional().describe('Automatically advance slides while visible'),
    autoPlayInterval: z.number().optional().describe('Duration in milliseconds between automatic slide changes'),
    pauseOnHover: z.boolean().optional().describe('Pause autoplay when user hovers the carousel'),
    showIndicators: z.boolean().optional().describe('Display pagination indicators for direct slide access'),
    showControls: z.boolean().optional().describe('Render previous/next controls for manual navigation'),
    loop: z.boolean().optional().describe('Wrap to the first slide after reaching the end'),
    height: z.enum(['small', 'medium', 'large', 'full']).optional().describe('Vertical height preset for the carousel'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Default alignment for slide content'),
    indicatorStyle: z.enum(['dots', 'bars']).optional().describe('Visual style for slide indicators'),
    transitionStyle: z.enum(['fade', 'slide']).optional().describe('Animation style when changing slides'),
    theme: z.enum(['light', 'dark', 'auto']).optional().describe('Theme applied to text and controls'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'hero',
      'carousel',
      'slider',
      'promotion',
      'feature',
      'rotating',
      'banner',
    ],
    patterns: [
      'hero.*carousel',
      'carousel.*hero',
      'hero.*slider',
      'featured.*carousel',
    ],
    commonNames: [
      'hero carousel',
      'hero slider',
      'rotating hero',
      'featured hero carousel',
    ],
    pageLocation: ['hero'],
    confidence: 0.9,
    suggestedVariants: ['default', 'expanded'],
    relatedComponents: [ComponentType.HeroBanner, ComponentType.HeroWithImage, ComponentType.HeroVideo],
    industry: ['general', 'retail', 'events', 'news'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Featured content hero carousel',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'Data requirements: "slides[]" must include each hero slide in order. For every slide capture eyebrow/kicker, heading, subheading, body/summary, image ({ "src": { "mediaId": "detected:<stable-kebab-id>", "mediaType": "image", "url": "https://..." }, "alt": "..." }), overlay details, analyticsId, and CTA buttons with structured href + label/text.',
    'Never emit slide images with media fields flattened onto image, such as image.mediaId, image.mediaType, or image.url. The MediaReference belongs under image.src and mediaType must be exactly "image".',
    'Do not emit an empty slides array when slides are shown. Populate every field defined in the props contract when present on the page.',
    'Example hero payload:',
    '  "slides": [',
    '    {',
    '      "heading": "Coffee With a Cop",',
    '      "body": "Meet local police and enjoy free coffee at Bathurst City Centre.",',
    '      "image": { "src": { "mediaId": "detected:coffee-with-a-cop", "mediaType": "image", "url": "https://..." }, "alt": "Community coffee event" },',
    '      "ctaButtons": [{ "href": { "type": "internal", "pageId": "events-coffee-with-a-cop", "path": "/events/coffee-with-a-cop" }, "label": "Learn more" }]',
    '    }',
    '  ]',
    'If you cannot extract slide content, revisit the hero markup and do not return hero-carousel until slides[] is populated.',
  ],

  // Sample content for AI tools and testing
  sample: {
    slides: [
      {
        id: 'slide-1',
        eyebrow: 'New Product',
        heading: 'Introducing Our Latest Innovation',
        subheading: 'Transform your workflow with cutting-edge technology',
        body: 'Experience the future of productivity',
        theme: 'dark',
        alignment: 'left',
        image: {
          src: { mediaId: 'sample-hero-carousel-1', mediaType: 'image', url: 'https://example.com/hero1.jpg' },
          alt: 'Product showcase',
          originalUrl: 'https://example.com/hero1.jpg',
        },
        overlay: { color: '#000000', opacity: 0.4 },
        ctaButtons: [
          { label: 'Learn More', href: { type: 'internal', pageId: 'product', path: '/product' }, variant: 'primary' },
          { label: 'Watch Demo', href: { type: 'internal', pageId: 'demo', path: '/demo' }, variant: 'outline' },
        ],
      },
      {
        id: 'slide-2',
        eyebrow: 'Case Study',
        heading: 'See Real Results',
        subheading: 'How companies achieve 10x growth with our platform',
        theme: 'light',
        alignment: 'center',
        image: {
          src: { mediaId: 'sample-hero-carousel-2', mediaType: 'image', url: 'https://example.com/hero2.jpg' },
          alt: 'Success story',
          originalUrl: 'https://example.com/hero2.jpg',
        },
        ctaButtons: [
          { label: 'Read Story', href: { type: 'internal', pageId: 'case-studies', path: '/case-studies' }, variant: 'primary' },
        ],
      },
    ],
    autoPlay: true,
    autoPlayInterval: 5000,
    pauseOnHover: true,
    showIndicators: true,
    showControls: true,
    loop: true,
    height: 'large',
    indicatorStyle: 'dots',
    transitionStyle: 'fade',
  },

  // Human-readable description
  description: 'Carousel-style hero section rotating featured stories or promotions with imagery and calls to action.',
})

// Export inferred TypeScript type
export type HeroCarouselContent = z.infer<typeof HeroCarouselDef.schema>
