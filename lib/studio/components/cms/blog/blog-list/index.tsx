/**
 * BlogList Component
 * Story 10.12: Blog Components
 * 
 * Displays a collection of blog posts with grid/list layouts,
 * pagination, filtering, and sorting capabilities.
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeText } from '../../_core/security';
import { ComponentCategory, ComponentType } from '../../_core/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CmsBadge,
  CmsButtonGroup,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
  themeClass,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import type { BlogCardProps } from '../blog-card/blog-card.types';
import { BlogCard } from '../blog-card';
import type { BlogListProps, BlogPost, FilterOptions } from './blog-list.types';

const SORT_OPTIONS: Array<{
  value: `${NonNullable<FilterOptions['sortBy']>}-${NonNullable<FilterOptions['order']>}`;
  label: string;
}> = [
  { value: 'date-desc', label: 'Latest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'popularity-desc', label: 'Most popular' },
  { value: 'readingTime-asc', label: 'Quick reads' },
  { value: 'readingTime-desc', label: 'Long reads' },
];

function filterPosts(posts: BlogPost[], filters: FilterOptions): BlogPost[] {
  const filtered = posts.filter((post) => {
    const postCategories = Array.isArray(post.categories) ? post.categories : [];
    const postTags = Array.isArray(post.tags) ? post.tags : [];
    const matchesCategory =
      !filters.categories?.length ||
      filters.categories.some((category) => postCategories.includes(category));
    const matchesTags =
      !filters.tags?.length ||
      filters.tags.some((tag) => postTags.includes(tag));
    return matchesCategory && matchesTags;
  });

  const orderMultiplier = filters.order === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'popularity':
        return ((a.views ?? 0) - (b.views ?? 0)) * orderMultiplier;
      case 'readingTime':
        return ((a.readingTime ?? 0) - (b.readingTime ?? 0)) * orderMultiplier;
      case 'date':
      default: {
        const aDate = new Date(a.publishDate).getTime();
        const bDate = new Date(b.publishDate).getTime();
        return (aDate - bDate) * orderMultiplier;
      }
    }
  });
}

function toBlogCardProps(
  post: BlogPost,
  overrides: Partial<BlogCardProps> = {},
): BlogCardProps {
  return {
    id: `blog-card-${post.id}`,
    type: ComponentType.BlogCard,
    category: ComponentCategory.Blog,
    content: {
      title: post.title,
      excerpt: post.excerpt,
      thumbnail: post.thumbnail,
      author: post.author,
      publishDate: post.publishDate,
      updatedDate: post.updatedDate,
      readingTime: post.readingTime,
      categories: post.categories,
      tags: post.tags,
      slug: post.slug,
      featured: post.featured,
      likes: post.likes,
      views: post.views,
      comments: post.comments,
    },
    ...overrides,
  };
}

function getGridClasses(columns: NonNullable<BlogListProps['content']['columns']>) {
  const columnClasses: Record<typeof columns, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return cn(
    'grid',
    dsSpacing.gap('lg'),
    `lg:${dsSpacing.gap('xl')}`,
    columnClasses[columns] ?? columnClasses[3],
  );
}

function getPostKey(post: BlogPost, index: number): string {
  const stableId = post.id || post.slug || post.title;
  return stableId ? `${stableId}-${index}` : `post-${index}`;
}

export const BlogList: React.FC<BlogListProps> = ({
  id,
  type = ComponentType.BlogList,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onPageChange,
  onFilterChange,
  onSortChange,
  onPostClick,
  onInteraction,
}) => {
  const {
    posts = [],
    title,
    description,
    viewMode = 'grid',
    columns = 3,
    showPagination = true,
    postsPerPage = 9,
    currentPage: initialPage = 1,
    showFilters = false,
    selectedCategories = [],
    selectedTags = [],
    sortBy = 'date',
    sortOrder = 'desc',
  } = content;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: selectedCategories,
    tags: selectedTags,
    sortBy,
    order: sortOrder,
  });

  const filteredPosts = useMemo(
    () => filterPosts(posts, filters),
    [posts, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * postsPerPage;
    return filteredPosts.slice(startIndex, startIndex + postsPerPage);
  }, [filteredPosts, currentPage, postsPerPage]);

  const availableCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    posts.forEach((post) => {
      const categories = Array.isArray(post.categories) ? post.categories : [];
      categories.forEach((category) => {
        if (category) {
          categoriesSet.add(category);
        }
      });
    });
    return Array.from(categoriesSet);
  }, [posts]);

  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    posts.forEach((post) => {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      tags.forEach((tag) => {
        if (tag) {
          tagsSet.add(tag);
        }
      });
    });
    return Array.from(tagsSet);
  }, [posts]);

  const emitInteraction = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      onInteraction?.(event, {
        id,
        ...payload,
      });
    },
    [id, onInteraction],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) {
        return;
      }
      setCurrentPage(page);
      onPageChange?.(page);
      emitInteraction('page-change', { page });
    },
    [emitInteraction, onPageChange, totalPages],
  );

  const updateFilters = useCallback(
    (partial: Partial<FilterOptions>) => {
      setFilters((previous) => {
        const updated = { ...previous, ...partial };
        onFilterChange?.(updated);
        emitInteraction('filter-change', updated);
        return updated;
      });
      setCurrentPage(1);
    },
    [emitInteraction, onFilterChange],
  );

  const handleSortChange = useCallback(
    (value: string) => {
      const [sortValue, orderValue] = value.split('-') as [
        FilterOptions['sortBy'],
        FilterOptions['order'],
      ];
      updateFilters({
        sortBy: sortValue ?? 'date',
        order: orderValue ?? 'desc',
      });
      onSortChange?.(sortValue ?? 'date', orderValue ?? 'desc');
    },
    [onSortChange, updateFilters],
  );

  const handleCategoryToggle = useCallback(
    (categoryValue: string) => {
      const existing = new Set(filters.categories ?? []);
      if (existing.has(categoryValue)) {
        existing.delete(categoryValue);
      } else {
        existing.add(categoryValue);
      }
      updateFilters({ categories: Array.from(existing) });
    },
    [filters.categories, updateFilters],
  );

  const handleTagToggle = useCallback(
    (tagValue: string) => {
      const existing = new Set(filters.tags ?? []);
      if (existing.has(tagValue)) {
        existing.delete(tagValue);
      } else {
        existing.add(tagValue);
      }
      updateFilters({ tags: Array.from(existing) });
    },
    [filters.tags, updateFilters],
  );

  const handlePostSelect = useCallback(
    (post: BlogPost) => {
      onPostClick?.(post);
      emitInteraction('post-click', { postId: post.id, slug: post.slug });
    },
    [emitInteraction, onPostClick],
  );

  const gridClasses =
    viewMode === 'grid'
      ? getGridClasses(columns)
      : cn('flex flex-col', dsSpacing.gap('lg'));

  const resolvedTheme = resolveTheme(theme);

  const sectionClassName = cn(
    'cms-blog-list blog-list flex w-full flex-col',
    className,
    variant ? `blog-list--${variant}` : undefined,
  );

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      containerClassName={dsSpacing.gap('xl')}
      data-component-type={type}
      data-component-category={category}
      aria-label="Blog posts list"
    >
      {(title || description) && (
        <header className={cn('flex flex-col', dsSpacing.gap('sm'))}>
          {title ? (
            <h2 className={cmsHeading(2, resolvedTheme, 'text-balance')}>
              {sanitizeText(title)}
            </h2>
          ) : null}
          {description ? (
            <p className={cmsBody('md', resolvedTheme, 'max-w-3xl text-muted-foreground')}>
              {sanitizeText(description)}
            </p>
          ) : null}
        </header>
      )}

      {/* Theme is set on CmsSection parent - children inherit via CSS cascade */}
      {showFilters && (
        <Card className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'border-border/40 shadow-sm')}>
          <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', dsSpacing.gap('lg'), 'pb-4')}>
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Refine results
            </CardTitle>
          </CardHeader>
          <CardContent className={cn('p-[var(--component-padding)] pt-0', 'flex flex-col', dsSpacing.gap('md'))}>
            <div
              className={cn(
                'flex flex-wrap items-center',
                dsSpacing.gap('lg'),
              )}
            >
              <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                <span className={cmsBody('sm', undefined, 'font-semibold text-foreground')}>
                  Sort by
                </span>
                <Select
                  value={`${filters.sortBy ?? 'date'}-${filters.order ?? 'desc'}`}
                  onValueChange={handleSortChange}
                >
                  <SelectTrigger aria-label="Sort blog posts">
                    <SelectValue placeholder="Select sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {availableCategories.length > 0 && (
                <div className={cn('flex flex-1 flex-col', dsSpacing.gap('xs'))}>
                  <span className={cmsBody('sm', undefined, 'font-semibold text-foreground')}>
                    Categories
                  </span>
                  <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
                    {availableCategories.map((categoryName) => {
                      const isSelected = filters.categories?.includes(categoryName);
                      return (
                        <Button
                          key={categoryName}
                          type="button"
                          variant={isSelected ? 'default' : 'secondary'}
                          size="sm"
                          className={cn(
                            'rounded-full text-xs capitalize transition-colors duration-200',
                            dsSpacing.px('md'),
                            dsSpacing.py('xs'),
                          )}
                          onClick={() => handleCategoryToggle(categoryName)}
                        >
                          {sanitizeText(categoryName)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {availableTags.length > 0 && (
              <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                <span className={cmsBody('sm', undefined, 'font-semibold text-foreground')}>
                  Tags
                </span>
                <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
                  {availableTags.map((tagName) => {
                    const isSelected = filters.tags?.includes(tagName);
                    return (
                      <CmsBadge
                        key={tagName}
                        variant={isSelected ? 'accent' : 'neutral'}
                        className={cn(
                          'cursor-pointer capitalize transition-colors duration-200',
                          !isSelected && 'hover:bg-muted/60',
                        )}
                        onClick={() => handleTagToggle(tagName)}
                        role="switch"
                        aria-checked={isSelected}
                      >
                        {sanitizeText(tagName)}
                      </CmsBadge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div
        className={gridClasses}
        data-view-mode={viewMode}
        role="feed"
        aria-live="polite"
      >
        {paginatedPosts.map((post, index) => (
          <BlogCard
            key={getPostKey(post, index)}
            {...toBlogCardProps(post, {
              theme: resolvedTheme,
              variant,
              layout: viewMode === 'list' ? 'list' : 'grid',
              onClick: () => handlePostSelect(post),
            })}
          />
        ))}
        {paginatedPosts.length === 0 && (
          <Card className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'border-dashed border-border/50 shadow-sm')}>
            <CardContent className={cn('p-[var(--component-padding)]', 'text-center', dsSpacing.py('2xl'))}>
              <p className={cmsBody('md', undefined, 'text-muted-foreground')}>
                No posts match the selected filters yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {showPagination && totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className={cn('flex flex-col items-center', dsSpacing.gap('md'))}
        >
          <CmsButtonGroup className={dsSpacing.gap('sm')}>
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, index) => {
              const page = index + 1;
              const isCurrent = page === currentPage;
              return (
                <Button
                  key={`page-${page}`}
                  variant={isCurrent ? 'default' : 'secondary'}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
            </Button>
          </CmsButtonGroup>
          <span className={cmsBody('xs', undefined, 'text-muted-foreground')}>
            Page {currentPage} of {totalPages}
          </span>
        </nav>
      )}
    </CmsSection>
  );
};

const BlogListWithPerformance = withPerformanceTracking(
  BlogList,
  ComponentType.BlogList,
);

export default BlogListWithPerformance;
