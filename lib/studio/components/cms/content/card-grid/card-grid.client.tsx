'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, ExternalLink, ImageOff, Tag, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isLightColor, sanitizeSemanticColor } from '@/lib/studio/design-system/utils/color-utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CmsBadge,
  CmsCardTone,
  CARD_TONES,
  buildCmsClassName,
  cmsBody,
  dsSpacing,
  resolveTheme,
  themeClass,
} from '../../_ui';
import type { ComponentTheme } from '../../_core/types';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import {
  CardGridClientProps,
  NormalizedCardItem,
} from './card-grid.types';

const COLUMN_CLASSES: Record<Required<CardGridClientProps['content']>['columns'], string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

const GAP_CLASSES: Record<NonNullable<CardGridClientProps['content']['gap']>, string> = {
  small: dsSpacing.gap('md'),
  medium: dsSpacing.gap('lg'),
  large: dsSpacing.gap('xl'),
};

const MOBILE_MEDIA_ASPECT_RATIO_CLASS_MAP = {
  '16:9': 'aspect-[2/1] sm:aspect-[16/9]',
  '4:3': 'aspect-[16/10] sm:aspect-[4/3]',
  '1:1': 'aspect-[16/10] sm:aspect-square',
  '3:2': 'aspect-[16/10] sm:aspect-[3/2]',
} as const;

const FEED_MEDIA_ASPECT_RATIO_CLASS_MAP = {
  '16:9': 'aspect-[5/2] sm:aspect-[16/9]',
  '4:3': 'aspect-[2/1] sm:aspect-[4/3]',
  '1:1': 'aspect-[2/1] sm:aspect-square',
  '3:2': 'aspect-[2/1] sm:aspect-[3/2]',
} as const;

const CARD_VARIANT_TONES: Record<NonNullable<NormalizedCardItem['variant']>, CmsCardTone> = {
  accent: 'accent',
  muted: 'muted',
  minimal: 'minimal',
  default: 'default',
};

type ActionVariant = NonNullable<NormalizedCardItem['actions']>[number]['variant'];

const ACTION_VARIANT_MAP: Record<Exclude<ActionVariant, undefined>, 'default' | 'secondary' | 'outline'> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
};

const DEFAULT_CARD_TONE: CmsCardTone = 'default';
const DEFAULT_ASPECT_RATIO = '16:9' as const;
const CARD_IMAGE_SIZES =
  '(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 33vw';
const EDITORIAL_FEED_HEADING_PATTERN =
  /\b(news|blog|posts|articles|updates|announcements|stories|press|media)\b/i;

function navigateTo(url?: string): void {
  if (!url) {
    return;
  }

  if (typeof window === 'undefined' || !window.location) {
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('cms:navigate', { detail: url }));
    }
    return;
  }

  window.location.href = url;
}

function resolveActionUrl(action: NonNullable<NormalizedCardItem['actions']>[number]): string | undefined {
  return resolveSmartLinkHref(action.url) ?? resolveSmartLinkHref(action.href);
}

/**
 * Card image component with error fallback
 */
function CardImage({
  src,
  srcSet,
  sizes,
  alt,
  className,
  originalUrl,
  loading = 'lazy',
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  originalUrl?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/60 text-muted-foreground',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-8 w-8 opacity-50" />
      </div>
    );
  }

  // Explicit dimensions prevent layout shift (CLS). CSS handles actual sizing.
  // Using 16:9 base dimensions (640x360) - actual display controlled by CSS.
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={640}
      height={360}
      className={cn(className, 'transition-transform duration-500')}
      loading={loading}
      onError={() => setHasError(true)}
      data-original-url={originalUrl}
    />
  );
}

function resolveTone(variant: NormalizedCardItem['variant']): CmsCardTone {
  if (!variant) {
    return DEFAULT_CARD_TONE;
  }

  return CARD_VARIANT_TONES[variant] ?? DEFAULT_CARD_TONE;
}

