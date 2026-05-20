import { z } from 'zod'

/**
 * Schema for Video Source value object
 * Used in: HeroVideo, VideoPlayer, VideoEmbed
 */
export const VideoSourceSchema = z.object({
  /** Video URL or embed code */
  url: z.string().describe('Video URL or embed URL'),
  /** Video type (MP4, WebM, YouTube, Vimeo, etc.) */
  type: z.enum(['mp4', 'webm', 'youtube', 'vimeo', 'embed']).optional().describe('Video source type'),
  /** Poster image URL */
  poster: z.string().optional().describe('Video thumbnail/poster image'),
  /** Poster image (alternative to 'poster') */
  posterImage: z.string().optional().describe('Poster image (alternative)'),
  /** Auto-play on load */
  autoplay: z.boolean().optional().describe('Auto-play video'),
  /** Loop playback */
  loop: z.boolean().optional().describe('Loop video'),
  /** Muted by default */
  muted: z.boolean().optional().describe('Mute audio'),
  /** Show video controls */
  controls: z.boolean().optional().describe('Show playback controls'),
  /** Fallback image if video fails */
  fallbackImage: z.string().optional().describe('Fallback image URL'),
})

// Derived TypeScript type
export type VideoSource = z.infer<typeof VideoSourceSchema>
