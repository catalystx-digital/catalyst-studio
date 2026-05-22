/**
 * Adapter components for blog components
 * Story 10.12: Blog Components
 *
 * These adapters convert generic CMSComponentProps to specific component props
 * following the pattern established in Story 10.5.
 */

import React from 'react'
import { ComponentType, ComponentCategory } from '../_core/types'
import type { CMSComponentProps } from '../_core/types'
import BlogPostWithPerformance from './blog-post'
import BlogListWithPerformance from './blog-list'
import BlogCardWithPerformance from './blog-card'
import ArticleHeaderWithPerformance from './article-header'
import AuthorBioWithPerformance from './author-bio'
import RelatedPostsWithPerformance from './related-posts'
import type { BlogPostProps, BlogPostContent } from './blog-post/blog-post.types'
import type { BlogListProps, BlogListContent } from './blog-list/blog-list.types'
import type { BlogCardProps, BlogCardContent } from './blog-card/blog-card.types'
import type { ArticleHeaderProps, ArticleHeaderContent } from './article-header/article-header.types'
import type { AuthorBioProps, AuthorBioContent } from './author-bio/author-bio.types'
import type { RelatedPostsProps, RelatedPostsContent } from './related-posts/related-posts.types'
import { readRuntimeContent } from '../_core/utils'
import { resolveBlogListContent, resolveRelatedPostsContent } from './utils/content-resolver'

/**
 * BlogPost Adapter Component
 */
export const BlogPostAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<BlogPostContent>(props.content) as BlogPostContent

  const adaptedProps: BlogPostProps = {
    id: props.id,
    type: ComponentType.BlogPost,
    category: ComponentCategory.Blog,
    content,
    className: props.className,
    theme: props.theme || 'auto',
    showAuthor: (props as BlogPostProps).showAuthor,
    showShareActions: (props as BlogPostProps).showShareActions,
    shareActions: (props as BlogPostProps).shareActions,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <BlogPostWithPerformance {...adaptedProps} />
}

/**
 * BlogList Adapter Component
 */
export const BlogListAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<BlogListContent>(props.content) as BlogListContent
  const resolvedContent = resolveBlogListContent(content)

  const adaptedProps: BlogListProps = {
    id: props.id,
    type: ComponentType.BlogList,
    category: ComponentCategory.Blog,
    content: resolvedContent,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <BlogListWithPerformance {...adaptedProps} />
}

/**
 * BlogCard Adapter Component
 */
export const BlogCardAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<BlogCardContent>(props.content) as BlogCardContent

  const adaptedProps: BlogCardProps = {
    id: props.id,
    type: ComponentType.BlogCard,
    category: ComponentCategory.Blog,
    content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'lazy',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <BlogCardWithPerformance {...adaptedProps} />
}

/**
 * ArticleHeader Adapter Component
 */
export const ArticleHeaderAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<ArticleHeaderContent>(props.content) as ArticleHeaderContent

  const adaptedProps: ArticleHeaderProps = {
    id: props.id,
    type: ComponentType.ArticleHeader,
    category: ComponentCategory.Blog,
    content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <ArticleHeaderWithPerformance {...adaptedProps} />
}

/**
 * AuthorBio Adapter Component
 */
export const AuthorBioAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<AuthorBioContent>(props.content) as AuthorBioContent

  const adaptedProps: AuthorBioProps = {
    id: props.id,
    type: ComponentType.AuthorBio,
    category: ComponentCategory.Blog,
    content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'lazy',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <AuthorBioWithPerformance {...adaptedProps} />
}

/**
 * RelatedPosts Adapter Component
 */
export const RelatedPostsAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<RelatedPostsContent>(props.content) as RelatedPostsContent
  const resolvedContent = resolveRelatedPostsContent(content)

  const adaptedProps: RelatedPostsProps = {
    id: props.id,
    type: ComponentType.RelatedPosts,
    category: ComponentCategory.Blog,
    content: resolvedContent,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'lazy',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  }

  return <RelatedPostsWithPerformance {...adaptedProps} />
}
