/**
 * Accordion Component Definition
 *
 * Collapsible list of items with titles and expandable content, optionally allowing multiple open.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { FAQSchema } from '../../_core/value-objects'

/**
 * Accordion component definition
 */
export const AccordionDef = defineComponent({
  type: ComponentType.Accordion,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Section heading displayed above the accordion'),
    subheading: z.string().optional().describe('Supporting text displayed below the heading'),
    items: z.array(FAQSchema).describe('List of accordion items with titles and expandable content'),
    allowMultiple: z.boolean().optional().describe('Allow multiple accordion items to be open simultaneously'),
    defaultOpenItems: z.array(z.string()).optional().describe('IDs of items that should be open by default'),
    expandIcon: z.string().optional().describe('Icon displayed when item is collapsed'),
    collapseIcon: z.string().optional().describe('Icon displayed when item is expanded'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'accordion',
      'faq',
      'frequently asked questions',
      'collapsible',
      'expandable',
      'toggle',
      'dropdown content',
      'q&a',
      'questions and answers',
      'disclosure',
      'expand collapse',
      'show hide',
      'accordion menu',
      'collapsible sections',
    ],
    patterns: [
      'class.*accordion',
      'class.*faq',
      'class.*collapsible',
      'class.*expandable',
      'role.*region.*expanded',
      'aria-expanded',
      'data-accordion',
      'data-faq',
      '<details>.*<summary>',
      'accordion-item',
      'accordion-header',
      'accordion-content',
    ],
    commonNames: [
      'Accordion',
      'FAQ',
      'FAQSection',
      'AccordionMenu',
      'CollapsibleList',
      'ExpandableContent',
      'QuestionsAnswers',
      'Collapsible',
      'DisclosurePanel',
      'ToggleContent',
    ],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.85,
    relatedComponents: [ComponentType.Tabs, ComponentType.TextBlock],
    industry: ['general', 'support', 'education', 'documentation'],
    semanticRole: 'interactive-content',
    accessibility: {
      ariaLabel: 'Frequently Asked Questions',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use accordion for FAQ sections or collapsible Q&A content',
    'Extract: heading from section title, subheading from supporting text',
    'Extract: items from <details>/<summary> or expandable list items',
    'Extract: allowMultiple from whether multiple items can be open simultaneously',
    'Extract: defaultOpenItems from items that are expanded by default',
    'NEVER nest accordions - use flat list of accordion-item components',
    'Map aria-expanded or data-accordion attributes to component props',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Frequently Asked Questions',
    subheading: 'Find answers to common questions about our products and services',
    items: [
      {
        question: 'What is your return policy?',
        answer: 'We offer a 30-day money-back guarantee on all products.',
      },
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping typically takes 5-7 business days.',
      },
      {
        question: 'Do you ship internationally?',
        answer: 'Yes, we ship to over 50 countries worldwide.',
      },
    ],
    allowMultiple: false,
    defaultOpenItems: ['faq-1'],
  },

  // Human-readable description
  description: 'Collapsible list of items with titles and expandable content, optionally allowing multiple open.',
})

// Export inferred TypeScript type
export type AccordionContent = z.infer<typeof AccordionDef.schema>
