/**
 * Type definitions for RelatedPosts component
 * Story 10.12: Blog Components
 */

import { ComponentType, ComponentCategory, CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Author, type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface RelatedPost {
  id: string;
  title: string;
  thumbnail?: Image | string;
  excerpt?: string;
  ctaLabel?: string;
  author?: Author;
  publishDate?: string;
  readingTime?: number;
  categories?: string[];
  href?: string;
  slug: string;
}

export interface RelatedPostsContent extends ComponentContent {
  title?: string;
  posts?: RelatedPost[];
  /**
   * Optional curated posts. When provided, these appear first.
   */
  manualPosts?: RelatedPost[];
  displayMode?: 'grid' | 'list' | 'carousel';
  maxPosts?: number;
  showExcerpt?: boolean;
  showAuthor?: boolean;
  showDate?: boolean;
  showReadingTime?: boolean;
  showCategories?: boolean;
  selectionMode?: 'manual' | 'automatic';
  relatedBy?: 'categories' | 'tags' | 'both';
}

export interface RelatedPostsProps extends CMSComponentProps {
  type: ComponentType.RelatedPosts;
  category: ComponentCategory.Blog;
  content: RelatedPostsContent;
  onPostClick?: (post: RelatedPost) => void;
  columns?: 2 | 3 | 4;
  imageAspectRatio?: '16:9' | '4:3' | '1:1' | '3:2';
}
