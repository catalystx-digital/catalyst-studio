/**
 * About Section Component Definition
 *
 * About page section with story, mission, values, milestones, images, and stats.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema, StatItemSchema } from '../../_core/value-objects'

/**
 * Value item schema
 */
const ValueItemSchema = z.object({
  title: z.string().describe('Value title'),
  description: z.string().describe('Value description'),
  icon: z.string().optional().describe('Optional icon identifier'),
})

/**
 * Milestone item schema
 */
const MilestoneItemSchema = z.object({
  year: z.string().describe('Year or time period'),
  title: z.string().describe('Milestone title'),
  description: z.string().optional().describe('Milestone description'),
  icon: z.string().optional().describe('Optional icon identifier'),
})

/**
 * About Section component definition
 */
export const AboutSectionDef = defineComponent({
  type: ComponentType.AboutSection,
  category: ComponentCategory.About,

  schema: z.object({
    heading: z.string().describe('Main heading for the about section'),
    subheading: z.string().optional().describe('Supporting subheading'),
    story: z.string().optional().describe('Company or organization story (rich text)'),
    mission: z.string().optional().describe('Mission statement (rich text)'),
    vision: z.string().optional().describe('Vision statement (rich text)'),
    values: z.array(ValueItemSchema).optional().describe('List of company values'),
    milestones: z.array(MilestoneItemSchema).optional().describe('Company milestones and achievements'),
    imageList: z.array(ImageSchema).optional().describe('Gallery of images for the about section'),
    stats: z.array(StatItemSchema).optional().describe('Key statistics to display'),
    layout: z.enum(['single-column', 'two-column', 'timeline']).optional().describe('Layout style for the content'),
    showMilestones: z.boolean().optional().describe('Whether to display milestones section'),
    showValues: z.boolean().optional().describe('Whether to display values section'),
    showStats: z.boolean().optional().describe('Whether to display stats section'),
  }),

  detection: {
    keywords: [
      'about',
      'about section',
      'company history',
      'mission vision',
      'values',
      'milestones',
      'our story',
    ],
    patterns: [
      'about.*section',
      'company.*story',
      'mission.*vision',
    ],
    commonNames: [
      'about us',
      'about section',
      'company overview',
    ],
    pageLocation: ['main'],
    confidence: 0.85,
    relatedComponents: [
      ComponentType.TeamGrid,
      ComponentType.TeamMember,
    ],
    industry: ['general', 'corporate', 'public-sector'],
    semanticRole: 'region',
  },

  directives: [
    'Extract: heading from main h1/h2 in about section',
    'Extract: story from narrative paragraphs describing company history',
    'Extract: mission/vision from dedicated sections or cards',
    'Extract: values from listed items with icons or cards',
    'Extract: milestones from timeline or chronological list',
    'Extract: stats from numeric displays (employees, years, customers, etc.)',
    'Layout: Use timeline for milestones-focused pages, two-column for balanced content',
  ],

  sample: {
    heading: 'About Our Company',
    subheading: 'Building the future of digital experiences since 2015',
    story: '<p>Our journey began with a simple mission: make technology accessible to everyone.</p>',
    mission: '<p>We empower businesses to succeed through innovative digital solutions.</p>',
    vision: '<p>A world where technology enhances human potential without barriers.</p>',
    values: [
      { title: 'Innovation', description: 'We push boundaries and embrace new ideas', icon: 'lightbulb' },
      { title: 'Integrity', description: 'We do what\'s right, always', icon: 'shield' },
      { title: 'Excellence', description: 'We deliver quality in everything we do', icon: 'star' },
    ],
    milestones: [
      { year: '2015', title: 'Company Founded', description: 'Started with a team of 5 in a small office' },
      { year: '2018', title: 'First Major Client', description: 'Landed partnership with Fortune 500 company' },
      { year: '2023', title: 'Global Expansion', description: 'Opened offices in 10 countries' },
    ],
    stats: [
      { value: '500', label: 'Clients Served', suffix: '+' },
      { value: '8', label: 'Years in Business' },
      { value: '50', label: 'Team Members' },
      { value: '99', label: 'Client Satisfaction', suffix: '%' },
    ],
    layout: 'two-column',
    showMilestones: true,
    showValues: true,
    showStats: true,
  },

  description: 'About page section with story, mission, values, milestones, images, and stats.',
})

export type AboutSectionContent = z.infer<typeof AboutSectionDef.schema>
