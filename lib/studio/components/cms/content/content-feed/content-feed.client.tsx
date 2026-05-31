'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  CmsBadge,
  CARD_TONES,
  buildCmsClassName,
  cmsBody,
  dsSpacing,
  resolveTheme,
  themeClass,
} from '../../_ui';
import type { ComponentTheme } from '../../_core/types';
import type { CardGridClientProps } from '../card-grid/card-grid.types';
import { CardGridClient } from '../card-grid/card-grid.client';
import type { ContentFeedLayout, NormalizedContentFeedItem } from './content-feed.types';

const DEFAULT_COLUMNS = 3;
const DEFAULT_GAP: CardGridClientProps['content']['gap'] = 'medium';

function buildImageSrcSet(image: NormalizedContentFeedItem['image']): string | undefined {
  const renditions = image?.renditions;
  if (!Array.isArray(renditions)) {
    return undefined;
  }
  const srcSet = renditions
    .map(rendition => {
      if (!rendition?.src) {
        return null;
      }
      return typeof rendition.width === 'number' && rendition.width > 0
        ? `${rendition.src} ${rendition.width}w`
        : rendition.src;
    })
    .filter((entry): entry is string => Boolean(entry));
  return srcSet.length > 0 ? srcSet.join(', ') : undefined;
}

/**
 * Navigation helper that dispatches a test event in test mode.
 * In production, navigation is handled via the router passed to components.
 */
function dispatchTestNavigation(url: string): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('cms:navigate', { detail: url }));
  }
}

/**
 * Custom hook that returns a navigation function using Next.js router.
 * Falls back to dispatching test events in test environment.
 */
function useNavigate(): (url?: string) => void {
  const router = useRouter();

  return useCallback(
    (url?: string) => {
      if (!url) {
        return;
      }

      if (process.env.NODE_ENV === 'test') {
        dispatchTestNavigation(url);
        return;
      }

      router.push(url);
    },
    [router]
  );
}

interface ContentFeedClientProps {
  items: NormalizedContentFeedItem[];
  layout: ContentFeedLayout;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal';
  onItemClick?: (itemId: string, item: NormalizedContentFeedItem) => void;
  onInteraction?: (event: { type: string; itemId?: string; href?: string }) => void;
}

function toCardGridContent(items: NormalizedContentFeedItem[]): CardGridClientProps['content'] {
  return {
    heading: undefined,
    subheading: undefined,
    cards: items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.summary,
      image: item.image,
      link: item.href,
      metadata: {
        date: item.publishDate,
        tags: item.tags,
        category: item.categories[0],
      },
    })),
    columns: DEFAULT_COLUMNS,
    gap: DEFAULT_GAP,
    cardStyle: 'vertical',
    imageAspectRatio: '16:9',
    imageLoading: 'eager',
    featureFirstCard: false,
    density: 'feed',
  };
}

