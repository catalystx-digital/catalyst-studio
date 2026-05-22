/**
 * Image Gallery Component Definition
 *
 * Responsive gallery of images with grid, carousel, or masonry layout and optional lightbox.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema } from '../../_core/value-objects'

/**
 * Image Gallery component definition
 */
export const ImageGalleryDef = defineComponent({
  type: ComponentType.ImageGallery,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    images: z.array(ImageSchema).describe('Array of images with src, alt, caption, and optional metadata'),
    displayMode: z.enum(['grid', 'carousel', 'masonry']).optional().describe('Gallery presentation mode'),
    columns: z.number().int().min(2).max(6).optional().describe('Number of columns in grid or masonry mode (2-6)'),
    spacing: z.enum(['tight', 'normal', 'loose']).optional().describe('Spacing between images'),
    showCaptions: z.boolean().optional().describe('Display image captions'),
    enableLightbox: z.boolean().optional().describe('Enable full-screen lightbox on image click'),
    autoPlay: z.boolean().optional().describe('Auto-advance carousel (carousel mode only)'),
    autoPlayInterval: z.number().optional().describe('Milliseconds between auto-advances in carousel mode'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'gallery',
      'images',
      'photos',
      'carousel',
      'grid',
      'slideshow',
      'album',
      'portfolio',
    ],
    patterns: [
      'image gallery',
      'photo grid',
      'picture carousel',
      'image slider',
      'photo album',
    ],
    commonNames: [
      'image-gallery',
      'photo-gallery',
      'gallery',
      'carousel',
      'slider',
    ],
    pageLocation: ['main', 'hero'],
    confidence: 0.9,
    suggestedVariants: ['default', 'compact', 'expanded'],
    relatedComponents: [ComponentType.CardGrid, ComponentType.HeroWithImage],
    industry: ['general', 'portfolio', 'ecommerce', 'photography', 'real-estate'],
    semanticRole: 'region',
    accessibility: {
      ariaLabel: 'Image gallery',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'Data requirements: Populate images[] with every visible gallery image in DOM order.',
    'Each image object MUST include: url (absolute image URL), alt (accessible description).',
    'Optional image fields: caption, width, height.',
    'Set displayMode to "grid", "carousel", or "masonry" based on the layout.',
    'Set columns to match the grid column count (2-6).',
    'Set spacing to "tight", "normal", or "loose" based on gaps.',
    'Set showCaptions=true when captions are displayed below images.',
    'Set enableLightbox=true when clicking images opens a modal viewer.',
    'For carousel galleries, set autoPlay and autoPlayInterval as applicable.',
    'Do NOT add fields not in the contract: heading, title, description are NOT valid fields for image-gallery.',
    'If a heading is present above the gallery, it belongs to a parent section component, not the gallery itself.',
    'Example payload:',
    '  {',
    '    "images": [',
    '      { "url": "https://example.com/img1.jpg", "alt": "Gallery image 1", "caption": "Spring collection" },',
    '      { "url": "https://example.com/img2.jpg", "alt": "Gallery image 2" }',
    '    ],',
    '    "displayMode": "grid",',
    '    "columns": 3,',
    '    "showCaptions": true,',
    '    "enableLightbox": true',
    '  }',
  ],

  // Sample content for AI tools and testing
  sample: {
    images: [
      {
        src: { mediaId: 'sample-gallery-1', mediaType: 'image', url: '/images/gallery-1.jpg' },
        alt: 'Mountain landscape at sunset',
        originalUrl: '/images/gallery-1.jpg',
        caption: 'Sunset over the Rockies',
      },
      {
        src: { mediaId: 'sample-gallery-2', mediaType: 'image', url: '/images/gallery-2.jpg' },
        alt: 'Ocean waves crashing on shore',
        originalUrl: '/images/gallery-2.jpg',
        caption: 'Pacific Coast Highway',
      },
      {
        src: { mediaId: 'sample-gallery-3', mediaType: 'image', url: '/images/gallery-3.jpg' },
        alt: 'Forest path in autumn',
        originalUrl: '/images/gallery-3.jpg',
        caption: 'Fall colors in Vermont',
      },
    ],
    displayMode: 'grid',
    columns: 3,
    spacing: 'normal',
    showCaptions: true,
    enableLightbox: true,
    autoPlay: false,
  },

  // Human-readable description
  description: 'Responsive gallery of images with grid, carousel, or masonry layout and optional lightbox.',
})

// Export inferred TypeScript type
export type ImageGalleryContent = z.infer<typeof ImageGalleryDef.schema>
