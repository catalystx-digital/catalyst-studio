/**
 * Video Player Component Definition
 *
 * Responsive video player supporting multiple sources and playback controls.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Video source schema
 */
const VideoSourceSchema = z.object({
  url: z.string().describe('Video file URL or embed URL'),
  type: z.enum(['mp4', 'webm', 'ogg', 'youtube', 'vimeo']).describe('Video format or platform type'),
  quality: z.string().optional().describe('Quality label (e.g., "720p", "1080p")'),
})

/**
 * Video Player component definition
 */
export const VideoPlayerDef = defineComponent({
  type: ComponentType.VideoPlayer,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    sources: z.array(VideoSourceSchema).describe('List of video sources with URLs and formats'),
    posterImage: z.string().optional().describe('Thumbnail image displayed before video playback'),
    title: z.string().optional().describe('Video title displayed above or within the player'),
    description: z.string().optional().describe('Video description or caption text'),
    autoPlay: z.boolean().optional().describe('Automatically start playback when visible'),
    muted: z.boolean().optional().describe('Start video with audio muted'),
    loop: z.boolean().optional().describe('Continuously loop video playback'),
    controls: z.boolean().optional().describe('Show native video player controls'),
    showPlayButton: z.boolean().optional().describe('Display custom play button overlay'),
    aspectRatio: z.enum(['16:9', '4:3', '21:9', '1:1', '9:16']).optional().describe('Video container aspect ratio'),
    fallbackImage: z.string().optional().describe('Image displayed if video fails to load'),
    fallbackMessage: z.string().optional().describe('Error message shown when video cannot play'),
  }),

  // Detection metadata
  detection: {
    keywords: ['video', 'player', 'media', 'mp4', 'youtube', 'vimeo', 'embed', 'movie', 'film', 'watch'],
    patterns: ['video player', 'embedded video', 'youtube embed', 'vimeo embed', 'media player'],
    commonNames: ['video-player', 'video', 'player', 'media-player', 'video-embed'],
    pageLocation: ['main', 'hero'],
    confidence: 0.95,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    relatedComponents: [ComponentType.VideoEmbed],
    semanticRole: 'video',
    accessibility: {
      ariaLabel: 'Video player',
      role: 'application',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use video-player for video content with playback controls',
    'Extract: video sources from <video> tags, iframe embeds (YouTube/Vimeo)',
    'Extract: poster/thumbnail from poster attribute or og:image meta tags',
    'Extract: title from video-specific headings or captions',
    'Detect YouTube/Vimeo: Parse embed URLs to extract video IDs',
    'Controls: Default to true unless explicitly hidden in source',
    'NEVER use for static images - use Image component instead',
  ],

  // Sample content for AI tools and testing
  sample: {
    sources: [
      { url: 'https://example.com/video.mp4', type: 'mp4', quality: '1080p' },
      { url: 'https://example.com/video.webm', type: 'webm', quality: '1080p' },
    ],
    posterImage: 'https://example.com/poster.jpg',
    title: 'Product Demo Video',
    description: 'Watch how our product solves your challenges in under 2 minutes',
    autoPlay: false,
    muted: false,
    loop: false,
    controls: true,
    showPlayButton: true,
    aspectRatio: '16:9',
    fallbackMessage: 'Your browser does not support video playback',
  },

  // Human-readable description
  description: 'Responsive video player supporting multiple sources and playback controls.',
})

// Export inferred TypeScript type
export type VideoPlayerContent = z.infer<typeof VideoPlayerDef.schema>
