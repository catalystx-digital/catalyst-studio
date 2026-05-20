/**
 * Author Bio Component Definition
 *
 * Author bio with photo, social links, stats, expertise, and expandable text.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Social links schema
 */
const SocialLinksSchema = z.object({
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  youtube: z.string().optional(),
}).optional()

/**
 * Author stats schema
 */
const AuthorStatsSchema = z.object({
  articlesCount: z.number().optional(),
  followersCount: z.number().optional(),
  yearsExperience: z.number().optional(),
}).optional()

/**
 * Author Bio component definition
 */
export const AuthorBioDef = defineComponent({
  type: ComponentType.AuthorBio,
  category: ComponentCategory.Blog,


  // Aliases for component type resolution
  aliases: [
    'authorbio',
  ],
  // Zod schema (single source of truth for props)
  schema: z.object({
    name: z.string().describe('Author name'),
    title: z.string().optional().describe('Author job title or role'),
    bio: z.string().describe('Author biography text (supports rich text)'),
    photo: z.string().optional().describe('Author profile photo URL'),
    email: z.string().optional().describe('Author email address'),
    website: z.string().optional().describe('Author personal website URL'),
    socialLinks: SocialLinksSchema.describe('Social media profile links'),
    stats: AuthorStatsSchema.describe('Author statistics and metrics'),
    expertise: z.array(z.string()).optional().describe('Author areas of expertise'),
    expandable: z.boolean().optional().describe('Enable expandable bio text'),
    maxBioLength: z.number().optional().describe('Maximum bio length before truncation'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'author',
      'written by',
      'about the author',
      'bio',
      'profile',
      'author bio',
      'writer',
      'contributor',
      'author info',
      'author profile',
    ],
    patterns: [
      'author.*bio',
      'written.*by',
      'about.*author',
      'author.*profile',
      'author.*info',
      'writer.*bio',
      'contributor.*profile',
    ],
    commonNames: [
      'AuthorBio',
      'AuthorProfile',
      'AuthorInfo',
      'WriterBio',
      'ContributorProfile',
      'AboutAuthor',
    ],
    pageLocation: ['main', 'sidebar', 'footer'],
    confidence: 0.75,
    suggestedVariants: ['default', 'minimal', 'detailed', 'compact'],
    relatedComponents: [
      ComponentType.ArticleHeader,
      ComponentType.BlogPost,
    ],
    industry: ['Publishing', 'Media', 'Technology', 'Business', 'Education'],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Author information',
      role: 'complementary',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use author-bio for author profile sections with photo and social links',
    'Extract: name from author heading or byline',
    'Extract: title from job title or role text',
    'Extract: bio from author description or about text',
    'Extract: photo from author avatar',
    'Extract: socialLinks from social media icons or links',
    'Extract: stats from article count, followers, or experience indicators',
    'Extract: expertise from tags, categories, or skill lists',
  ],

  // Sample content for AI tools and testing
  sample: {
    name: 'Sarah Johnson',
    title: 'Senior Developer & Tech Writer',
    bio: 'Sarah is a full-stack developer with over 10 years of experience building web applications. She specializes in React, Node.js, and cloud architecture. When not coding, she enjoys teaching programming workshops and contributing to open source projects.',
    photo: '/images/authors/sarah.jpg',
    email: 'sarah@example.com',
    website: 'https://sarahjohnson.dev',
    socialLinks: {
      twitter: 'https://twitter.com/sarahj',
      linkedin: 'https://linkedin.com/in/sarahjohnson',
      github: 'https://github.com/sarahj',
    },
    stats: {
      articlesCount: 47,
      followersCount: 2500,
      yearsExperience: 10,
    },
    expertise: ['React', 'Node.js', 'TypeScript', 'Cloud Architecture', 'DevOps'],
    expandable: true,
    maxBioLength: 200,
  },

  // Human-readable description
  description: 'Author bio with photo, social links, stats, expertise, and expandable text.',
})

// Export inferred TypeScript type
export type AuthorBioContent = z.infer<typeof AuthorBioDef.schema>
