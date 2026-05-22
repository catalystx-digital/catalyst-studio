'use client';

import React, { useCallback, useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  CmsBadge,
  CmsButtonGroup,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
  resolveTheme,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import { ComponentCategory, ComponentTheme, ComponentType } from '../../_core/types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import { resolveLinkHref } from '../../navigation/footer/footer-link';
import { formatReadingTime } from '../utils/reading-time';
import type { ArticleHeaderProps } from './article-header.types';

type SharePlatform = 'twitter' | 'linkedin' | 'facebook' | 'copy';

type BreadcrumbItem = {
  key: string;
  label: string;
  href?: string;
};

type TaxonomyItem = {
  key: string;
  raw: string;
  label: string;
};

const DEFAULT_READING_TIME_MINUTES = 5;

const SHARE_LABELS: Record<SharePlatform, string> = {
  twitter: 'Share on Twitter',
  linkedin: 'Share on LinkedIn',
  facebook: 'Share on Facebook',
  copy: 'Copy link',
};

const SHARE_ICONS: Record<SharePlatform, string> = {
  twitter: 'Twitter',
  linkedin: 'Linkedin',
  facebook: 'Facebook',
  copy: 'Copy',
};

function formatDisplayDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildBreadcrumbs(breadcrumbs?: ArticleHeaderProps['content']['breadcrumbs']): BreadcrumbItem[] {
  if (!Array.isArray(breadcrumbs)) {
    return [];
  }

  return breadcrumbs.reduce<BreadcrumbItem[]>((acc, crumb, index) => {
    const label = sanitizeText(crumb?.label ?? '');
    const href = resolveLinkHref(crumb?.href);

    if (!label || !href) {
      return acc;
    }

    acc.push({
      key: `${label}-${index}`,
      label,
      href,
    });

    return acc;
  }, []);
}

function buildTaxonomy(items?: string[]): TaxonomyItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items
    .map((raw, index) => ({
      key: `${raw ?? 'item'}-${index}`,
      raw,
      label: sanitizeText(raw ?? ''),
    }))
    .filter((item) => Boolean(item.label));
}

function getInitials(name?: string): string {
  const clean = sanitizeText(name ?? '').trim();
  if (!clean) {
    return '';
  }

  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

function buildShareUrl(platform: SharePlatform, title: string, url: string): string | undefined {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  switch (platform) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    default:
      return undefined;
  }
}

function resolveReadingTime(readingTime?: number): string | undefined {
  const minutes =
    typeof readingTime === 'number' && readingTime > 0
      ? Math.round(readingTime)
      : DEFAULT_READING_TIME_MINUTES;
  return formatReadingTime(minutes);
}

