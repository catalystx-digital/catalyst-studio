/**
 * BlogPost Component
 * Story 10.12: Blog Components
 *
 * Renders long-form article content with hero media, metadata, and rich body markup.
 */

'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { ComponentCategory, ComponentType } from '../../_core/types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeHtml, sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import { validateImageUrl, validateUrl } from '../../_utils/url-validation';
import { calculateReadingTime, formatReadingTime } from '../utils/reading-time';
import type { BlogPostProps } from './blog-post.types';

function resolveBlogLinkHref(raw: unknown): string | undefined {
  const href = resolveSmartLinkHref(raw);
  if (href) {
    return href;
  }

  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  return resolveSmartLinkHref((raw as { href?: unknown }).href);
}

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

function resolveReadingTime(content: BlogPostProps['content']): string | undefined {
  if (content.readingTime) {
    return sanitizeText(content.readingTime);
  }

  const textSource = content.bodyText || sanitizeText(content.bodyHtml || '') || content.excerpt;
  if (!textSource) return undefined;

  const minutes = calculateReadingTime(textSource);
  if (!minutes || minutes <= 0) return undefined;
  return formatReadingTime(minutes);
}

function sanitizeBody(html?: string): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'figure',
      'figcaption',
      'code',
      'pre',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'loading'],
    ALLOW_DATA_ATTR: false,
  });
}

interface TaxonomyItem {
  key: string;
  label: string;
}

function mapTaxonomy(values?: string[]): TaxonomyItem[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value, index) => ({
      key: `${value ?? 'item'}-${index}`,
      label: sanitizeText(value ?? ''),
    }))
    .filter((item) => Boolean(item.label));
}

const EXCERPT_CARD_TONE: CmsCardTone = 'muted';
const AUTHOR_CARD_TONE: CmsCardTone = 'minimal';

type SharePlatform = 'linkedin' | 'twitter' | 'facebook' | 'copy';

const SHARE_PLATFORM_MAP: Record<string, SharePlatform> = {
  linkedin: 'linkedin',
  Linkedin: 'linkedin',
  twitter: 'twitter',
  Twitter: 'twitter',
  x: 'twitter',
  X: 'twitter',
  facebook: 'facebook',
  Facebook: 'facebook',
};

/**
 * Build a share URL for a given platform using the current page URL
 */
function buildShareUrl(platform: SharePlatform, title: string, pageUrl: string): string {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(pageUrl);

  switch (platform) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    default:
      return '#';
  }
}

const DEFAULT_SHARE_ACTIONS: NonNullable<BlogPostProps['shareActions']> = [
  { label: 'Share on LinkedIn', icon: 'Linkedin', url: 'linkedin' },
  { label: 'Share on X', icon: 'Twitter', url: 'twitter' },
];

