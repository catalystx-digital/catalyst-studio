/**
 * Component registration for blog components
 * Story 10.12: Blog Components
 *
 * Registers all blog components with the CMS component factory
 */

import { ComponentType, ComponentCategory } from '../_core/types'
import { detectionToAIMetadata } from '../_core/component-definition'
import { cmsComponentFactory } from '../_factory/factory'
import {
  BlogPostAdapter,
  BlogListAdapter,
  BlogCardAdapter,
  ArticleHeaderAdapter,
  AuthorBioAdapter,
  RelatedPostsAdapter
} from './adapters'
import { BlogPostDef } from './blog-post/blog-post.def'
import { BlogListDef } from './blog-list/blog-list.def'
import { BlogCardDef } from './blog-card/blog-card.def'
import { ArticleHeaderDef } from './article-header/article-header.def'
import { AuthorBioDef } from './author-bio/author-bio.def'
import { RelatedPostsDef } from './related-posts/related-posts.def'

/**
 * Register BlogPost component
 */
cmsComponentFactory.register({
  type: ComponentType.BlogPost,
  category: ComponentCategory.Blog,
  component: BlogPostAdapter,
  metadata: {
    name: 'Blog Post',
    description: BlogPostDef.description || 'Blog post component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['blog', 'article', 'post', 'story'],
    aiMetadata: detectionToAIMetadata(BlogPostDef.detection!, ComponentType.BlogPost)
  },
  schema: BlogPostDef.schema
})

/**
 * Register BlogList component
 */
cmsComponentFactory.register({
  type: ComponentType.BlogList,
  category: ComponentCategory.Blog,
  component: BlogListAdapter,
  metadata: {
    name: 'Blog List',
    description: BlogListDef.description || 'Blog list component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['blog', 'list', 'articles', 'posts', 'archive'],
    aiMetadata: detectionToAIMetadata(BlogListDef.detection!, ComponentType.BlogList)
  },
  schema: BlogListDef.schema
})

/**
 * Register BlogCard component
 */
cmsComponentFactory.register({
  type: ComponentType.BlogCard,
  category: ComponentCategory.Blog,
  component: BlogCardAdapter,
  metadata: {
    name: 'Blog Card',
    description: BlogCardDef.description || 'Blog card component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['blog', 'card', 'article', 'preview', 'post'],
    aiMetadata: detectionToAIMetadata(BlogCardDef.detection!, ComponentType.BlogCard)
  },
  schema: BlogCardDef.schema,
  subOnly: true
})

/**
 * Register ArticleHeader component
 */
cmsComponentFactory.register({
  type: ComponentType.ArticleHeader,
  category: ComponentCategory.Blog,
  component: ArticleHeaderAdapter,
  metadata: {
    name: 'Article Header',
    description: ArticleHeaderDef.description || 'Article header component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['article', 'header', 'title', 'metadata', 'hero'],
    aiMetadata: detectionToAIMetadata(ArticleHeaderDef.detection!, ComponentType.ArticleHeader)
  },
  schema: ArticleHeaderDef.schema
})

/**
 * Register AuthorBio component
 */
cmsComponentFactory.register({
  type: ComponentType.AuthorBio,
  category: ComponentCategory.Blog,
  component: AuthorBioAdapter,
  metadata: {
    name: 'Author Bio',
    description: AuthorBioDef.description || 'Author bio component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['author', 'bio', 'profile', 'writer', 'contributor'],
    aiMetadata: detectionToAIMetadata(AuthorBioDef.detection!, ComponentType.AuthorBio)
  },
  schema: AuthorBioDef.schema
})

/**
 * Register RelatedPosts component
 */
cmsComponentFactory.register({
  type: ComponentType.RelatedPosts,
  category: ComponentCategory.Blog,
  component: RelatedPostsAdapter,
  metadata: {
    name: 'Related Posts',
    description: RelatedPostsDef.description || 'Related posts component',
    version: '1.0.0',
    author: 'Story 10.12',
    tags: ['related', 'posts', 'articles', 'recommendations', 'suggested'],
    aiMetadata: detectionToAIMetadata(RelatedPostsDef.detection!, ComponentType.RelatedPosts)
  },
  schema: RelatedPostsDef.schema
})

// Log successful registration in development
if (process.env.NODE_ENV === 'development') {
  console.log('[Blog Components] Successfully registered blog components:', {
    BlogPost: ComponentType.BlogPost,
    BlogList: ComponentType.BlogList,
    BlogCard: ComponentType.BlogCard,
    ArticleHeader: ComponentType.ArticleHeader,
    AuthorBio: ComponentType.AuthorBio,
    RelatedPosts: ComponentType.RelatedPosts
  })
}
