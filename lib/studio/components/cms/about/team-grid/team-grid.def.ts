/**
 * Team Grid Component Definition
 *
 * Grid of team members with photos, titles, and optional department and profile links.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { TeamMemberSchema } from '../../_core/value-objects'

/**
 * Column configuration schema
 */
const ColumnConfigSchema = z.object({
  mobile: z.union([z.literal(1), z.literal(2)]).optional().describe('Columns on mobile'),
  tablet: z.union([z.literal(2), z.literal(3)]).optional().describe('Columns on tablet'),
  desktop: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional().describe('Columns on desktop'),
  large: z.union([z.literal(4), z.literal(5), z.literal(6)]).optional().describe('Columns on large screens'),
})

/**
 * Auto-fill configuration schema
 */
const AutoFillConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Whether to enable auto-fill'),
  desiredCount: z.number().optional().describe('Desired total number of members to display'),
  department: z.string().optional().describe('Filter by department'),
  role: z.string().optional().describe('Filter by role'),
  location: z.string().optional().describe('Filter by location'),
})

/**
 * Team Grid component definition
 */
export const TeamGridDef = defineComponent({
  type: ComponentType.TeamGrid,
  category: ComponentCategory.About,

  schema: z.object({
    heading: z.string().optional().describe('Optional heading for the team grid'),
    subheading: z.string().optional().describe('Optional subheading'),
    members: z.array(TeamMemberSchema).optional().describe('Array of team member components'),
    manualMembers: z.array(TeamMemberSchema).optional().describe('Pinned team members that should always display'),
    columns: ColumnConfigSchema.optional().describe('Responsive column configuration'),
    showDepartment: z.boolean().optional().describe('Whether to show department labels'),
    enableHover: z.boolean().optional().describe('Whether to enable hover effects'),
    linkToProfile: z.boolean().optional().describe('Whether member cards link to profile pages'),
    autoFill: AutoFillConfigSchema.optional().describe('Auto-fill configuration for loading additional members'),
  }),

  detection: {
    keywords: [
      'team',
      'team grid',
      'staff',
      'employees',
      'our team',
      'meet the team',
    ],
    patterns: [
      'team.*grid',
      'staff.*grid',
      'employee.*grid',
    ],
    commonNames: [
      'team grid',
      'staff directory',
      'meet the team',
    ],
    pageLocation: ['main'],
    confidence: 0.85,
    relatedComponents: [
      ComponentType.TeamMember,
      ComponentType.AboutSection,
    ],
    industry: ['general', 'corporate', 'public-sector'],
    semanticRole: 'region',
  },

  directives: [
    'Extract: heading from h2/h3 above team grid',
    'Extract: members from team member cards or profiles',
    'CONTAINER: This component contains team-member components',
    'Columns: Default to 3 columns on desktop, 2 on tablet, 1 on mobile',
    'Auto-fill: Use when partial team list is detected to suggest loading more',
  ],

  sample: {
    heading: 'Our Team',
    subheading: 'Meet the people behind our success',
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      large: 4,
    },
    showDepartment: true,
    enableHover: true,
    linkToProfile: true,
  },

  description: 'Grid of team members with photos, titles, and optional department and profile links.',
})

export type TeamGridContent = z.infer<typeof TeamGridDef.schema>