function ContentFeedList({
  items,
  theme = 'auto',
  variant = 'default',
  onItemClick,
  onInteraction,
}: Omit<ContentFeedClientProps, 'layout'>) {
  const navigate = useNavigate();
  const resolvedTheme = resolveTheme(theme);

  const listClass = buildCmsClassName({
    base: cn('cms-content-feed-list flex flex-col', dsSpacing.gap('md')),
    theme: resolvedTheme,
    variant,
    includeVariant: true,
  });

  const handleClick = useCallback(
    (item: NormalizedContentFeedItem) => {
      onItemClick?.(item.id, item);
      onInteraction?.({ type: 'item-click', itemId: item.id, href: item.href });
      if (item.href) {
        navigate(item.href);
      }
    },
    [onItemClick, onInteraction, navigate],
  );

  return (
    <div className={listClass}>
      {items.map(item => {
        const hasMedia = Boolean(item.image);
        const publishDate = item.publishDate || item.updatedAt || item.createdAt;
        const srcSet = buildImageSrcSet(item.image);

        return (
          <article
            key={item.id}
            className={cn(
              'cms-content-feed-item group relative overflow-hidden rounded-[var(--ds-radius-lg)] border bg-card shadow-sm transition-shadow',
              'hover:shadow-md',
              hasMedia ? 'md:flex md:items-stretch' : 'flex flex-col',
            )}
          >
            {hasMedia && item.image ? (
              <div className="md:w-1/3">
                <AspectRatio
                  ratio={16 / 9}
                  className="h-full w-full overflow-hidden bg-muted"
                >
                  {/* Explicit dimensions prevent layout shift (CLS). CSS handles actual sizing. */}
                  <img
                    src={item.image.src}
                    alt={item.image.alt ?? item.title}
                    srcSet={srcSet}
                    sizes={srcSet ? '(min-width: 768px) 33vw, 100vw' : undefined}
                    width={640}
                    height={360}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    data-original-url={item.image.originalUrl}
                  />
                </AspectRatio>
              </div>
            ) : null}

            <FeedListCard
              item={item}
              publishDate={publishDate}
              theme={resolvedTheme ?? 'auto'}
              variant={variant}
              onClick={() => handleClick(item)}
              hasMedia={hasMedia}
            />
          </article>
        );
      })}
    </div>
  );
}

function FeedListCard({
  item,
  publishDate,
  theme,
  variant,
  onClick,
  hasMedia,
}: {
  item: NormalizedContentFeedItem;
  publishDate?: string;
  theme: ComponentTheme;
  variant: NonNullable<ContentFeedClientProps['variant']>;
  onClick: () => void;
  hasMedia: boolean;
}) {
  return (
    <Card
      className={cn(
        CARD_TONES['minimal'],
        themeClass(theme),
        'flex flex-1 flex-col',
        hasMedia ? 'p-4 md:p-6' : 'p-5 md:p-6',
        'gap-2 md:gap-3',
        'cursor-pointer',
      )}
      onClick={onClick}
      role="article"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'p-0', dsSpacing.gap('xs'))}>
        <CardTitle className={cmsBody('xl', theme)}>{item.title}</CardTitle>
        {publishDate ? (
          <p className={cn(cmsBody('sm', theme), 'text-muted-foreground')}>
            {publishDate}
          </p>
        ) : null}
      </CardHeader>
      {item.summary ? (
        <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'p-0', cmsBody('md', theme), 'text-muted-foreground')}>
          {item.summary}
        </CardContent>
      ) : null}
      {(item.tags.length > 0 || item.categories.length > 0) && (
        <div className={cn('flex flex-wrap items-center', dsSpacing.gap('xs'))}>
          {item.categories.map(category => (
            <CmsBadge
              key={`${item.id}-category-${category}`}
              variant="outline"
            >
              {category}
            </CmsBadge>
          ))}
          {item.tags.map(tag => (
            <CmsBadge
              key={`${item.id}-tag-${tag}`}
              variant="neutral"
            >
              {tag}
            </CmsBadge>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ContentFeedClient(props: ContentFeedClientProps) {
  const { items, layout, theme = 'auto', variant = 'default', onItemClick, onInteraction } = props;

  if (items.length === 0) {
    return null;
  }

  if (layout === 'card-grid') {
    const content = toCardGridContent(items);
    return (
      <CardGridClient
        content={content}
        className="w-full"
        theme={resolveTheme(theme)}
        variant={variant}
        hover
        onCardClick={cardId => {
          const item = items.find(entry => entry.id === cardId);
          if (item) {
            onItemClick?.(item.id, item);
            onInteraction?.({ type: 'item-click', itemId: item.id, href: item.href });
          }
        }}
      />
    );
  }

  return (
    <ContentFeedList
      items={items}
      theme={theme}
      variant={variant}
      onItemClick={onItemClick}
      onInteraction={onInteraction}
    />
  );
}
