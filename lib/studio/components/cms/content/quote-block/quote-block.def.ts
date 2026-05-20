/**
 * Quote Block Component Definition
 *
 * Pull quote section with attribution and styles for emphasis in content pages.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema } from '../../_core/value-objects'

/**
 * Attribution schema for quote block
 */
const QuoteAttributionSchema = z.object({
  author: z.string().optional().describe('Name of the person being quoted'),
  title: z.string().optional().describe('Job title or role of the author'),
  organization: z.string().optional().describe('Organization or company affiliation'),
  image: ImageSchema.optional().describe('Avatar or headshot image with alt text and metadata'),
  date: z.string().optional().describe('Date the quote was given or published'),
})

/**
 * Quote Block component definition
 */
export const QuoteBlockDef = defineComponent({
  type: ComponentType.QuoteBlock,
  category: ComponentCategory.Content,


  // Aliases for component type resolution
  aliases: [
    'quote',
    'quoteblock',
    'quote-block',
  ],
  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Optional heading displayed above the quote'),
    subheading: z.string().optional().describe('Supporting text displayed below the heading'),
    quote: z.string().describe('The quotation text, can include rich formatting'),
    attribution: QuoteAttributionSchema.optional().describe('Attribution information for the quote author'),
    highlight: z.boolean().optional().describe('Apply visual emphasis to the quote'),
    icon: z.enum(['quotes', 'none', 'custom']).optional().describe('Quote icon style'),
    customIcon: z.string().optional().describe('Custom icon URL when icon is set to "custom"'),
    style: z.enum(['default', 'bordered', 'highlighted', 'testimonial', 'pullquote']).optional().describe('Visual presentation style'),
    align: z.enum(['left', 'center', 'right']).optional().describe('Horizontal alignment of the quote'),
    size: z.enum(['small', 'medium', 'large', 'xlarge']).optional().describe('Text size for the quote'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'quote',
      'blockquote',
      'testimonial',
      'pullquote',
      'citation',
      'quotation',
      'customer review',
      'praise',
      'endorsement',
      'feedback',
      'saying',
      'excerpt',
      'highlight quote',
      'callout quote',
    ],
    patterns: [
      'class.*quote',
      'class.*blockquote',
      'class.*testimonial',
      'class.*pullquote',
      '<blockquote',
      '<q>',
      'role.*quote',
      'data-testimonial',
      'data-quote',
      'testimonial-text',
      'quote-text',
      'citation',
    ],
    commonNames: [
      'Quote',
      'QuoteBlock',
      'Blockquote',
      'Testimonial',
      'PullQuote',
      'CustomerQuote',
      'ReviewQuote',
      'Quotation',
      'Citation',
      'HighlightQuote',
      'CalloutQuote',
    ],
    pageLocation: ['main', 'hero', 'sidebar'],
    confidence: 0.90,
    relatedComponents: [ComponentType.TextBlock, ComponentType.Testimonials],
    industry: ['general', 'marketing', 'education', 'publishing', 'corporate'],
    semanticRole: 'testimonial',
    accessibility: {
      ariaLabel: 'Quote',
      role: 'blockquote',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use quote-block for prominent quotes, testimonials, or pullquotes',
    'Extract: quote from <blockquote> or <q> tags',
    'Extract: attribution from cite, author, or footer elements',
    'Extract: author from name or byline',
    'Extract: title from job title or role',
    'Extract: organization from company or affiliation',
    'Extract: style from visual presentation (default/bordered/highlighted/testimonial/pullquote)',
    'Extract: align from text alignment (left/center/right)',
    'NEVER nest quote-block components',
    'Ideal for customer testimonials, expert quotes, featured statements',
  ],

  // Sample content for AI tools and testing
  sample: {
    quote: 'This product has completely transformed how we work. The team is more productive and our customers are happier than ever.',
    attribution: {
      author: 'Sarah Johnson',
      title: 'CEO',
      organization: 'TechCorp Inc.',
      image: '/images/sarah-johnson.jpg',
    },
    style: 'testimonial',
    align: 'center',
    size: 'large',
    icon: 'quotes',
    highlight: true,
  },

  // Human-readable description
  description: 'Pull quote section with attribution and styles for emphasis in content pages.',
})

// Export inferred TypeScript type
export type QuoteBlockContent = z.infer<typeof QuoteBlockDef.schema>
