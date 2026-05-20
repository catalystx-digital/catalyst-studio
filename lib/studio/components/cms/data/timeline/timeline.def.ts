/**
 * Timeline Component Definition
 *
 * Chronological timeline of events with titles, dates, descriptions, and optional icons.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema, TimelineEventSchema } from '../../_core/value-objects'

/**
 * Timeline component definition
 */
export const TimelineDef = defineComponent({
  type: ComponentType.Timeline,
  category: ComponentCategory.Data,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Main heading for the timeline section'),
    subtitle: z.string().optional().describe('Supporting text below the title'),
    events: z.array(TimelineEventSchema).describe('Ordered list of timeline events (timeline-event components)'),
    layout: z.enum(['vertical', 'horizontal', 'alternating']).optional().describe('Visual arrangement of timeline events'),
    showConnectors: z.boolean().optional().describe('Display connecting lines between timeline events'),
    dateFormat: z.string().optional().describe('Date formatting pattern (e.g., "MMM YYYY", "DD/MM/YYYY")'),
    showIcons: z.boolean().optional().describe('Display icons for each timeline event'),
    animated: z.boolean().optional().describe('Enable scroll-based reveal animations'),
    footerCta: CTAButtonSchema.optional().describe('Call-to-action button displayed after timeline'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'timeline',
      'history',
      'milestones',
      'roadmap',
      'events',
      'chronology',
      'journey',
      'process',
      'steps',
      'progress',
      'timeline events',
      'chronological',
      'historical',
    ],
    patterns: [
      'timeline',
      'history\\s*(section)?',
      'milestones?',
      'roadmap',
      'chronolog(y|ical)',
      'journey',
      'our\\s+story',
      'company\\s+history',
      'event\\s+timeline',
    ],
    commonNames: [
      'timeline',
      'history-timeline',
      'milestone-timeline',
      'event-timeline',
      'roadmap',
      'journey-map',
    ],
    pageLocation: ['main'],
    confidence: 0.75,
    relatedComponents: [ComponentType.TimelineEvent, ComponentType.TimelineAction],
    semanticRole: 'region',
    accessibility: {
      ariaLabel: 'Timeline of events',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'Prefer timeline for sequential or numbered processes (progress bars, step indicators, journey flows). Feature-list is not appropriate when connectors, step numbers, or arrows are rendered.',
    'Map each step to timeline-event and only populate events[].date when the UI renders literal text for dates/timestamps ("Step 1", "June 2024", "Submission deadline"). When steps show unlabeled icons or connector lines, leave events[].date undefined and rely on title/description for copy.',
    'Set layout to "horizontal" when steps are arranged side-by-side and "vertical" when stacked; use "alternating" if the UI alternates sides.',
    'If CSS classes or text reference progress bars/steps (progress-bar, progress-step, numbered badges, stepper, tracker) or the UI shows a horizontal connector with unlabeled steps, set timeline.variant="progress" and include semanticTokens/keywords for the detected classes so downstream logic knows it is a progress stepper—even when layout stays "vertical".',
    'When variant="progress", also set metadata (progressVariant/progress-step tokens) but keep events[].date blank unless the DOM literally prints the date/step label. Do NOT fabricate placeholder numbers just to satisfy the field.',
    'Inventing numeric counters (1, 2, 3, 4) when the DOM has empty placeholders is a contract violation; fetch the section again instead of hallucinating digits.',
    'Only fall back to a different component when there are no connectors, numbers, or progression cues.',
    'Buttons or links that belong to individual steps belong in timeline.events[].actions (type "timeline-action" entries with text/url/variant). Do not emit a separate CTA component for per-step buttons.',
    'Section-level CTAs such as "Learn more about our process" MUST populate timeline.footerCta so the button renders inside the section instead of spawning a floating CTA after the timeline.',
    'If the DOM places the process CTA immediately after the timeline container, still treat it as footerCta; force it into the timeline payload rather than emitting a new component.',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Our Journey',
    subtitle: 'Key milestones in our company history',
    events: [],
    layout: 'vertical',
    showConnectors: true,
    dateFormat: 'MMM YYYY',
    showIcons: true,
    animated: true,
    footerCta: {
      label: 'Join Our Team',
      href: '/careers',
      variant: 'primary',
    },
  },

  // Human-readable description
  description: 'Chronological timeline of events with titles, dates, descriptions, and optional icons.',
})

// Export inferred TypeScript type
export type TimelineContent = z.infer<typeof TimelineDef.schema>