export const ArticleHeader: React.FC<ArticleHeaderProps> = ({
  id,
  type = ComponentType.ArticleHeader,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  onCategoryClick,
  onTagClick,
  onShare,
  showShareButtons = true,
  showBreadcrumbs = true,
  imagePosition = 'below',
}) => {
  const {
    title,
    subtitle,
    author,
    publishDate,
    updatedDate,
    readingTime,
    categories,
    tags,
    featuredImage,
    breadcrumbs,
  } = content;

  const sanitizedTitle = useMemo(() => sanitizeText(title), [title]);
  const sanitizedSubtitle = useMemo(() => sanitizeText(subtitle ?? ''), [subtitle]);
  const breadcrumbItems = useMemo(() => buildBreadcrumbs(breadcrumbs), [breadcrumbs]);
  const categoryItems = useMemo(() => buildTaxonomy(categories), [categories]);
  const tagItems = useMemo(() => buildTaxonomy(tags), [tags]);
  const safeFeaturedImageSrc = validateImageUrl(featuredImage?.src);
  const featuredImageAlt = useMemo(
    () => sanitizeText(featuredImage?.alt ?? sanitizedTitle ?? 'Article image'),
    [featuredImage?.alt, sanitizedTitle],
  );
  const featuredImageCaption = useMemo(() => sanitizeText(featuredImage?.caption ?? ''), [featuredImage?.caption]);
  const featuredImageCredit = useMemo(() => sanitizeText(featuredImage?.credit ?? ''), [featuredImage?.credit]);
  const publishLabel = useMemo(() => formatDisplayDate(publishDate), [publishDate]);
  const updatedLabel = useMemo(() => {
    const formatted = formatDisplayDate(updatedDate);
    if (!formatted || formatted === publishLabel) {
      return undefined;
    }
    return formatted;
  }, [publishDate, updatedDate, publishLabel]);
  const readingTimeLabel = useMemo(
    () => resolveReadingTime(readingTime),
    [readingTime],
  );

  const authorName = useMemo(() => sanitizeText(author?.name ?? ''), [author?.name]);
  const authorTitle = useMemo(() => sanitizeText(author?.title ?? ''), [author?.title]);
  const authorInitials = useMemo(() => getInitials(author?.name), [author?.name]);
  const safeAuthorAvatar = validateImageUrl(author?.avatar);
  const articleSchemaJson = useMemo(() => {
    if (!sanitizedTitle || !publishDate) {
      return null;
    }

    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: sanitizedTitle,
      datePublished: publishDate,
    };

    if (sanitizedSubtitle) {
      schema.description = sanitizedSubtitle;
    }

    if (safeFeaturedImageSrc) {
      schema.image = safeFeaturedImageSrc;
    }

    if (updatedDate) {
      schema.dateModified = updatedDate;
    }

    if (categoryItems.length > 0) {
      schema.articleSection = categoryItems.map((item) => item.label);
    }

    if (tagItems.length > 0) {
      schema.keywords = tagItems.map((item) => item.label);
    }

    if (authorName) {
      const authorSchema: Record<string, unknown> = {
        '@type': 'Person',
        name: authorName,
      };

      if (authorTitle) {
        authorSchema.jobTitle = authorTitle;
      }

      if (safeAuthorAvatar) {
        authorSchema.image = safeAuthorAvatar;
      }

      schema.author = authorSchema;
    }

    return JSON.stringify(schema);
  }, [
    sanitizedTitle,
    sanitizedSubtitle,
    publishDate,
    updatedDate,
    categoryItems,
    tagItems,
    authorName,
    authorTitle,
    safeAuthorAvatar,
    safeFeaturedImageSrc,
  ]);

  type MetaSegment =
    | { key: string; type: 'time'; label: string; dateTime?: string }
    | { key: string; type: 'text'; label: string };

  const metaSegments = useMemo<MetaSegment[]>(() => {
    const segments: MetaSegment[] = [];

    if (publishLabel) {
      segments.push({
        key: 'published',
        type: 'time',
        label: publishLabel,
        dateTime: publishDate,
      });
    }

    if (updatedLabel) {
      segments.push({
        key: 'updated',
        type: 'text',
        label: `Updated ${updatedLabel}`,
      });
    }

    if (readingTimeLabel) {
      segments.push({
        key: 'reading',
        type: 'text',
        label: readingTimeLabel,
      });
    }

    return segments;
  }, [publishLabel, publishDate, updatedLabel, readingTimeLabel]);

  const resolvedTheme = resolveTheme(theme);
  const overlayTheme = imagePosition === 'background' ? 'dark' : resolvedTheme;
  const baseTheme: ComponentTheme = theme ?? 'auto';
  const componentTheme: ComponentTheme = resolvedTheme ?? baseTheme;
  const isBackgroundImage = imagePosition === 'background';
  const overlayPillClasses = isBackgroundImage
    ? 'bg-black/60 text-white hover:bg-black/70'
    : 'bg-muted/60 text-foreground hover:bg-muted/80';
  const overlayBadgeClasses = isBackgroundImage
    ? 'bg-black/55 text-white'
    : undefined;

  const sectionClassName = cn('cms-article-header', className);

  const handleShare = useCallback(
    async (platform: SharePlatform) => {
      onShare?.(platform);

      if (typeof window === 'undefined') {
        return;
      }

      const currentUrl = window.location?.href ?? '';
      if (!currentUrl) {
        return;
      }

      if (platform === 'copy') {
        if (navigator?.clipboard) {
          try {
            await navigator.clipboard.writeText(currentUrl);
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to copy share URL', error);
            }
          }
        }
        return;
      }

      const shareUrl = buildShareUrl(platform, sanitizedTitle || 'Article', currentUrl);
      if (!shareUrl) {
        return;
      }

      window.open(shareUrl, '_blank', 'width=600,height=400');
    },
    [onShare, sanitizedTitle],
  );

  const contentNode = (
    <div className={cn('flex flex-col', dsSpacing.gap('xl'))}>
      {categoryItems.length > 0 && (
        <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
          {categoryItems.map((category) => (
            <Button
              key={category.key}
              type="button"
              size="sm"
              variant={imagePosition === 'background' ? 'secondary' : 'outline'}
              className={cn(
                'rounded-full text-xs font-medium transition-shadow duration-200 hover:shadow-md',
                dsSpacing.px('md'),
                dsSpacing.py('xs'),
                overlayPillClasses,
              )}
              onClick={() => onCategoryClick?.(category.raw)}
            >
              {category.label}
            </Button>
          ))}
        </div>
      )}

      <div className={cn('flex flex-col', dsSpacing.gap('md'))}>
        <h1 className={cn(cmsHeading(1, overlayTheme), isBackgroundImage ? 'drop-shadow-lg' : '')}>
          {sanitizedTitle}
        </h1>
        {sanitizedSubtitle && (
          <p className={cmsBody('lg', overlayTheme, cn(isBackgroundImage ? 'text-foreground drop-shadow-md' : undefined))}>
            {sanitizedSubtitle}
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex flex-col sm:flex-row sm:items-center sm:justify-between',
          dsSpacing.gap('md'),
        )}
      >
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center',
            dsSpacing.gap('md'),
            `sm:${dsSpacing.gap('xl')}`,
          )}
        >
          {(authorName || safeAuthorAvatar) && (
            <div className={cn('flex items-center', dsSpacing.gap('sm'))}>
              {(safeAuthorAvatar || authorInitials) && (
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 transition-transform duration-200  hover:ring-primary/40">
                  {safeAuthorAvatar ? (
                    <AvatarImage src={safeAuthorAvatar} alt={authorName || 'Article author'} />
                  ) : (
                    <AvatarFallback>{authorInitials || 'A'}</AvatarFallback>
                  )}
                </Avatar>
              )}
              <div className={dsSpacing.spaceY('xs')}>
                {authorName && (
                  <p className={cmsBody('md', overlayTheme, 'font-semibold text-foreground')}>
                    {authorName}
                  </p>
                )}
                {authorTitle && (
                  <p className={cmsBody('sm', overlayTheme, isBackgroundImage ? 'text-white/80' : undefined)}>
                    {authorTitle}
                  </p>
                )}
              </div>
            </div>
          )}

          {metaSegments.length > 0 && (
            <div
              className={cn(
                'flex flex-wrap items-center text-sm',
                dsSpacing.gap('sm'),
                isBackgroundImage ? 'text-white/80' : 'text-muted-foreground',
              )}
            >
              {metaSegments.map((segment, index) => {
                const separator = index > 0 ? <span aria-hidden="true">•</span> : null;
                if (segment.type === 'time') {
                  return (
                    <span
                      key={segment.key}
                      className={cn('flex items-center', dsSpacing.gap('xs'))}
                    >
                      {separator}
                      <time dateTime={segment.dateTime}>{segment.label}</time>
                    </span>
                  );
                }
                return (
                  <span
                    key={segment.key}
                    className={cn('flex items-center', dsSpacing.gap('xs'))}
                  >
                    {separator}
                    {segment.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {showShareButtons && imagePosition !== 'background' && (
          <CmsButtonGroup theme={overlayTheme} align="end" responsive="sm">
            {(Object.keys(SHARE_LABELS) as SharePlatform[]).map((platform) => (
              <Button
                key={platform}
                type="button"
                size="icon"
                variant="ghost"
                aria-label={SHARE_LABELS[platform]}
                onClick={() => handleShare(platform)}
                className="rounded-full border border-transparent hover:border-border/80"
              >
                {resolveCmsIcon(SHARE_ICONS[platform], {
                  fallback: platform.slice(0, 1).toUpperCase(),
                  className: 'h-4 w-4',
                })}
              </Button>
            ))}
          </CmsButtonGroup>
        )}
      </div>

      {tagItems.length > 0 && (
        <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
          {tagItems.map((tag) => (
            <Button
              key={tag.key}
              type="button"
              size="sm"
              variant="ghost"
              className="px-0 py-0"
              aria-label={`#${tag.label}`}
              onClick={() => onTagClick?.(tag.raw)}
            >
              <CmsBadge
                variant={imagePosition === 'background' ? 'accent' : 'neutral'}
                theme={overlayTheme}
                className={cn(
                  'flex items-center cursor-pointer select-none',
                  dsSpacing.gap('xs'),
                  overlayBadgeClasses,
                )}
              >
                <span aria-hidden="true">#</span>
                {tag.label}
              </CmsBadge>
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <CmsSection
      as="header"
      id={id}
      size="lg"
      theme={theme}
      className={sectionClassName}
      containerClassName={dsSpacing.gap('xl')}
      data-component-type={type}
      data-component-category={category}
      aria-label="Article header"
    >
      {articleSchemaJson ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: articleSchemaJson }}
          suppressHydrationWarning
        />
      ) : null}
      {showBreadcrumbs && breadcrumbItems.length > 0 && (
        <Breadcrumb aria-label="Breadcrumb">
          <BreadcrumbList>
            {breadcrumbItems.map((crumb, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <BreadcrumbItem key={crumb.key}>
                  {isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href ?? '#'}>{crumb.label}</BreadcrumbLink>
                  )}
                  {!isLast && <BreadcrumbSeparator />}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {imagePosition === 'above' && safeFeaturedImageSrc && (
        <FigureWithMetadata
          theme={resolvedTheme}
          position="above"
          imageSrc={safeFeaturedImageSrc}
          imageAlt={featuredImageAlt}
          caption={featuredImageCaption}
          credit={featuredImageCredit}
        />
      )}

      {imagePosition === 'background' && safeFeaturedImageSrc ? (
        <div
          className="relative overflow-hidden rounded-3xl"
          data-image-position="background"
        >
          <Image
            src={safeFeaturedImageSrc || '/'}
            alt={featuredImageAlt}
            fill
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-background/20" aria-hidden="true" />
          <div
            className={cn(
              'relative z-10',
              dsSpacing.px('lg'),
              dsSpacing.py('2xl'),
              `sm:${dsSpacing.px('xl')}`,
            )}
          >
            {contentNode}
          </div>
          {(featuredImageCaption || featuredImageCredit) && (
            <figcaption
              className={cn(
                'relative z-10 text-center text-xs text-muted-foreground',
                dsSpacing.px('lg'),
                dsSpacing.pb('lg'),
                `sm:${dsSpacing.px('xl')}`,
                themeClass(overlayTheme),
              )}
            >
              <span>{featuredImageCaption}</span>
              {featuredImageCredit && (
                <span className={dsSpacing.ml('sm')}>Credit: {featuredImageCredit}</span>
              )}
            </figcaption>
          )}
        </div>
      ) : (
        <Card className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'shadow-sm')}>
          <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', dsSpacing.gap('xl'), 'pb-0')}>
            {contentNode}
          </CardHeader>
          {safeFeaturedImageSrc && imagePosition === 'below' && (
            <CardContent className={cn('p-[var(--component-padding)]', dsSpacing.pt('lg'))}>
              <FigureWithMetadata
                theme={componentTheme}
                position="below"
                imageSrc={safeFeaturedImageSrc}
                imageAlt={featuredImageAlt}
                caption={featuredImageCaption}
                credit={featuredImageCredit}
              />
            </CardContent>
          )}
        </Card>
      )}

      {imagePosition === 'above' && !safeFeaturedImageSrc && (
        <div className="sr-only" aria-live="polite">
          Article image missing
        </div>
      )}
    </CmsSection>
  );
};

interface FigureWithMetadataProps {
  theme?: ComponentTheme;
  position: 'above' | 'below';
  imageSrc: string;
  imageAlt: string;
  caption?: string;
  credit?: string;
}

const FigureWithMetadata: React.FC<FigureWithMetadataProps> = ({
  theme,
  position,
  imageSrc,
  imageAlt,
  caption,
  credit,
}) => {
  const hasMetadata = Boolean(caption || credit);

  return (
    <figure
      className={cn(
        'cms-article-header__figure flex flex-col',
        dsSpacing.gap('md'),
        position === 'above' ? 'order-first' : 'order-last',
      )}
      data-image-position={position}
    >
      <AspectRatio
        ratio={16 / 9}
        className="rounded-2xl"
      >
        <Image
          src={imageSrc || '/'}
          alt={imageAlt}
          width={1200}
          height={675}
          className="h-full w-full object-cover"
          priority={position === 'above'}
        />
      </AspectRatio>
      {hasMetadata && (
        <figcaption className={cmsBody('sm', theme, 'text-center text-muted-foreground')}>
          {caption && <span>{caption}</span>}
          {credit && (
            <span className={dsSpacing.ml('sm')}>Credit: {credit}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
};

const ArticleHeaderWithPerformance = withPerformanceTracking(ArticleHeader, ComponentType.ArticleHeader);
export default ArticleHeaderWithPerformance;
