/**
 * Video Embed Component Definition
 *
 * Embeds externally hosted video players (YouTube, Vimeo, Loom, Wistia) with responsive sizing and analytics support.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Video Embed component definition
 */
export const VideoEmbedDef = defineComponent({
  type: ComponentType.VideoEmbed,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    provider: z.enum(['youtube', 'vimeo', 'loom', 'wistia', 'iframe']).describe('The upstream video provider used to generate the embed URL'),
    url: z.string().describe('Source URL returned by the provider (share or watch URL) that will be converted into an embeddable iframe'),
    title: z.string().optional().describe('Accessible title displayed above the embed and used for the iframe title attribute'),
    description: z.string().optional().describe('Optional supporting copy rendered before the embed'),
    allowFullScreen: z.boolean().optional().describe('Enables fullscreen controls on the embedded player (defaults to true)'),
    autoPlay: z.boolean().optional().describe('Automatically starts playback when the component becomes visible (provider permitting)'),
    muted: z.boolean().optional().describe('Mutes the embedded player on load; recommended when autoplay is enabled'),
    startTime: z.number().optional().describe('Optional starting timestamp in seconds for providers that support deep linking'),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']).optional().describe('Controls the responsive aspect ratio wrapper applied around the iframe'),
    caption: z.string().optional().describe('Caption or attribution text displayed underneath the video embed'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'video',
      'video embed',
      'youtube',
      'vimeo',
      'loom',
      'wistia',
      'iframe',
    ],
    patterns: [
      'video.*embed',
      'embedded.*video',
      'youtube.*player',
      'vimeo.*player',
      'loom.*video',
      'wistia.*video',
    ],
    commonNames: [
      'video embed',
      'embedded video',
      'video iframe',
      'external video player',
    ],
    pageLocation: ['main'],
    confidence: 0.86,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [ComponentType.VideoPlayer, ComponentType.HeroVideo],
    industry: ['general', 'marketing', 'education', 'support'],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Embedded video player',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use video-embed for externally hosted videos (YouTube, Vimeo, Loom, Wistia)',
    'Extract: provider from video URL domain (youtube.com, vimeo.com, loom.com, wistia.com)',
    'Extract: url from iframe src or video share URL',
    'Extract: title from heading or accessible label',
    'Extract: description from supporting text above video',
    'Extract: allowFullScreen from iframe allowfullscreen attribute',
    'Extract: autoPlay from iframe autoplay parameter or data attribute',
    'Extract: aspectRatio from iframe dimensions or CSS aspect ratio',
    'NEVER use for self-hosted videos - use VideoPlayer instead',
    'Convert share URLs to embed URLs automatically',
  ],

  // Sample content for AI tools and testing
  sample: {
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Product Demo Video',
    description: 'Watch how our platform can transform your workflow',
    allowFullScreen: true,
    autoPlay: false,
    muted: false,
    aspectRatio: '16:9',
    caption: 'Product demonstration - 5 minutes',
  },

  // Human-readable description
  description: 'Embeds externally hosted video players (YouTube, Vimeo, Loom, Wistia) with responsive sizing and analytics support.',
})

// Export inferred TypeScript type
export type VideoEmbedContent = z.infer<typeof VideoEmbedDef.schema>
