/**
 * HTML Block Component Definition
 *
 * Rich HTML content block for documentation, resource pages, and information content without author/date metadata.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * HTML Block component definition
 */
export const HtmlBlockDef = defineComponent({
  type: ComponentType.HtmlBlock,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Optional title displayed above the content'),
    bodyHtml: z.string().describe('Rich HTML content with headings, paragraphs, lists, and formatted text'),
    sourceUrl: z.string().optional().describe('Optional URL referencing the original source of the content'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'html',
      'content',
      'page',
      'documentation',
      'resource',
      'information',
      'wysiwyg',
      'article',
    ],
    patterns: [
      'content page',
      'documentation',
      'resource page',
      'information page',
      'policy page',
    ],
    commonNames: [
      'html-block',
      'content-page',
      'html-content',
      'page-content',
      'rich-content',
    ],
    pageLocation: ['main'],
    confidence: 0.85,
    suggestedVariants: ['default'],
    relatedComponents: [ComponentType.TextBlock, ComponentType.QuoteBlock],
    industry: ['general', 'documentation', 'education', 'legal'],
    semanticRole: 'article',
    accessibility: {
      ariaLabel: 'Page content section',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    '*** PRIORITY: Use html-block for content/information pages instead of hero + multiple text-blocks. ***',
    '',
    'DETECTION: Use html-block when you see:',
    '  - Sidebar navigation ("In this section", "Related pages", etc.) + main content',
    '  - H1 title followed by multiple paragraphs of prose',
    '  - Documentation, resource, policy, or information page layout',
    '  - NO author byline, NO publish date, NO blog metadata',
    '',
    'CRITICAL RULES:',
    '  1. Do NOT use hero-banner or hero-simple for content page titles - use html-block title field',
    '  2. Do NOT emit multiple text-blocks for continuous content - use ONE html-block with all content',
    '  3. Combine ALL prose content (paragraphs, headings, lists) into a single bodyHtml',
    '',
    'Structure:',
    '  title: The page title (H1) - REQUIRED for content pages',
    '  bodyHtml: ALL page content as HTML (paragraphs, H2s, lists, links) - REQUIRED',
    '',
    'Example: A page with title "Thinking Ahead" and 3 sections should be:',
    '  {',
    '    "title": "Thinking Ahead",',
    '    "bodyHtml": "<p>Introduction paragraph...</p><h2>Section 1</h2><p>Content...</p><h2>Section 2</h2><p>More content...</p><h2>Section 3</h2><p>Final content...</p>"',
    '  }',
    '',
    'NOT: hero-simple + text-block + text-block + text-block (WRONG!)',
    'Instead: ONE html-block with title and all content in bodyHtml (CORRECT!)',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Privacy Policy',
    bodyHtml: `
      <h2>Information We Collect</h2>
      <p>We collect information you provide directly to us, including:</p>
      <ul>
        <li>Name and contact information</li>
        <li>Account credentials</li>
        <li>Payment information</li>
      </ul>
      <h2>How We Use Your Information</h2>
      <p>We use the information we collect to provide, maintain, and improve our services.</p>
    `,
    sourceUrl: '/legal/privacy',
  },

  // Human-readable description
  description: 'Rich HTML content block for documentation, resource pages, and information content without author/date metadata.',
})

// Export inferred TypeScript type
export type HtmlBlockContent = z.infer<typeof HtmlBlockDef.schema>
