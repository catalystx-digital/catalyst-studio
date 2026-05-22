/**
 * Hero Video Component Definition
 *
 * Video-first hero section with optional overlay content and playback controls.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * Overlay content schema
 */
const OverlayContentSchema = z.object({
  heading: z.string().optional(),
  subheading: z.string().optional(),
  body: z.string().optional(),
  ctaButtons: z.array(CTAButtonSchema).optional(),
}).optional()

/**
 * Video settings schema
 */
const VideoSettingsSchema = z.object({
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  controls: z.boolean().optional(),
}).optional()

/**
 * Hero Video component definition
 */
export const HeroVideoDef = defineComponent({
  type: ComponentType.HeroVideo,
  category: ComponentCategory.Heroes,

  // Zod schema (single source of truth for props)
  schema: z.object({
    videoUrl: z.string().describe('Source URL for the hero video'),
    posterImage: z.string().optional().describe('Poster image displayed before the video plays'),
    overlayContent: OverlayContentSchema.describe('Optional content overlay displayed on top of the video'),
    videoSettings: VideoSettingsSchema.describe('Playback configuration applied to the video'),
    fallbackImage: z.string().optional().describe('Static image shown when video playback is unavailable'),
    height: z.enum(['small', 'medium', 'large', 'full']).optional().describe('Vertical height preset for the hero'),
    alignment: z.enum(['left', 'center', 'right']).optional().describe('Alignment of overlay copy within the hero'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'hero',
      'video',
      'background',
      'autoplay',
      'loop',
      'cinematic',
      'fullscreen',
    ],
    patterns: [
      'video.*hero',
      'hero.*video',
      'background.*video',
      'cinematic.*hero',
    ],
    commonNames: [
      'video hero',
      'video background',
      'hero with video',
      'cinematic hero',
    ],
    pageLocation: ['hero'],
    confidence: 0.88,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    relatedComponents: [
      ComponentType.HeroBanner,
      ComponentType.HeroSplit,
      ComponentType.HeroMinimal,
    ],
    industry: ['general', 'media', 'entertainment', 'marketing'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Video hero section',
      role: 'banner',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use hero-video for hero sections with background video',
    'Extract: videoUrl from video element src or source tag',
    'Extract: posterImage from video poster attribute',
    'Extract: overlayContent from text/buttons overlaid on video',
    'Extract: videoSettings from video attributes (autoplay, loop, muted, controls)',
    'Extract: fallbackImage from noscript or fallback content',
    'Extract: height from section size',
    'Extract: alignment from overlay content positioning',
    'NEVER nest hero components - must be top-level section',
  ],

  // Sample content for AI tools and testing
  sample: {
    videoUrl: '/videos/hero-background.mp4',
    posterImage: '/images/video-poster.jpg',
    overlayContent: {
      heading: 'Experience Innovation',
      subheading: 'Watch how we transform digital experiences',
      ctaButtons: [
        { label: 'Learn More', href: { type: 'internal', pageId: 'about', path: '/about' }, variant: 'primary' },
      ],
    },
    videoSettings: {
      autoplay: true,
      loop: true,
      muted: true,
      controls: false,
    },
    fallbackImage: '/images/hero-fallback.jpg',
    height: 'full',
    alignment: 'center',
  },

  // Human-readable description
  description: 'Video-first hero section with optional overlay content and playback controls.',
})

// Export inferred TypeScript type
export type HeroVideoContent = z.infer<typeof HeroVideoDef.schema>
