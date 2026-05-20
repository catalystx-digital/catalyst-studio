/**
 * Team Member Component Definition
 *
 * Detailed team member profile with bio, experience, education, and social links.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema, EducationEntrySchema, ExperienceEntrySchema } from '../../_core/value-objects'

/**
 * Team Member component definition
 */
export const TeamMemberDef = defineComponent({
  type: ComponentType.TeamMember,
  category: ComponentCategory.About,

  schema: z.object({
    name: z.string().describe('Team member full name'),
    title: z.string().describe('Job title or role'),
    department: z.string().optional().describe('Department or team'),
    photo: ImageSchema.optional().describe('Profile photo'),
    bio: z.string().describe('Biography or description (rich text)'),
    email: z.string().optional().describe('Contact email address'),
    phone: z.string().optional().describe('Contact phone number'),
    linkedin: z.string().optional().describe('LinkedIn profile URL'),
    twitter: z.string().optional().describe('Twitter profile URL'),
    facebook: z.string().optional().describe('Facebook profile URL'),
    instagram: z.string().optional().describe('Instagram profile URL'),
    github: z.string().optional().describe('GitHub profile URL'),
    skills: z.array(z.string()).optional().describe('List of skills or specializations'),
    education: z.array(EducationEntrySchema).optional().describe('Educational background'),
    experience: z.array(ExperienceEntrySchema).optional().describe('Work experience history'),
    achievements: z.array(z.string()).optional().describe('Notable achievements or awards'),
    displayMode: z.enum(['full', 'compact', 'modal']).optional().describe('Display mode for the profile'),
  }),

  detection: {
    keywords: [
      'team member',
      'staff member',
      'employee',
      'profile',
      'bio',
    ],
    patterns: [
      'team.*member',
      'staff.*profile',
      'employee.*card',
    ],
    commonNames: [
      'team member',
      'employee profile',
      'staff card',
    ],
    pageLocation: ['main'],
    confidence: 0.9,
    relatedComponents: [
      ComponentType.TeamGrid,
      ComponentType.AboutSection,
    ],
    industry: ['general', 'corporate', 'public-sector'],
    semanticRole: 'article',
  },

  directives: [
    'Extract: name from h3/h4 or strong text in profile card',
    'Extract: title from subtitle or role label below name',
    'Extract: department from department label or tag',
    'Extract: bio from paragraph text in profile',
    'Extract: social links from icon links or labeled URLs',
    'Extract: skills from tags or comma-separated lists',
    'NESTED: Often used within team-grid component',
    'Display: Use compact mode in grids, full mode on profile pages',
  ],

  sample: {
    name: 'Jane Smith',
    title: 'Chief Technology Officer',
    department: 'Engineering',
    bio: '<p>Jane leads our engineering team with over 15 years of experience in software development and architecture.</p>',
    email: 'jane.smith@company.com',
    linkedin: 'https://linkedin.com/in/janesmith',
    twitter: 'https://twitter.com/janesmith',
    skills: ['Leadership', 'Software Architecture', 'Cloud Computing', 'Team Building'],
    education: [
      {
        institution: 'MIT',
        degree: 'Master of Science',
        field: 'Computer Science',
        year: '2008',
      },
    ],
    experience: [
      {
        company: 'Tech Corp',
        title: 'Senior Engineer',
        startDate: '2015',
        endDate: '2020',
        description: 'Led development of cloud infrastructure platform',
      },
    ],
    achievements: [
      'Tech Innovator Award 2022',
      'Published author on software architecture',
    ],
    displayMode: 'full',
  },

  description: 'Detailed team member profile with bio, experience, education, and social links.',
})

export type TeamMemberContent = z.infer<typeof TeamMemberDef.schema>
