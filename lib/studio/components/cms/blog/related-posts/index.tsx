'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import {
  cmsBody,
  cmsHeading,
  CmsBadge,
  CmsSection,
  CARD_TONES,
  resolveTheme,
  dsSpacing,
  themeClass,
  type CmsCardTone,
} from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeText } from '../../_core/security';
import { ComponentCategory, ComponentType } from '../../_core/types';
import { validateImageUrl, validateUrl } from '../../_utils/url-validation';
import { formatReadingTime } from '../utils/reading-time';
import type { RelatedPostsProps, RelatedPost } from './related-posts.types';

const DEFAULT_TITLE = 'Related Articles';
const DEFAULT_CTA_LABEL = 'Read more';
const DEFAULT_CARD_TONE: CmsCardTone = 'minimal';

const IMAGE_DIMENSIONS: Record<
  NonNullable<RelatedPostsProps['imageAspectRatio']>,
  { width: number; height: number }
> = {
  '16:9': { width: 400, height: 225 },
  '4:3': { width: 400, height: 300 },
  '1:1': { width: 400, height: 400 },
  '3:2': { width: 400, height: 267 },
};

const MAX_POSTS = 6;
const MAX_EXCERPT_LENGTH = 100;

const getPostKeyBase = (post: RelatedPost) => {
  const candidates = [
    post.id,
    post.slug,
    (post as { href?: string })?.href,
    post.title && post.publishDate
      ? `${post.title}-${post.publishDate}`
      : undefined,
    post.title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return '';
};

const sanitizeKeySegment = (value: string) => value.replace(/\s+/g, '-');

const formatDate = (date: string): string => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return sanitizeText(date);
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const truncateText = (value: string, maxLength: number): string => {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
};

const resolvePostHref = (post: RelatedPost): string => {
  const rawHref =
    typeof (post as { href?: unknown }).href === 'string'
      ? ((post as { href?: string }).href ?? '').trim()
      : '';
  const slug = typeof post.slug === 'string' ? post.slug.trim() : '';

  const candidate = rawHref || slug;
  if (!candidate) {
    return '#';
  }

  const normalized =
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('/')
      ? candidate
      : `/${candidate.replace(/^\/+/, '')}`;

  return validateUrl(normalized, { fallback: '#' }) || '#';
};

const buildAvatarInitials = (name: string | null): string => {
  if (!name) {
    return '';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .join('')
    .slice(0, 2);
};

type NormalizedPost = {
  original: RelatedPost;
  key: string;
  title: string;
  titleId: string;
  excerpt?: string;
  categories: string[];
  authorName?: string;
  authorAvatar?: string;
  authorInitials: string;
  publishLabel?: string;
  publishDate?: string;
  readingTimeLabel?: string;
  thumbnail?: string;
  href: string;
  ctaLabel: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
};

export const RelatedPosts: React.FC<RelatedPostsProps> = ({
  id,
  type = ComponentType.RelatedPosts,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onPostClick,
  columns = 3,
  imageAspectRatio = '16:9',
}) => {
  const {
    title = DEFAULT_TITLE,
    posts = [],
    displayMode = 'grid',
    maxPosts = MAX_POSTS,
    showExcerpt = true,
    showAuthor = true,
    showDate = true,
    showReadingTime = true,
    showCategories = false,
    selectionMode = 'automatic',
    relatedBy = 'both',
  } = content;

  const sanitizedTitle = useMemo(() => sanitizeText(title), [title]);
  const normalizedPosts = Array.isArray(posts) ? posts : [];

  const displayPosts = useMemo(
    () => normalizedPosts.slice(0, Math.min(maxPosts ?? MAX_POSTS, MAX_POSTS)),
    [normalizedPosts, maxPosts],
  );

  const postKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    displayPosts.forEach((post) => {
      const base = getPostKeyBase(post);
      if (!base) {
        return;
      }
      counts.set(base, (counts.get(base) ?? 0) + 1);
    });
    return counts;
  }, [displayPosts]);

  const imageDimensions =
    IMAGE_DIMENSIONS[imageAspectRatio] ?? IMAGE_DIMENSIONS['16:9'];
  const aspectRatio =
    imageDimensions.width > 0 && imageDimensions.height > 0
      ? imageDimensions.width / imageDimensions.height
      : IMAGE_DIMENSIONS['16:9'].width / IMAGE_DIMENSIONS['16:9'].height;

  const cards: NormalizedPost[] = useMemo(() => {
    return displayPosts.map((post, index) => {
      const base = getPostKeyBase(post);
      const uniqueSegment = base
        ? sanitizeKeySegment(base)
        : `index-${index ?? 0}`;
      const needsIndexSuffix = base && (postKeyCounts.get(base) ?? 0) > 1;
      const cardKey = `related-${uniqueSegment}${
        needsIndexSuffix ? `-${index}` : ''
      }`;
      const titleId = `${cardKey}-title`;

      const sanitizedPostTitle = sanitizeText(post.title) || DEFAULT_TITLE;
      const safeExcerpt =
        showExcerpt && displayMode !== 'list' && post.excerpt
          ? sanitizeText(truncateText(post.excerpt, MAX_EXCERPT_LENGTH))
          : undefined;

      const safeCategories =
        showCategories && Array.isArray(post.categories)
          ? post.categories
              .slice(0, 3)
              .map((category) => sanitizeText(category))
              .filter(Boolean)
          : [];

      const authorName =
        showAuthor && post.author?.name
          ? sanitizeText(post.author.name)
          : undefined;
      const authorAvatar =
        showAuthor && post.author?.avatar
          ? validateImageUrl(post.author.avatar)
          : undefined;

      const publishLabel =
        showDate && post.publishDate ? formatDate(post.publishDate) : undefined;

      const readingTimeLabel =
        showReadingTime && post.readingTime
          ? formatReadingTime(post.readingTime)
          : undefined;

      const thumbnail = validateImageUrl(post.thumbnail);
      const href = resolvePostHref(post);
      const ctaLabel =
        sanitizeText((post as { ctaLabel?: string }).ctaLabel ?? '') ||
        DEFAULT_CTA_LABEL;

      return {
        original: post,
        key: cardKey,
        title: sanitizedPostTitle,
        titleId,
        excerpt: safeExcerpt,
        categories: safeCategories,
        authorName,
        authorAvatar,
        authorInitials: buildAvatarInitials(authorName ?? ''),
        publishLabel,
        publishDate: post.publishDate,
        readingTimeLabel,
        thumbnail,
        href,
        ctaLabel,
        imageWidth: imageDimensions.width,
        imageHeight: imageDimensions.height,
        aspectRatio,
      };
    });
  }, [
    aspectRatio,
    displayPosts,
    imageDimensions.height,
    imageDimensions.width,
    postKeyCounts,
    showAuthor,
    showCategories,
    showDate,
    showExcerpt,
    showReadingTime,
  ]);

  const gridClasses = useMemo(() => {
    if (displayMode === 'list') {
      return cn('flex flex-col', dsSpacing.gap('lg'));
    }

    const columnClasses: Record<number, string> = {
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };

    return cn(
      'grid',
      dsSpacing.gap('lg'),
      columnClasses[columns] ?? columnClasses[3],
    );
  }, [columns, displayMode]);

  const resolvedTheme = resolveTheme(theme);

  const sectionClassName = cn(
    'cms-related-posts',
    `related-posts related-posts--${variant}`,
    className,
  );

  if (cards.length === 0) {
    return null;
  }

  const renderMeta = (card: NormalizedPost) => {
    const segments: React.ReactNode[] = [];

    if (card.authorName) {
      segments.push(
        <span
          key="author"
          className={cmsBody(
            'sm',
            resolvedTheme,
            cn('flex items-center', dsSpacing.gap('xs')),
          )}
        >
          <Avatar className="h-8 w-8 ring-1 ring-primary/20 transition-transform duration-200">
            {card.authorAvatar ? (
              <AvatarImage
                src={card.authorAvatar}
                alt={card.authorName}
              />
            ) : (
              <AvatarFallback>
                {card.authorInitials || card.authorName?.charAt(0) || 'A'}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="font-medium">{card.authorName}</span>
        </span>,
      );
    }

    if (card.publishLabel && card.publishDate) {
      segments.push(
        <span key="date" className={cmsBody('sm', resolvedTheme, 'text-muted-foreground font-medium')}>
          <time dateTime={card.publishDate}>{card.publishLabel}</time>
        </span>,
      );
    }

    if (card.readingTimeLabel) {
      segments.push(
        <span key="reading" className={cmsBody('sm', resolvedTheme, 'text-muted-foreground font-medium')}>
          {card.readingTimeLabel}
        </span>,
      );
    }

    if (segments.length === 0) {
      return null;
    }

    return (
      <div
        className={cn(
          'flex flex-wrap items-center text-muted-foreground',
          dsSpacing.gap('sm'),
        )}
      >
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span aria-hidden="true" className="text-border-default/60">
                •
              </span>
            )}
            {segment}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const handlePostClick = (post: RelatedPost) => {
    onPostClick?.(post);
  };

  const renderCard = (card: NormalizedPost, isCarousel = false) => {
    const isList = displayMode === 'list';

    return (
      <Card
        key={card.key}
        id={card.original.id}
        role="article"
        aria-labelledby={card.titleId}
        data-component-type={type}
        data-component-category={category}
        className={cn(
          CARD_TONES[DEFAULT_CARD_TONE],
          themeClass(resolvedTheme),
          'cms-related-post-card group h-full overflow-hidden transition-shadow duration-300',
          isList
            ? 'flex flex-col md:flex-row md:items-stretch'
            : 'flex flex-col',
          isCarousel
            ? 'w-72 flex-shrink-0 snap-start'
            : 'focus-within:shadow-md',
          'related-posts__item',
        )}
        onClick={() => handlePostClick(card.original)}
      >
        {card.thumbnail && (
          <div
            className={cn(
              'relative',
              isList
                ? cn(
                    'md:w-60 md:flex-shrink-0',
                    `md:${dsSpacing.padding('xl')}`,
                    'md:pr-0',
                  )
                : cn(dsSpacing.padding('xl'), 'pb-0'),
            )}
          >
            <AspectRatio
              ratio={card.aspectRatio}
              className="overflow-hidden rounded-lg bg-muted/40 shadow-sm"
            >
              <Image
                src={card.thumbnail}
                alt={card.title}
                width={card.imageWidth}
                height={card.imageHeight}
                className="h-full w-full object-cover transition-transform duration-500"
                loading="lazy"
              />
            </AspectRatio>
          </div>
        )}

        <div className="flex flex-1 flex-col">
          <CardHeader
            className={cn(
              'flex flex-col gap-2 p-[var(--component-padding)]',
              themeClass(resolvedTheme),
              dsSpacing.gap('md'),
              card.thumbnail
                ? cn(dsSpacing.padding('xl'), 'pb-0')
                : dsSpacing.padding('xl'),
              isList && card.thumbnail
                ? cn(`md:${dsSpacing.pl('xl')}`, `md:${dsSpacing.pr('xl')}`, `md:${dsSpacing.pt('xl')}`)
                : '',
            )}
          >
            {card.categories.length > 0 && (
              <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
                {card.categories.map((categoryItem, categoryIndex) => (
                  <CmsBadge
                    key={`${card.key}-category-${categoryIndex}`}
                    variant="outline"
                  >
                    {categoryItem}
                  </CmsBadge>
                ))}
              </div>
            )}
            <CardTitle
              id={card.titleId}
              className={cmsHeading(
                isList ? 5 : 4,
                resolvedTheme,
                'line-clamp-2 font-bold tracking-tight transition-colors duration-200 group-hover:text-primary',
              )}
            >
              {card.title}
            </CardTitle>
          </CardHeader>

          {card.excerpt && (
            <CardContent
              className={cn(
                'p-[var(--component-padding)] pt-0',
                themeClass(resolvedTheme),
                dsSpacing.pt('lg'),
                isList && card.thumbnail ? `md:${dsSpacing.px('xl')}` : '',
              )}
            >
              <p className={cmsBody('sm', resolvedTheme, 'line-clamp-2 text-balance')}>
                {card.excerpt}
              </p>
            </CardContent>
          )}

          <CardFooter
            className={cn(
              'mt-auto flex flex-wrap items-center justify-between gap-3 p-[var(--component-padding)] pt-0',
              themeClass(resolvedTheme),
              dsSpacing.gap('md'),
              dsSpacing.pt('lg'),
              card.thumbnail ? cn(dsSpacing.px('xl'), dsSpacing.pb('xl')) : '',
            )}
          >
            {renderMeta(card)}
            <Button
              variant="secondary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handlePostClick(card.original);
              }}
              asChild={card.href !== '#'}
            >
              {card.href !== '#' ? (
                <Link
                  href={card.href}
                  aria-label={`Read ${card.title}`}
                  className="no-underline"
                  prefetch={false}
                >
                  {card.ctaLabel}
                </Link>
              ) : (
                card.ctaLabel
              )}
            </Button>
          </CardFooter>
        </div>
      </Card>
    );
  };

  const renderCarousel = () => (
    <div className="relative">
      <div
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto',
          dsSpacing.gap('md'),
          dsSpacing.pb('sm'),
        )}
      >
        {cards.map((card) => renderCard(card, true))}
      </div>
    </div>
  );

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      containerClassName={cn('flex flex-col', dsSpacing.gap('lg'))}
      data-theme={resolvedTheme}
      data-variant={variant}
      data-component-type={type}
      data-component-category={category}
      role="complementary"
      aria-label="Related articles"
    >
      <header className={cn('px-1', dsSpacing.spaceY('sm'))}>
        <h2 className={cmsHeading(3, resolvedTheme)}>{sanitizedTitle}</h2>
        {selectionMode === 'automatic' && (
          <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
            {relatedBy === 'categories'
              ? 'Based on similar categories'
              : relatedBy === 'tags'
              ? 'Based on similar tags'
              : 'Based on similar categories and tags'}
          </p>
        )}
      </header>

      <div
        className="related-posts__content"
        data-display-mode={displayMode}
      >
        {displayMode === 'carousel' ? (
          renderCarousel()
        ) : (
          <div className={gridClasses}>
            {cards.map((card) => renderCard(card))}
          </div>
        )}
      </div>
    </CmsSection>
  );
};

const RelatedPostsWithPerformance = withPerformanceTracking(
  RelatedPosts,
  ComponentType.RelatedPosts,
);

export default RelatedPostsWithPerformance;
