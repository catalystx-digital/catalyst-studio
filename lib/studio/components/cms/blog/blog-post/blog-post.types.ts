/**
 * Type definitions for BlogPost component
 * Story 10.12: Blog Components
 */

import {
  ComponentCategory,
  ComponentContent,
  ComponentType,
  CMSComponentProps
} from '../../_core/types'
import { type Link, type Image } from '../../_core/value-objects'

export interface BlogPostAuthor {
  name?: string
  title?: string
  image?: Image | string
  bio?: string
  url?: Link | string
}

export interface BlogPostHeroImage {
  src?: string
  alt?: string
  caption?: string
  credit?: string
  dominantColor?: string
}

export interface BlogPostContent extends Omit<ComponentContent, 'body'> {
  title?: string
  subtitle?: string
  excerpt?: string
  bodyHtml?: string
  bodyText?: string
  sourceUrl?: string
  publishDate?: string
  updatedDate?: string
  readingTime?: string
  tags?: string[]
  categories?: string[]
  heroImage?: BlogPostHeroImage
  author?: BlogPostAuthor
  relatedLinks?: Array<{ label: string; url: Link | string }>
  attachments?: Array<{ label: string; url: Link | string }>
  metadata?: Record<string, unknown>
}

export interface BlogPostProps extends Omit<CMSComponentProps, 'content'> {
  type: ComponentType.BlogPost
  category: ComponentCategory.Blog
  content: BlogPostContent
  showAuthor?: boolean
  showShareActions?: boolean
  shareActions?: Array<{ label: string; icon?: string; url: Link | string }>
}