function getImageFromCard(
  card: NormalizedCardItem,
): { src: string; alt: string; srcSet?: string; sizes?: string; originalUrl?: string } | null {
  if (!card.image || typeof card.image !== 'object') {
    return null;
  }

  const src = typeof card.image.src === 'string' ? card.image.src : undefined;
  if (!src) {
    return null;
  }

  const srcSet =
    Array.isArray(card.image.renditions) && card.image.renditions.length > 0
      ? card.image.renditions
          .filter(rendition => typeof rendition?.width === 'number' && rendition.width > 0)
          .map(rendition => `${rendition!.src} ${rendition!.width}w`)
          .join(', ')
      : undefined;

  return {
    src,
    alt: card.image.alt ?? '',
    originalUrl: card.image.originalUrl,
    srcSet,
    sizes: srcSet ? CARD_IMAGE_SIZES : undefined,
  };
}

function isIconLikeImage(
  media: { src: string; alt?: string; originalUrl?: string } | null,
): boolean {
  if (!media) {
    return false;
  }

  const haystack = `${media.src} ${media.originalUrl ?? ''} ${media.alt ?? ''}`.toLowerCase();
  return /(?:^|[/?&_-])(?:icon|logo|glyph|badge)(?:[._/?&=-]|$)/.test(haystack);
}

function isCompactIconCard(card: NormalizedCardItem): boolean {
  return (
    isIconLikeImage(getImageFromCard(card)) &&
    !card.description &&
    !card.metadata?.author &&
    !card.metadata?.date &&
    !card.metadata?.category &&
    !(Array.isArray(card.metadata?.tags) && card.metadata.tags.length > 0) &&
    !(Array.isArray(card.actions) && card.actions.length > 0)
  );
}

function isTitleOnlyLinkCard(card: NormalizedCardItem): boolean {
  return (
    Boolean(card.link) &&
    !getImageFromCard(card) &&
    !card.icon &&
    !card.description &&
    !card.metadata?.author &&
    !card.metadata?.date &&
    !card.metadata?.category &&
    !(Array.isArray(card.metadata?.tags) && card.metadata.tags.length > 0) &&
    !(Array.isArray(card.actions) && card.actions.length > 0)
  );
}

function isSimpleLinkedCard(card: NormalizedCardItem): boolean {
  return (
    Boolean(card.link) &&
    !card.description &&
    !card.metadata?.author &&
    !card.metadata?.date &&
    !card.metadata?.category &&
    !(Array.isArray(card.metadata?.tags) && card.metadata.tags.length > 0) &&
    !(Array.isArray(card.actions) && card.actions.length > 0)
  );
}

