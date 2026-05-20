/**
 * Type definitions for BlogList component
 * Story 10.12: Blog Components
 */

import { ComponentType, ComponentCategory, CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Author, type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  thumbnail?: Image | string;
  author: Author;
  publishDate: string;
  updatedDate?: string;
  readingTime?: number;
  categories: string[];
  tags: string[];
  views?: number;
  likes?: number;
  comments?: number;
  slug: string;
  featured?: boolean;
}

export interface BlogAutoFillConfig {
  /**
   * Controls whether the adapter should request additional posts from a provider.
   */
  enabled?: boolean;
  /**
   * Determines which posts to fetch when auto filling is enabled.
   */
  strategy?: 'latest' | 'category' | 'tag' | 'mixed';
  categories?: string[];
  tags?: string[];
  /**
   * Target total count for the rendered list. Overrides postsPerPage when set.
   */
  desiredCount?: number;
}

export interface BlogListContent extends ComponentContent {
  posts?: BlogPost[];
  /**
   * Explicitly curated entries. When provided, these are pinned to the front of the list.
   */
  manualPosts?: BlogPost[];
  title?: string;
  description?: string;
  viewMode?: 'grid' | 'list';
  columns?: 1 | 2 | 3 | 4;
  showPagination?: boolean;
  postsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
  showFilters?: boolean;
  selectedCategories?: string[];
  selectedTags?: string[];
  sortBy?: 'date' | 'popularity' | 'readingTime';
  sortOrder?: 'asc' | 'desc';
  /**
   * Hint to auto-fill the list when manual posts are missing.
   */
  autoFill?: BlogAutoFillConfig;
}

export interface BlogListProps extends CMSComponentProps {
  type: ComponentType.BlogList;
  category: ComponentCategory.Blog;
  content: BlogListContent;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: FilterOptions) => void;
  onSortChange?: (sortBy: string, sortOrder: string) => void;
  onPostClick?: (post: BlogPost) => void;
}

export interface FilterOptions {
  categories?: string[];
  tags?: string[];
  sortBy?: 'date' | 'popularity' | 'readingTime';
  order?: 'asc' | 'desc';
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}
