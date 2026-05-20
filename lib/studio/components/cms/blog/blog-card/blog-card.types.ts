/**
 * Type definitions for BlogCard component
 * Story 10.12: Blog Components
 */

import { ComponentType, ComponentCategory, CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Author, type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface BlogCardContent extends ComponentContent {
  title: string;
  excerpt: string;
  thumbnail?: Image | string;
  author: Author;
  publishDate: string;
  updatedDate?: string;
  readingTime?: number;
  categories?: string[];
  tags?: string[];
  slug: string;
  featured?: boolean;
  likes?: number;
  comments?: number;
  views?: number;
}

export interface BlogCardProps extends CMSComponentProps {
  type: ComponentType.BlogCard;
  category: ComponentCategory.Blog;
  content: BlogCardContent;
  onClick?: () => void;
  layout?: 'grid' | 'list';
  showReadingTime?: boolean;
  showAuthorAvatar?: boolean;
  showCategories?: boolean;
  showStats?: boolean;
  imageAspectRatio?: '16:9' | '4:3' | '1:1' | '3:2';
  truncateExcerpt?: number;
}