function isQuickLinkMedia(media: { src: string; alt?: string; originalUrl?: string } | null): boolean {
  if (!media) {
    return true;
  }

  if (isIconLikeImage(media)) {
    return true;
  }

  const haystack = `${media.src} ${media.originalUrl ?? ''} ${media.alt ?? ''}`.toLowerCase();
  return /(?:^|[/?&_.-])(?:flag|poll|quick|badge|symbol|mark)(?:[._/?&=-]|$)|(?:^|[/?&_.-])sm\.(?:png|jpe?g|webp|gif|svg)(?:[?&#]|$)/.test(haystack);
}

export function CardGridClient({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  hover = true,
  onCardClick,
}: CardGridClientProps) {
  const cards: NormalizedCardItem[] = Array.isArray(content.cards)
    ? content.cards
    : [];
  // Validate columns - default to 3 for responsive grid when there are multiple cards
  const rawColumns = content.columns;
  const cardCount = Array.isArray(content.cards) ? content.cards.length : 0;
  // Use 3 columns by default for better responsive layout, unless explicitly set to valid value > 1
  const columns = (typeof rawColumns === 'number' && rawColumns > 1 && rawColumns <= 6)
    ? rawColumns
    : (cardCount > 1 ? 3 : 1);
  const gap = content.gap ?? 'medium';
  const hasColoredCards = cards.some(card => card.backgroundColor);
  const cardStyle = content.cardStyle ?? (hasColoredCards ? 'vertical' : 'horizontal');
  const imagePosition = content.imagePosition ?? (hasColoredCards ? 'top' : 'left');
  const aspectRatioKey = content.imageAspectRatio ?? DEFAULT_ASPECT_RATIO;
  const imageLoading = content.imageLoading ?? 'lazy';
  const editorialGridDensity =
    typeof content.heading === 'string' &&
    EDITORIAL_FEED_HEADING_PATTERN.test(content.heading) &&
    cards.length >= 3 &&
    cards.some(card => Boolean(card.description) && Boolean(getImageFromCard(card)));
  const feedDensity =
    content.density === 'feed' ||
    (content.density !== 'default' && editorialGridDensity);
  const resolvedTheme = resolveTheme(theme);
  const quickLinkGrid =
    !content.heading &&
    cards.length >= 2 &&
    cards.every(card => isSimpleLinkedCard(card) && isQuickLinkMedia(getImageFromCard(card)));

  // Memoize theme class to avoid recalculating on every render
  const resolvedThemeClass = useMemo(() => themeClass(resolvedTheme), [resolvedTheme]);

  if (cards.length === 0) {
    const emptyClassName = buildCmsClassName({
      base:
        'cms-card-grid-empty rounded-xl border border-dashed border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground backdrop-blur-sm',
      theme: resolvedTheme,
      className,
    });
    return (
      <div className={emptyClassName}>
        No cards are available for this grid.
      </div>
    );
  }

  const gridClasses = buildCmsClassName({
    base: cn(
      'cms-card-grid grid w-full',
      COLUMN_CLASSES[columns],
      GAP_CLASSES[gap],
    ),
    theme: resolvedTheme,
    className,
  });

  const handleCardSelect = useCallback(
    (card: NormalizedCardItem, event?: React.SyntheticEvent) => {
      onCardClick?.(card.id);

      if (card.link && !(event?.defaultPrevented)) {
        navigateTo(card.link);
      }
    },
    [onCardClick],
  );

  const handleCardClick = useCallback(
    (card: NormalizedCardItem) => (event: React.MouseEvent<HTMLDivElement>) => {
      handleCardSelect(card, event);
    },
    [handleCardSelect],
  );

  const handleCardKeyDown = useCallback(
    (card: NormalizedCardItem) => (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCardSelect(card);
      }
    },
    [handleCardSelect],
  );

  // Theme is set on parent CmsCard - children inherit via CSS cascade
  const renderMetadata = (card: NormalizedCardItem, options: { compact?: boolean } = {}) => {
    const { compact = false } = options;
    const items: Array<{ key: string; icon: React.ReactNode; label: string }> = [];

    if (card.metadata?.author) {
      items.push({
        key: `${card.id}-author`,
        icon: <User className="h-3.5 w-3.5" aria-hidden="true" />,
        label: card.metadata.author,
      });
    }

    if (card.metadata?.date) {
      items.push({
        key: `${card.id}-date`,
        icon: <Calendar className="h-3.5 w-3.5" aria-hidden="true" />,
        label: card.metadata.date,
      });
    }

    if (card.metadata?.category) {
      items.push({
        key: `${card.id}-category`,
        icon: <Tag className="h-3.5 w-3.5" aria-hidden="true" />,
        label: card.metadata.category,
      });
    }

    if (items.length === 0) {
      return null;
    }

    return (
      <div className={cn('flex flex-wrap', dsSpacing.gap('xs'))}>
        {items.map((item) => (
          <CmsBadge
            key={item.key}
            variant="outline"
            className={cn(
              'flex items-center bg-muted/70 border-border/70',
              dsSpacing.gap('xxs'),
              compact && 'px-2 py-0 text-[11px] font-medium leading-5 bg-muted/40 text-muted-foreground border-border/50'
            )}
          >
            {item.icon}
            <span className={cn('font-medium', compact ? 'text-[11px]' : feedDensity && 'text-xs')}>{item.label}</span>
          </CmsBadge>
        ))}
      </div>
    );
  };

  const renderTags = (card: NormalizedCardItem, options: { compact?: boolean } = {}) => {
    const { compact = false } = options;
    const tags = card.metadata?.tags;
    if (!tags || tags.length === 0) {
      return null;
    }

    return (
      <div className={cn('flex flex-wrap', dsSpacing.gap('xs'))}>
        {tags.map((tag, index) => (
          <CmsBadge
            key={`${card.id}-tag-${index}`}
            variant="neutral"
            className={cn(
              compact && 'px-2 py-0 text-[11px] font-medium leading-5 bg-muted/40 text-muted-foreground border border-border/50'
            )}
          >
            {tag}
          </CmsBadge>
        ))}
      </div>
    );
  };

  const renderActions = (card: NormalizedCardItem) => {
    if (!card.actions || card.actions.length === 0) {
      return null;
    }

    return (
      <CardFooter className={cn('flex items-center gap-3 p-[var(--component-padding)] pt-0', resolvedThemeClass, 'flex-wrap', dsSpacing.gap('sm'))}>
        {card.actions.map((action, index) => {
          const variantKey = action.variant ?? 'primary';
          const buttonVariant = ACTION_VARIANT_MAP[variantKey] ?? 'default';

          return (
            <Button
              key={`${card.id}-action-${index}`}
              type="button"
              variant={buttonVariant}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigateTo(resolveActionUrl(action));
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </CardFooter>
    );
  };

  const renderLinkFooter = (
    card: NormalizedCardItem,
    options: {
      compact?: boolean;
      alignStart?: boolean;
      highContrast?: boolean;
      dense?: boolean;
      denseMobile?: boolean;
      overlay?: boolean;
      feedDense?: boolean;
    } = {},
  ) => {
    if (!card.link) {
      return null;
    }

    const {
      compact = false,
      alignStart = false,
      highContrast = false,
      dense = false,
      denseMobile = false,
      overlay = false,
      feedDense = false,
    } = options;

    // P1 Fix: Show visible CTA for clickable cards without explicit linkText
    // Use linkText if provided, otherwise default to "Learn more"
    const displayLinkText = card.linkText && card.linkText !== card.title
      ? card.linkText
      : 'Learn more';

    return (
      <CardFooter
        className={cn(
          'flex items-center gap-3 p-[var(--component-padding)] pt-0',
          resolvedThemeClass,
          compact && 'justify-center p-4 pt-0',
          alignStart && 'justify-start px-5 pb-5 pt-0',
          dense && 'px-4 pb-4 sm:px-5 sm:pb-5',
          denseMobile && 'px-4 pb-4 sm:px-6 sm:pb-6',
          feedDense && 'px-4 pb-3 sm:px-5 sm:pb-4',
        )}
      >
        <Button
          asChild
          variant="link"
          className={cn(
            'px-0 text-base font-medium hover:underline underline-offset-4',
            highContrast && 'text-card-foreground/85 hover:text-card-foreground',
            overlay && 'text-white/90 hover:text-white drop-shadow-sm',
            feedDense && 'text-sm sm:text-base',
          )}
          onClick={(event) => {
            event.stopPropagation();
            navigateTo(card.link);
          }}
        >
          <a
            href={card.link}
            aria-label={`${displayLinkText} about ${card.title}`}
            className="inline-flex items-center gap-2 transition-colors duration-200"
          >
            <span className="text-sm sm:text-base text-inherit">{displayLinkText}</span>
            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </a>
        </Button>
      </CardFooter>
    );
  };

  const renderImage = (card: NormalizedCardItem, position: typeof imagePosition) => {
    if (position === 'background') {
      return null;
    }

    const media = getImageFromCard(card);

    // Cards without images: skip the image area entirely for cleaner appearance
    // This follows shadcn philosophy - less is more, no unnecessary placeholders
    if (!media) {
      return null;
    }

    if (isIconLikeImage(media) || quickLinkGrid) {
      return (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center',
            quickLinkGrid
              ? 'm-4 mb-0 h-10 w-10 rounded-md border border-primary/15 bg-primary/10 p-2 sm:m-5 sm:mb-0 sm:h-12 sm:w-12'
              : 'p-6',
            !quickLinkGrid && cardStyle === 'horizontal' ? 'md:w-32 md:py-8' : !quickLinkGrid && 'min-h-28',
          )}
        >
          <CardImage
            src={media.src}
            srcSet={media.srcSet}
            sizes={media.sizes}
            alt={media.alt ?? card.title}
            className={quickLinkGrid ? 'h-full w-full object-contain' : 'h-16 w-16 object-contain'}
            originalUrl={media.originalUrl}
            loading={imageLoading}
          />
        </div>
      );
    }

    if (cardStyle === 'horizontal') {
      const orderClass = position === 'right' ? 'md:order-last md:rounded-l-none md:rounded-r-xl' : 'md:rounded-r-none md:rounded-l-xl';

      return (
        <div className={cn('md:w-[40%] group', position === 'right' && 'md:order-last')}>
          <div
            className={cn(
              'relative h-full w-full overflow-hidden rounded-t-xl',
              feedDensity
                ? FEED_MEDIA_ASPECT_RATIO_CLASS_MAP[aspectRatioKey]
                : MOBILE_MEDIA_ASPECT_RATIO_CLASS_MAP[aspectRatioKey],
              'md:rounded-none',
              orderClass,
            )}
          >
            <CardImage
              src={media.src}
              srcSet={media.srcSet}
              sizes={media.sizes}
              alt={media.alt ?? card.title}
              className="h-full w-full object-cover"
              originalUrl={media.originalUrl}
              loading={imageLoading}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'overflow-hidden rounded-none rounded-t-xl group',
          feedDensity
            ? FEED_MEDIA_ASPECT_RATIO_CLASS_MAP[aspectRatioKey]
            : MOBILE_MEDIA_ASPECT_RATIO_CLASS_MAP[aspectRatioKey],
        )}
      >
        <CardImage
          src={media.src}
          srcSet={media.srcSet}
          sizes={media.sizes}
          alt={media.alt ?? card.title}
          className="h-full w-full object-cover"
          originalUrl={media.originalUrl}
          loading={imageLoading}
        />
      </div>
    );
  };

  // Theme is set on parent Card - children inherit via CSS cascade
  const renderCardBody = (card: NormalizedCardItem, isOverlay = false, denseMediaCard = false) => (
    (() => {
      const compactIconCard = isCompactIconCard(card);
      const titleOnlyLinkCard = isTitleOnlyLinkCard(card);
      const feedDenseCard = feedDensity && denseMediaCard;
      const sanitizedBackgroundColor = sanitizeSemanticColor(card.backgroundColor);
      const hasDarkCustomBackground = Boolean(
        sanitizedBackgroundColor && !isLightColor(sanitizedBackgroundColor),
      );
      const hasBodyContent =
        Boolean(card.description) ||
        Boolean(card.metadata?.author) ||
        Boolean(card.metadata?.date) ||
        Boolean(card.metadata?.category) ||
        Boolean(card.metadata?.tags?.length);

      return (
    <>
      <CardHeader
        className={cn(
          'flex flex-col gap-2 p-[var(--component-padding)]',
          resolvedThemeClass,
          dsSpacing.gap('sm'),
          cardStyle === 'compact' ? dsSpacing.padding('md') : dsSpacing.padding('lg'),
          isOverlay && `lg:${dsSpacing.padding('xl')}`,
          isOverlay && 'mt-auto text-white',
          compactIconCard && 'items-center px-4 pb-2 pt-0 text-center',
          titleOnlyLinkCard && 'justify-start px-5 pb-2 pt-5',
          quickLinkGrid && 'justify-start px-4 pb-2 pt-3 sm:px-5 sm:pt-4',
          denseMediaCard && 'px-4 py-4 sm:px-6 sm:py-6',
          feedDenseCard && 'px-4 py-3 sm:px-5 sm:py-4',
        )}
      >
        {card.badge && (
          <CmsBadge variant="accent" className="w-fit">
            {card.badge}
          </CmsBadge>
        )}

        {card.icon && (!card.image || !card.image.src) && (
          <span className="text-3xl" aria-hidden="true">
            {card.icon}
          </span>
        )}

        <CardTitle className={cn(
          'line-clamp-2',
          compactIconCard || quickLinkGrid
            ? 'text-base'
            : feedDenseCard
              ? 'text-base sm:text-lg'
              : denseMediaCard
                ? 'text-lg sm:text-xl'
                : 'text-xl',
          isOverlay && 'text-white drop-shadow-sm',
          titleOnlyLinkCard && 'text-base font-semibold leading-snug',
          quickLinkGrid && 'font-semibold leading-snug',
        )}>
          {card.title}
        </CardTitle>
      </CardHeader>

      {hasBodyContent && (
        <CardContent
          className={cn(
            'p-[var(--component-padding)] pt-0',
            resolvedThemeClass,
            'flex flex-1 flex-col',
            dsSpacing.gap('md'),
            cardStyle === 'compact'
              ? dsSpacing.padding('md')
              : dsSpacing.padding('lg'),
            'pt-0',
            isOverlay && `lg:${dsSpacing.px('xl')}`,
            isOverlay && 'text-white',
            compactIconCard && 'items-center text-center',
            denseMediaCard && 'px-4 pb-4 sm:px-6 sm:pb-6',
            feedDenseCard && 'gap-2 px-4 pb-3 sm:px-5 sm:pb-4',
          )}
        >
          {card.description && (
            <p
              className={cn(
                cmsBody(
                  feedDenseCard ? 'sm' : 'md',
                  undefined,
                  feedDenseCard ? 'line-clamp-2' : denseMediaCard ? 'line-clamp-2 sm:line-clamp-3' : 'line-clamp-3',
                ),
                isOverlay && 'text-white/85 drop-shadow-sm',
              )}
            >
              {card.description}
            </p>
          )}

          {renderMetadata(card, { compact: feedDenseCard })}
          {renderTags(card, { compact: feedDenseCard })}
        </CardContent>
      )}

      {renderActions(card)}
      {renderLinkFooter(card, {
        compact: compactIconCard || titleOnlyLinkCard || quickLinkGrid,
        alignStart: titleOnlyLinkCard || quickLinkGrid,
        highContrast:
          quickLinkGrid ||
          (!isOverlay &&
            (hasDarkCustomBackground ||
              (resolvedTheme !== 'light' && (denseMediaCard || feedDenseCard)))),
        dense: quickLinkGrid,
        denseMobile: denseMediaCard,
        overlay: isOverlay,
        feedDense: feedDenseCard,
      })}
    </>
      );
    })()
  );


  return (
    <div className={gridClasses}>
      {cards.map((card, index) => {
        const tone = resolveTone(card.variant);
        const clickable = Boolean(card.link || onCardClick);
        const cardButtonSemantics = Boolean(onCardClick && !card.link);
        const backgroundImage = imagePosition === 'background';

        // Custom background color from import - auto-detect light/dark for text contrast
        // Cards with backgroundColor are solid-colored cards and should NOT show images
        const hasCustomBg = Boolean(card.backgroundColor);

        // Skip rendering image for cards with custom background color (solid color cards)
        const media = hasCustomBg ? null : renderImage(card, imagePosition);
        const mediaAsset = getImageFromCard(card);
        const denseMediaCard = Boolean(
          mediaAsset &&
          !quickLinkGrid &&
          !isIconLikeImage(mediaAsset) &&
          !backgroundImage &&
          !hasCustomBg,
        );
        const compactIconCard = isCompactIconCard(card);
        const titleOnlyLinkCard = isTitleOnlyLinkCard(card);
        const cardTheme = backgroundImage ? 'dark' : resolvedTheme;

        // Featured card styling: first card can span 2 columns when we have 3+ columns
        // Only use featured layout when it creates a balanced grid (remaining cards fill rows evenly)
        // With featured card: Row 1 uses 2 cards (featured + 1 regular), remaining cards should fill evenly
        const cardsAfterFirstRow = cards.length - 2;
        const wouldCreateBalancedLayout =
          cardsAfterFirstRow >= columns || // At least one full row after row 1
          cardsAfterFirstRow === 0; // Or exactly fills row 1
        const featureFirstCard = content.featureFirstCard !== false;
        const isFeatured = featureFirstCard && index === 0 && columns >= 3 && cards.length > 2 && wouldCreateBalancedLayout;
        // P1 Fix: Sanitize red-like colors to primary for better semantics
        const sanitizedBgColor = sanitizeSemanticColor(card.backgroundColor);
        const customBgStyle = hasCustomBg ? { backgroundColor: sanitizedBgColor } : undefined;
        const isLightBg = sanitizedBgColor ? isLightColor(sanitizedBgColor) : false;

        return (
          <Card
            key={card.id}
            style={customBgStyle}
            className={cn(
              CARD_TONES[hasCustomBg ? 'default' : tone],
              themeClass(hasCustomBg ? (isLightBg ? 'light' : 'dark') : cardTheme),
              'cms-card-grid-card flex h-full flex-col overflow-hidden relative group',
              // Subtle shadow for depth
              !backgroundImage && 'shadow-sm',
              // Let shadcn Card provide the foundation; keep imported cards crisp.
              !hasCustomBg && !backgroundImage && 'bg-card/95 border-border/70',
              // Focus and hover states - shadcn-style subtle effects
              clickable && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cardStyle === 'horizontal' && !backgroundImage && 'md:flex-row',
              cardStyle === 'compact' && 'md:max-w-md',
              backgroundImage && 'border-0 bg-transparent text-foreground shadow-none',
              compactIconCard && 'justify-start',
              titleOnlyLinkCard && 'min-h-24 justify-between',
              quickLinkGrid && 'min-h-24 justify-between rounded-lg border-l-4 border-l-primary/70 bg-card hover:bg-accent/35 sm:min-h-28',
              // Featured card styling - subtle emphasis
              isFeatured && 'md:col-span-2 border-primary/20',
              // Custom background styling - use white/light text for dark backgrounds
              hasCustomBg && !isLightBg && 'text-white border-transparent',
              hasCustomBg && isLightBg && 'text-foreground border-transparent',
            )}
            onClick={clickable ? handleCardClick(card) : undefined}
            role={cardButtonSemantics ? 'button' : 'article'}
            tabIndex={cardButtonSemantics ? 0 : undefined}
            onKeyDown={cardButtonSemantics ? handleCardKeyDown(card) : undefined}
          >
            {backgroundImage ? (
              <div className="relative flex h-full flex-col">
                {(() => {
                  const mediaAsset = getImageFromCard(card);
                  if (!mediaAsset) {
                    return null;
                  }

                  return (
                    <>
                      <CardImage
                        src={mediaAsset.src}
                        srcSet={mediaAsset.srcSet}
                        sizes={mediaAsset.sizes}
                        alt={mediaAsset.alt ?? card.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        originalUrl={mediaAsset.originalUrl}
                        loading={imageLoading}
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/25"
                        aria-hidden="true"
                      />
                    </>
                  );
                })()}

                <div className="relative z-10 flex h-full flex-col">
                  {renderCardBody(card, true, denseMediaCard)}
                </div>
              </div>
            ) : (
              <>
                {media}
                <div className="flex flex-1 flex-col">
                  {renderCardBody(card, false, denseMediaCard)}
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