const BlogPost: React.FC<BlogPostProps> = ({
  id,
  type = ComponentType.BlogPost,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  variant = 'default',
  showAuthor = true,
  showShareActions = true,
  shareActions,
}) => {
  const {
    title,
    subtitle,
    excerpt,
    bodyHtml,
    heroImage,
    author,
    publishDate,
    updatedDate,
    tags,
    categories,
    relatedLinks,
    attachments,
  } = content;

  const sanitizedTitle = useMemo(() => sanitizeText(title ?? ''), [title]);
  const sanitizedSubtitle = useMemo(() => sanitizeText(subtitle ?? ''), [subtitle]);
  const sanitizedExcerpt = useMemo(() => sanitizeText(excerpt ?? ''), [excerpt]);
  const sanitizedBody = useMemo(() => sanitizeBody(bodyHtml), [bodyHtml]);
  const publishLabel = useMemo(() => formatDisplayDate(publishDate), [publishDate]);
  const updatedLabel = useMemo(() => {
    const formatted = formatDisplayDate(updatedDate);
    if (!formatted || formatted === publishLabel) {
      return undefined;
    }
    return formatted;
  }, [publishDate, updatedDate, publishLabel]);
  const readingTimeLabel = useMemo(() => resolveReadingTime(content), [content]);

  const categoryItems = useMemo(() => mapTaxonomy(categories), [categories]);
  const tagItems = useMemo(() => mapTaxonomy(tags), [tags]);

  const resolvedTheme = resolveTheme(theme);

  const sectionClassName = cn(
    'cms-blog-post flex flex-col',
    className,
    variant ? `blog-post--${variant}` : undefined,
  );

  const safeHeroImage = useMemo(() => {
    const src = validateImageUrl(heroImage?.src);
    if (!src) return undefined;
    return {
      src,
      alt: sanitizeText(heroImage?.alt ?? sanitizedTitle ?? 'Article hero image'),
      caption: sanitizeText(heroImage?.caption ?? ''),
      credit: sanitizeText(heroImage?.credit ?? ''),
    };
  }, [heroImage?.alt, heroImage?.caption, heroImage?.credit, heroImage?.src, sanitizedTitle]);

  const safeAuthorAvatar = validateImageUrl(author?.image);
  const authorName = useMemo(() => sanitizeText(author?.name ?? ''), [author?.name]);
  const authorTitle = useMemo(() => sanitizeText(author?.title ?? ''), [author?.title]);
  const authorBio = useMemo(() => sanitizeText(author?.bio ?? ''), [author?.bio]);
  const authorInitials = useMemo(() => {
    const name = authorName?.trim();
    if (!name) return '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [authorName]);

  const strippedBody = useMemo(() => {
    if (!sanitizedBody || !safeHeroImage?.src) {
      return sanitizedBody;
    }

    const escapeForRegex = (value: string) =>
      value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    const heroSrcPattern = escapeForRegex(safeHeroImage.src);
    const figureRegex = new RegExp(
      `<figure[^>]*>\\s*<img[^>]*src=["']${heroSrcPattern}["'][\\s\\S]*?</figure>`,
      'i',
    );
    if (figureRegex.test(sanitizedBody)) {
      return sanitizedBody.replace(figureRegex, '');
    }

    const imgRegex = new RegExp(
      `<img[^>]*src=["']${heroSrcPattern}["'][^>]*>`,
      'i',
    );
    return sanitizedBody.replace(imgRegex, '');
  }, [sanitizedBody, safeHeroImage?.src]);

  const effectiveShareActions = useMemo(() => {
    if (!showShareActions) {
      return [];
    }

    const actions =
      shareActions && shareActions.length > 0 ? shareActions : DEFAULT_SHARE_ACTIONS;

    const normalized: Array<{
      key: string;
      label: string;
      icon: string | undefined;
      platform: SharePlatform | null;
      staticUrl: string | null;
    }> = [];

    actions.forEach((action, index) => {
      if (!action) {
        return;
      }

      const label = sanitizeText(action.label ?? `Share ${index + 1}`);
      if (!label) {
        return;
      }

      const icon =
        typeof action.icon === 'string' && action.icon.trim().length > 0
          ? action.icon
          : undefined;

      // Check if the URL is a platform identifier or icon name
      const urlOrPlatform = resolveBlogLinkHref(action.url) || icon || '';
      const platform = SHARE_PLATFORM_MAP[urlOrPlatform] ?? null;

      // If it's a full URL (not a platform identifier), use it as static URL
      const isFullUrl = urlOrPlatform.startsWith('http') || urlOrPlatform.startsWith('/');
      const staticUrl = isFullUrl ? validateUrl(urlOrPlatform, { fallback: undefined }) : null;

      normalized.push({
        key: `${label}-${index}`,
        label,
        icon,
        platform,
        staticUrl,
      });
    });

    return normalized;
  }, [shareActions, showShareActions]);

  const handleShareClick = React.useCallback(
    (platform: SharePlatform | null, staticUrl: string | null, label: string) => {
      if (typeof window === 'undefined') return;

      const pageUrl = window.location.href;

      if (staticUrl) {
        window.open(staticUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (platform) {
        const shareUrl = buildShareUrl(platform, sanitizedTitle || 'Article', pageUrl);
        if (shareUrl !== '#') {
          window.open(shareUrl, '_blank', 'width=600,height=400');
        }
      }
    },
    [sanitizedTitle],
  );

  const relatedLinkItems = useMemo(() => {
    if (!Array.isArray(relatedLinks)) {
      return [];
    }

    return relatedLinks
      .map((link, index) => {
        const label = sanitizeText(link?.label ?? '');
        const url = validateUrl(resolveBlogLinkHref(link?.url), { fallback: undefined });
        if (!label) {
          return null;
        }
        if (!url) {
          return null;
        }
        return {
          key: `${label}-${index}`,
          label,
          url,
        };
      })
      .filter((item): item is { key: string; label: string; url: string } => Boolean(item));
  }, [relatedLinks]);

  const attachmentItems = useMemo(() => {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments
      .map((attachment, index) => {
        const label = sanitizeText(attachment?.label ?? '');
        const url = validateUrl(resolveBlogLinkHref(attachment?.url), { fallback: undefined });
        if (!label) {
          return null;
        }
        if (!url) {
          return null;
        }
        return {
          key: `${label}-${index}`,
          label,
          url,
        };
      })
      .filter((item): item is { key: string; label: string; url: string } => Boolean(item));
  }, [attachments]);

  const metaSegments = useMemo(() => {
    const segments: Array<{ key: string; content: React.ReactNode }> = [];

    if (categoryItems.length > 0) {
      segments.push({
        key: 'categories',
        content: (
          <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
            {categoryItems.map((category) => (
              <CmsBadge key={category.key} variant="outline" theme={resolvedTheme}>
                {category.label}
              </CmsBadge>
            ))}
          </div>
        ),
      });
    }

    if (publishLabel || readingTimeLabel) {
      const entries: Array<React.ReactNode> = [];
      if (publishLabel) {
        entries.push(
          <time
            key="published"
            dateTime={publishDate}
            className={cn('flex items-center', dsSpacing.gap('xs'))}
          >
            {publishLabel}
          </time>,
        );
      }
      if (readingTimeLabel) {
        entries.push(
          <span
            key="reading"
            className={cn('flex items-center', dsSpacing.gap('xs'))}
          >
            {readingTimeLabel}
          </span>,
        );
      }
      segments.push({
        key: 'meta',
        content: (
          <div
            className={cn(
              'flex flex-wrap items-center text-sm text-muted-foreground',
              dsSpacing.gap('sm'),
            )}
          >
            {entries.map((entry, index) => (
              <span
                key={index}
                className={cn('flex items-center', dsSpacing.gap('xs'))}
              >
                {index > 0 && <span aria-hidden="true">•</span>}
                {entry}
              </span>
            ))}
          </div>
        ),
      });
    }

    return segments;
  }, [categoryItems, publishDate, publishLabel, readingTimeLabel, resolvedTheme]);

  const articleLabel = sanitizedTitle || sanitizedExcerpt || 'Blog article';

  return (
    <CmsSection
      as="article"
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      containerClassName={cn('flex flex-col', dsSpacing.gap('xl'))}
      data-component-type={type}
      data-component-category={category}
      data-theme={resolvedTheme}
      data-variant={variant}
      aria-label={articleLabel}
    >
      {(safeHeroImage || sanitizedTitle || sanitizedSubtitle) && (
        <header className={cn('flex flex-col', dsSpacing.gap('lg'))}>
          {safeHeroImage && (
            <figure className={cn('flex flex-col', dsSpacing.gap('sm'))}>
              <AspectRatio ratio={16 / 9} className="rounded-3xl overflow-hidden shadow-xl">
                  <Image
                    src={safeHeroImage.src}
                    alt={safeHeroImage.alt}
                    width={1600}
                    height={900}
                    className="h-full w-full object-cover transition-transform duration-500 "
                    loading="lazy"
                  />
                </AspectRatio>
                {(safeHeroImage.caption || safeHeroImage.credit) && (
                  <figcaption className={cmsBody('sm', resolvedTheme, 'text-center text-muted-foreground italic')}>
                    {safeHeroImage.caption && <span>{safeHeroImage.caption}</span>}
                    {safeHeroImage.credit && (
                      <span className={dsSpacing.ml('sm')}>Credit: {safeHeroImage.credit}</span>
                    )}
                  </figcaption>
                )}
              </figure>
            )}

            <div className={cn('flex flex-col', dsSpacing.gap('md'))}>
              {metaSegments.map((segment) => (
                <div key={segment.key}>{segment.content}</div>
              ))}

              {sanitizedTitle && (
                <h1 className={cmsHeading(1, resolvedTheme)}>{sanitizedTitle}</h1>
              )}

              {sanitizedSubtitle && (
                <p className={cmsBody('lg', resolvedTheme)}>{sanitizedSubtitle}</p>
              )}
            </div>
          </header>
        )}

        {(showAuthor || effectiveShareActions.length > 0) && (authorName || authorTitle || safeAuthorAvatar || effectiveShareActions.length > 0) && (
          <Card className={cn(CARD_TONES[AUTHOR_CARD_TONE], themeClass(theme), 'shadow-sm')}>
            <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', dsSpacing.gap('lg'))}>
              <div
                className={cn(
                  'flex flex-col md:flex-row md:items-center md:justify-between',
                  dsSpacing.gap('md'),
                  `md:${dsSpacing.gap('lg')}`,
                )}
              >
                {showAuthor && (authorName || authorTitle || safeAuthorAvatar || authorBio) && (
                  <div
                    className={cn(
                      'flex flex-col md:flex-row md:items-center',
                      dsSpacing.gap('md'),
                      `md:${dsSpacing.gap('lg')}`,
                    )}
                  >
                    {(safeAuthorAvatar || authorInitials) && (
                      <Avatar className="h-16 w-16 ring-2 ring-primary/20 transition-transform duration-200 ">
                        {safeAuthorAvatar ? (
                          <AvatarImage src={safeAuthorAvatar} alt={authorName || 'Article author'} />
                        ) : (
                          <AvatarFallback>{authorInitials || 'A'}</AvatarFallback>
                        )}
                      </Avatar>
                    )}
                    <div className={dsSpacing.spaceY('sm')}>
                      {authorName && (
                        <p className={cmsBody('md', resolvedTheme, 'font-semibold text-foreground')}>
                          {authorName}
                        </p>
                      )}
                      {authorTitle && (
                        <p className={cmsBody('sm', resolvedTheme)}>{authorTitle}</p>
                      )}
                      {authorBio && (
                        <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>{authorBio}</p>
                      )}
                    </div>
                  </div>
                )}

                {effectiveShareActions.length > 0 && (
                  <CmsButtonGroup
                    theme={resolvedTheme}
                    variant={variant}
                    align="end"
                    responsive="sm"
                    className={dsSpacing.gap('sm')}
                  >
                    {effectiveShareActions.map((action) => (
                      <Button
                        key={action.key}
                        variant="outline"
                        size="sm"
                        className={cn('min-w-[8rem] justify-center flex items-center', dsSpacing.gap('xs'))}
                        onClick={() => handleShareClick(action.platform, action.staticUrl, action.label)}
                        aria-label={action.label}
                      >
                        {resolveCmsIcon(action.icon ?? 'Share2', {
                          fallback: '↗',
                          className: 'h-4 w-4',
                        })}
                        <span>{action.label}</span>
                      </Button>
                    ))}
                  </CmsButtonGroup>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

        {sanitizedExcerpt && (
          <Card className={cn(CARD_TONES[EXCERPT_CARD_TONE], themeClass(theme), 'border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent shadow-sm')}>
            <CardContent className="p-[var(--component-padding)]">
              <p className={cmsBody('md', resolvedTheme, 'italic font-medium leading-relaxed')}>{sanitizedExcerpt}</p>
            </CardContent>
          </Card>
        )}

        {strippedBody && (
          <section
            className={cn(
              'cms-blog-post__body prose prose-lg w-full max-w-[72ch] text-muted-foreground',
              'prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight',
              'prose-a:text-primary prose-a:transition-colors prose-a:duration-200 hover:prose-a:text-primary/80',
              'prose-strong:text-foreground prose-strong:font-semibold',
              'prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:rounded-r-lg prose-blockquote:shadow-sm',
              'prose-code:text-primary prose-code:bg-muted/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono',
              'prose-pre:bg-muted prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl prose-pre:shadow-md',
              'prose-img:rounded-xl prose-img:shadow-lg',
            )}
          >
            <SafeHtml html={strippedBody} />
          </section>
        )}

        {updatedLabel && (
          <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
            Updated on {updatedLabel}
          </p>
        )}

        {tagItems.length > 0 && (
          <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
            {tagItems.map((tag) => (
              <CmsBadge key={tag.key} variant="outline" theme={resolvedTheme}>
                #{tag.label}
              </CmsBadge>
            ))}
          </div>
        )}

        {(relatedLinkItems.length > 0 || attachmentItems.length > 0) && (
          <div className={cn('grid lg:grid-cols-2', dsSpacing.gap('lg'))}>
            {relatedLinkItems.length > 0 && (
              <Card className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'shadow-sm')}>
                <CardHeader className="flex flex-col gap-2 p-[var(--component-padding)]">
                  <CardTitle className="text-2xl">Related Links</CardTitle>
                </CardHeader>
                <CardContent className="p-[var(--component-padding)] pt-0">
                  <ul className={cn('flex flex-col text-sm text-foreground', dsSpacing.gap('sm'))}>
                    {relatedLinkItems.map((link) => (
                      <li key={link.key}>
                        <a
                          href={link.url}
                          className={cn(
                            'inline-flex items-center text-primary transition-colors hover:text-primary/80',
                            dsSpacing.gap('xs'),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {resolveCmsIcon('ArrowUpRight', { className: 'h-4 w-4' })}
                          <span>{link.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {attachmentItems.length > 0 && (
              <Card className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'shadow-sm')}>
                <CardHeader className="flex flex-col gap-2 p-[var(--component-padding)]">
                  <CardTitle className="text-2xl">Attachments</CardTitle>
                </CardHeader>
                <CardContent className="p-[var(--component-padding)] pt-0">
                  <ul className={cn('flex flex-col text-sm text-foreground', dsSpacing.gap('sm'))}>
                    {attachmentItems.map((attachment) => (
                      <li key={attachment.key}>
                        <a
                          href={attachment.url}
                          className={cn(
                            'inline-flex items-center text-primary transition-colors hover:text-primary/80',
                            dsSpacing.gap('xs'),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {resolveCmsIcon('Paperclip', { className: 'h-4 w-4' })}
                          <span>{attachment.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
    </CmsSection>
  );
};

const BlogPostWithPerformance = withPerformanceTracking(BlogPost, ComponentType.BlogPost);
export default BlogPostWithPerformance;
export { BlogPost };
