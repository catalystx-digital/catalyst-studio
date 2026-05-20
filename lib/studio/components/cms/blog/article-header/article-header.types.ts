/**
 * Type definitions for ArticleHeader component
 * Story 10.12: Blog Components
 */

import { ComponentType, ComponentCategory, CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Author, type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface ArticleHeaderContent extends ComponentContent {
  title: string;
  subtitle?: string;
  author: Author;
  publishDate: string;
  updatedDate?: string;
  readingTime?: number;
  categories?: string[];
  tags?: string[];
  featuredImage?: Image;
  shareButtons?: boolean;
  breadcrumbs?: Array<{
    label: string;
    href: string;
  }>;
}

export interface ArticleHeaderProps extends CMSComponentProps {
  type: ComponentType.ArticleHeader;
  category: ComponentCategory.Blog;
  content: ArticleHeaderContent;
  onCategoryClick?: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onShare?: (platform: string) => void;
  showShareButtons?: boolean;
  showBreadcrumbs?: boolean;
  imagePosition?: 'above' | 'below' | 'background';
}
