/**
 * Text Block Component Definition
 *
 * Rich text block for headings and paragraphs, with alignment and optional columns.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Text Block component definition
 */
export const TextBlockDef = defineComponent({
  type: ComponentType.TextBlock,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Main heading for the text block'),
    subheading: z.string().optional().describe('Supporting subheading below the main heading'),
    body: z.string().describe('Rich text content displayed as the main body of the block'),
    alignment: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Horizontal alignment for text content'),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Number of columns for text layout (1-3)'),
    headingLevel: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]).optional().describe('HTML heading level (h1-h6) for semantic structure'),
  }),

  // Detection metadata
  detection: {
    keywords: ['text', 'paragraph', 'article', 'content', 'body', 'description', 'prose', 'copy'],
    patterns: ['<p>', 'lorem ipsum', 'text content', 'paragraph', 'article body'],
    commonNames: ['text-block', 'content-block', 'text-section', 'article-content', 'body-text'],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.8,
    suggestedVariants: ['default', 'minimal', 'detailed'],
    semanticRole: 'article',
    accessibility: {
      ariaLabel: 'Text content section',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    'Use text-block for SHORT, standalone text snippets that stand out from the main content.',
    '',
    'Good uses for text-block:',
    '  - Header utility text (hotline copy, safety disclaimers)',
    '  - Pull quotes or callout boxes',
    '  - Short announcements or notices',
    '',
    'Do NOT use text-block for:',
    '  - Full page content (use html-block instead)',
    '  - Blog/article content (use blog-post instead)',
    '  - Multiple paragraphs of continuous prose (use html-block instead)',
    '',
    'If you find yourself emitting multiple consecutive text-blocks for one page, STOP.',
    'That content should be ONE html-block with all the HTML in bodyHtml.',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'About Our Company',
    subheading: 'Building the future of digital experiences',
    body: '<p>We are a team of passionate individuals dedicated to creating innovative solutions. Our mission is to empower businesses with cutting-edge technology that drives growth and success.</p><p>With over a decade of experience, we have helped thousands of companies transform their digital presence.</p>',
    alignment: 'left',
    columns: 1,
    headingLevel: 2,
  },

  // Human-readable description
  description: 'Rich text block for headings and paragraphs, with alignment and optional columns.',
})

// Export inferred TypeScript type
export type TextBlockContent = z.infer<typeof TextBlockDef.schema>
