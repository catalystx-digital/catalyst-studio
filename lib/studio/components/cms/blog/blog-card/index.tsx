/**
 * BlogCard Component
 * Story 10.12: Blog Components
 * 
 * Individual blog post preview card with thumbnail, excerpt,
 * metadata, and hover effects.
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeText } from '../../_core/security';
import { ComponentCategory, ComponentType } from '../../_core/types';
import {
  CmsBadge,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
  type CmsCardTone,
} from '../../_ui';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { resolveImageSource } from '../../_utils/media-reference';
import { validateImageUrl } from '../../_utils/url-validation';
import { calculateReadingTime, formatReadingTime } from '../utils/reading-time';
import type { BlogCardProps } from './blog-card.types';

type AspectRatioKey = NonNullable<BlogCardProps['imageAspectRatio']>;

const DEFAULT_TONE: CmsCardTone = 'minimal';
const FEATURED_TONE: CmsCardTone = 'accent';
const DEFAULT_CTA_LABEL = 'Read more';

const ASPECT_RATIO_MAP: Record<AspectRatioKey, { ratio: number; width: number; height: number }> =
  {
    '16:9': { ratio: 16 / 9, width: 640, height: 360 },
    '4:3': { ratio: 4 / 3, width: 600, height: 450 },
    '1:1': { ratio: 1, width: 560, height: 560 },
    '3:2': { ratio: 3 / 2, width: 600, height: 400 },
  };

function truncateText(text: string, maxLength: number): string {
  if (!maxLength || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}…`;
}

function formatRelativeDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  const now = new Date();
  const difference = Math.abs(now.getTime() - parsed.getTime());
  const differenceInDays = difference / (1000 * 60 * 60 * 24);

  if (differenceInDays < 1) return 'Today';
  if (differenceInDays < 2) return 'Yesterday';

  const days = Math.floor(differenceInDays);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface StatDefinition {
  key: 'views' | 'likes' | 'comments';
  icon: string;
  label: string;
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { key: 'views', icon: 'Eye', label: 'Views' },
  { key: 'likes', icon: 'Heart', label: 'Likes' },
  { key: 'comments', icon: 'MessageSquare', label: 'Comments' },
];

export const BlogCard: React.FC<BlogCardProps> = ({
  id,
  type = ComponentType.BlogCard,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onClick,
  onInteraction,
  layout = 'grid',
  showReadingTime = true,
  showAuthorAvatar = true,
  showCategories = true,
  showStats = false,
  imageAspectRatio = '3:2',
  truncateExcerpt = 150,
}) => {
  const {
    title,
    excerpt,
    thumbnail,
    author,
    publishDate,
    updatedDate,
    readingTime,
    categories = [],
    tags = [],
    slug,
    featured = false,
    likes = 0,
    comments = 0,
    views = 0,
  } = content;

  const aspectRatio = ASPECT_RATIO_MAP[imageAspectRatio] ?? ASPECT_RATIO_MAP['3:2'];
  const safeThumbnail = resolveImageSource(thumbnail);
  const safeAvatar = validateImageUrl(author?.avatar);

  const sanitizedTitle = useMemo(() => sanitizeText(title), [title]);
  const sanitizedExcerpt = useMemo(() => {
    const clean = sanitizeText(excerpt);
    return truncateText(clean, truncateExcerpt);
  }, [excerpt, truncateExcerpt]);
  const sanitizedAuthorName = useMemo(
    () => sanitizeText(author?.name ?? ''),
    [author?.name],
  );

  const computedReadingTime = useMemo(() => {
    if (readingTime && Number.isFinite(readingTime)) {
      return readingTime;
    }
    return calculateReadingTime(excerpt);
  }, [readingTime, excerpt]);

  const emitInteraction = useCallback(
    (event: 'card-click' | 'cta-click') => {
      onInteraction?.(event, {
        id,
        slug,
        title: sanitizedTitle,
      });
    },
    [id, onInteraction, sanitizedTitle, slug],
  );

  const handleCardClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onClick?.();
      emitInteraction('card-click');
      event.stopPropagation();
    },
    [emitInteraction, onClick],
  );

  const tone: CmsCardTone = featured ? FEATURED_TONE : DEFAULT_TONE;
  const isListLayout = layout === 'list';
  const showMeta =
    sanitizedAuthorName ||
    publishDate ||
    (showReadingTime && computedReadingTime > 0) ||
    showStats;

  const initials = useMemo(() => {
    if (!sanitizedAuthorName) return '';
    return sanitizedAuthorName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join('');
  }, [sanitizedAuthorName]);

  const statEntries = STAT_DEFINITIONS.map((definition) => {
    const value = { views, likes, comments }[definition.key];
    if (typeof value !== 'number' || value <= 0) {
      return null;
    }
    return {
      definition,
      value,
    };
  }).filter(Boolean) as Array<{ definition: StatDefinition; value: number }>;

  return (
    <Card
      id={id}
      data-component-type={type}
      data-component-category={category}
      data-layout={layout}
      role="article"
      aria-labelledby={`${id}-title`}
      className={cn(
        CARD_TONES[tone],
        themeClass(theme),
        'cms-blog-card blog-card group flex h-full overflow-hidden',
        isListLayout ? 'flex-col md:flex-row' : 'flex-col',
        `blog-card--${variant}`,
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick ? handleCardClick : undefined}
    >
      {safeThumbnail ? (
        <div
          className={cn(
            'relative',
            isListLayout ? 'md:w-2/5 md:flex-shrink-0' : '',
          )}
        >
          <AspectRatio
            ratio={aspectRatio.ratio}
            className={cn(
              'rounded-none overflow-hidden',
              isListLayout && 'md:h-full',
            )}
          >
            <Image
              src={safeThumbnail}
              alt={sanitizedTitle}
              width={aspectRatio.width}
              height={aspectRatio.height}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </AspectRatio>
          {featured && (
            <div className="absolute left-4 top-4">
              <CmsBadge variant="accent">
                Featured
              </CmsBadge>
            </div>
          )}
        </div>
      ) : null}

      <CardHeader
        className={cn(
          'flex flex-col gap-2 p-[var(--component-padding)] pb-0',
          themeClass(theme),
          dsSpacing.gap('md'),
          isListLayout && cn(
            'md:flex-1',
            `md:${dsSpacing.padding('2xl')}`,
            `md:${dsSpacing.pb('md')}`,
          ),
        )}
      >
        {!safeThumbnail && featured ? (
          <CmsBadge variant="accent" className="w-fit">
            Featured
          </CmsBadge>
        ) : null}

        {showCategories && categories.length > 0 ? (
          <div className={cn('flex flex-wrap items-center', dsSpacing.gap('sm'))}>
            {categories.slice(0, 3).map((categoryName, index) => (
              <CmsBadge
                key={`${categoryName}-${index}`}
                variant="neutral"
                className="capitalize"
              >
                {sanitizeText(categoryName)}
              </CmsBadge>
            ))}
          </div>
        ) : null}

        <h3
          id={`${id}-title`}
          className={cmsHeading(3, theme, 'line-clamp-2 transition-colors group-hover:text-primary')}
        >
          {sanitizedTitle}
        </h3>

        {sanitizedExcerpt && (
          <p className={cmsBody('md', theme, 'text-muted-foreground line-clamp-3')}>
            {sanitizedExcerpt}
          </p>
        )}
      </CardHeader>

      {showMeta ? (
        <CardContent
          className={cn(
            'flex flex-col p-[var(--component-padding)] pt-0',
            themeClass(theme),
            dsSpacing.gap('md'),
            isListLayout && cn('md:flex-1', `md:${dsSpacing.px('2xl')}`),
          )}
        >
          <div
            className={cn(
              'flex flex-wrap items-center justify-between',
              dsSpacing.gap('lg'),
            )}
          >
            <div className={cn('flex items-center', dsSpacing.gap('sm'))}>
              {showAuthorAvatar ? (
                <Avatar className="h-12 w-12">
                  {safeAvatar ? (
                    <AvatarImage src={safeAvatar} alt={sanitizedAuthorName} />
                  ) : (
                    <AvatarFallback>
                      {initials || resolveCmsIcon('User', { fallback: 'U' })}
                    </AvatarFallback>
                  )}
                </Avatar>
              ) : null}
              <div className="flex flex-col">
                {sanitizedAuthorName ? (
                  <span className={cmsBody('sm', theme, 'font-semibold text-foreground')}>
                    {sanitizedAuthorName}
                  </span>
                ) : null}
                <div
                  className={cmsBody(
                    'xs',
                    theme,
                    cn('flex items-center text-muted-foreground', dsSpacing.gap('xs')),
                  )}
                >
                  {publishDate ? (
                    <time dateTime={publishDate}>{formatRelativeDate(publishDate)}</time>
                  ) : null}
                  {showReadingTime && computedReadingTime > 0 ? (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{formatReadingTime(computedReadingTime)}</span>
                    </>
                  ) : null}
                  {tags.length > 0 ? (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{tags.slice(0, 1).join(', ')}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {showStats && statEntries.length > 0 ? (
              <div
                className={cn(
                  'flex items-center text-sm text-muted-foreground',
                  dsSpacing.gap('lg'),
                )}
                aria-label="Post statistics"
              >
                {statEntries.map(({ definition, value }) => (
                  <span
                    key={definition.key}
                    className={cn('flex items-center', dsSpacing.gap('xs'))}
                  >
                    {resolveCmsIcon(definition.icon, {
                      className: 'h-4 w-4',
                      fallback: '•',
                    })}
                    <span className="font-medium text-foreground">{value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {updatedDate && updatedDate !== publishDate ? (
            <p className={cmsBody('xs', theme, 'text-muted-foreground')}>
              Updated {formatRelativeDate(updatedDate)}
            </p>
          ) : null}
        </CardContent>
      ) : null}

      <CardFooter
        className={cn(
          'flex flex-col items-start gap-3 p-[var(--component-padding)] pt-0',
          themeClass(theme),
          dsSpacing.gap('md'),
          dsSpacing.pt('lg'),
          isListLayout && cn('md:flex-1', `md:${dsSpacing.px('2xl')}`, `md:${dsSpacing.pb('xl')}`),
        )}
      >
        <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
          {tags.slice(0, 4).map((tag, index) => (
            <CmsBadge
              key={`${tag}-${index}`}
              variant="outline"
              className="capitalize"
            >
              {sanitizeText(tag)}
            </CmsBadge>
          ))}
        </div>

        {(slug || onClick) && (
          <Button
            variant={featured ? 'default' : 'secondary'}
            asChild={Boolean(slug)}
            className="w-fit"
            onClick={(event) => {
              event.stopPropagation();
              emitInteraction('cta-click');
            }}
          >
            {slug ? (
              <Link href={slug} aria-label={`Read more about ${sanitizedTitle}`}>
                {DEFAULT_CTA_LABEL}
              </Link>
            ) : (
              DEFAULT_CTA_LABEL
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

const BlogCardWithPerformance = withPerformanceTracking(
  BlogCard,
  ComponentType.BlogCard,
);

export default BlogCardWithPerformance;
