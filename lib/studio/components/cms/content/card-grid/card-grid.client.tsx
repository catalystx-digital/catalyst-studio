'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, ExternalLink, ImageOff, Tag, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { sanitizeSemanticColor } from '@/lib/studio/design-system/utils/color-utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
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

const ASPECT_RATIO_VALUE_MAP = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '3:2': 3 / 2,
} as const;

const ASPECT_RATIO_CLASS_MAP = {
  '16:9': 'aspect-[16/9]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '3:2': 'aspect-[3/2]',
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
    alt: card.image.alt ?? card.title,
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
  const resolvedTheme = resolveTheme(theme);

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

  const ratioValue = ASPECT_RATIO_VALUE_MAP[aspectRatioKey] ?? ASPECT_RATIO_VALUE_MAP[DEFAULT_ASPECT_RATIO];

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
  const renderMetadata = (card: NormalizedCardItem) => {
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
              dsSpacing.gap('xxs')
            )}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </CmsBadge>
        ))}
      </div>
    );
  };

  const renderTags = (card: NormalizedCardItem) => {
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

  const renderLinkFooter = (card: NormalizedCardItem, compact = false) => {
    // Skip if card has explicit actions (buttons) or no link at all
    if (!card.link || (card.actions && card.actions.length > 0)) {
      return null;
    }

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
        )}
      >
        <Button
          asChild
          variant="link"
          className="px-0 text-base font-medium hover:underline underline-offset-4"
          onClick={(event) => {
            event.stopPropagation();
            navigateTo(card.link);
          }}
        >
          <a
            href={card.link}
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

    if (isIconLikeImage(media)) {
      return (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center p-6',
            cardStyle === 'horizontal' ? 'md:w-32 md:py-8' : 'min-h-28',
          )}
        >
          <CardImage
            src={media.src}
            srcSet={media.srcSet}
            sizes={media.sizes}
            alt={media.alt ?? card.title}
            className="h-16 w-16 object-contain"
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
              ASPECT_RATIO_CLASS_MAP[aspectRatioKey],
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
      <AspectRatio
        ratio={ratioValue}
        className="rounded-none rounded-t-xl overflow-hidden group"
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
      </AspectRatio>
    );
  };

  // Theme is set on parent Card - children inherit via CSS cascade
  const renderCardBody = (card: NormalizedCardItem, isOverlay = false) => (
    (() => {
      const compactIconCard = isCompactIconCard(card);
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
          compactIconCard && 'items-center px-4 pb-2 pt-0 text-center',
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

        <CardTitle className={cn('line-clamp-2', compactIconCard ? 'text-base' : 'text-xl')}>
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
            compactIconCard && 'items-center text-center',
          )}
        >
          {card.description && (
            <p className={cmsBody('md', undefined, 'line-clamp-3')}>{card.description}</p>
          )}

          {renderMetadata(card)}
          {renderTags(card)}
        </CardContent>
      )}

      {renderActions(card)}
      {renderLinkFooter(card, compactIconCard)}
    </>
      );
    })()
  );


  return (
    <div className={gridClasses}>
      {cards.map((card, index) => {
        const tone = resolveTone(card.variant);
        const clickable = Boolean(card.link || onCardClick);
        const backgroundImage = imagePosition === 'background';

        // Custom background color from import - auto-detect light/dark for text contrast
        // Cards with backgroundColor are solid-colored cards and should NOT show images
        const hasCustomBg = Boolean(card.backgroundColor);

        // Skip rendering image for cards with custom background color (solid color cards)
        const media = hasCustomBg ? null : renderImage(card, imagePosition);
        const compactIconCard = isCompactIconCard(card);
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
        // Simple contrast check: if first hex digit > 7, it's probably a light color
        const isLightBg = hasCustomBg && card.backgroundColor?.match(/^#([8-9a-f])/i);

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
              // Stitch design: muted background for non-colored cards
              !hasCustomBg && !backgroundImage && 'bg-muted/30 border-0',
              // Focus and hover states - shadcn-style subtle effects
              clickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cardStyle === 'horizontal' && !backgroundImage && 'md:flex-row',
              cardStyle === 'compact' && 'md:max-w-md',
              backgroundImage && 'border-0 bg-transparent text-foreground shadow-none',
              compactIconCard && 'justify-start',
              // Featured card styling - subtle emphasis
              isFeatured && 'md:col-span-2 border-primary/20',
              // Custom background styling - use white/light text for dark backgrounds
              hasCustomBg && !isLightBg && 'text-white border-transparent',
              hasCustomBg && isLightBg && 'text-foreground border-transparent',
            )}
            onClick={clickable ? handleCardClick(card) : undefined}
            role={clickable ? 'button' : 'article'}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? handleCardKeyDown(card) : undefined}
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
                        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent"
                        aria-hidden="true"
                      />
                    </>
                  );
                })()}

                <div className="relative z-10 flex h-full flex-col">
                  {renderCardBody(card, true)}
                </div>
              </div>
            ) : (
              <>
                {media}
                <div className="flex flex-1 flex-col">
                  {renderCardBody(card, false)}
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
