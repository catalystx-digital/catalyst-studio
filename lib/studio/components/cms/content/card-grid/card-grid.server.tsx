import React from 'react';

import { cn } from '@/lib/utils';
import {
  CmsSection,
  buildCmsClassName,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
} from '../../_ui';
import { shouldShowDevEmptyStateServer } from '../../_core/env-utils';
import { validateImageUrl } from '../../_utils/url-validation';
import { CardGridClient } from './card-grid.client';
import {
  CardGridServerProps,
  CardItem,
  CardGridFilter,
  NormalizedCardGridContent,
  NormalizedCardItem,
} from './card-grid.types';

/**
 * Helper to check if a value is a nested media object (has src property as object with nested src).
 * This handles the structure from runtime-media-resolver: { src: { src: "url", mediaId: "...", renditions: [...] } }
 */
function isNestedMediaObject(
  value: unknown
): value is { src: string; mediaId?: string; originalUrl?: string; renditions?: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'src' in value &&
    typeof (value as Record<string, unknown>).src === 'string'
  );
}

function normalizeCard(card: CardItem & { bgColor?: string }): NormalizedCardItem {
  const id = card.id || `card-${Math.random().toString(36).slice(2, 11)}`;
  const { image, imageAlt, bgColor, ...rest } = card;
  const base: NormalizedCardItem = {
    ...rest,
    id,
    imageAlt,
    // Map bgColor from LLM output to backgroundColor expected by component
    backgroundColor: bgColor ?? rest.backgroundColor,
  };

  if (!image) {
    return base;
  }

  if (typeof image === 'string') {
    const src = validateImageUrl(image);
    if (!src) {
      return base;
    }

    return {
      ...base,
      image: {
        src,
        alt: imageAlt ?? rest.title,
      },
    };
  }

  // Handle nested media object: image.src can be an object { src: "url", mediaId, renditions }
  // This structure comes from runtime-media-resolver when mediaId references are resolved
  let resolvedSrc: string | undefined;
  let resolvedOriginalUrl: string | undefined;
  let sourceRenditions: unknown[] | undefined;

  if (typeof image.src === 'string') {
    // Direct string src
    resolvedSrc = validateImageUrl(image.src);
    resolvedOriginalUrl = image.originalUrl;
    sourceRenditions = image.renditions;
  } else if (isNestedMediaObject(image.src)) {
    // Nested object: image.src = { src: "url", mediaId: "...", originalUrl: "...", renditions: [...] }
    resolvedSrc = validateImageUrl(image.src.src);
    resolvedOriginalUrl = image.src.originalUrl ?? image.originalUrl;
    sourceRenditions = Array.isArray(image.src.renditions)
      ? image.src.renditions
      : image.renditions;
  }

  const normalizedRenditions = Array.isArray(sourceRenditions)
    ? sourceRenditions
        .map(rendition => {
          if (!rendition || typeof rendition !== 'object') {
            return null;
          }
          const r = rendition as Record<string, unknown>;
          const candidateSrc =
            typeof r.src === 'string' ? validateImageUrl(r.src) : undefined;
          if (!candidateSrc) {
            return null;
          }
          return {
            src: candidateSrc,
            width: typeof r.width === 'number' ? r.width : null,
            height: typeof r.height === 'number' ? r.height : null,
          };
        })
        .filter(
          (entry): entry is { src: string; width: number | null; height: number | null } =>
            Boolean(entry),
        )
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
    : undefined;

  const fallbackSrc =
    resolvedSrc ||
    (normalizedRenditions && normalizedRenditions.length > 0
      ? normalizedRenditions[normalizedRenditions.length - 1]?.src
      : undefined);

  if (!fallbackSrc) {
    return base;
  }

  const resolvedAlt =
    typeof image.alt === 'string' && image.alt.trim().length > 0
      ? image.alt
      : imageAlt ?? rest.title;

  return {
    ...base,
    image: {
      src: fallbackSrc,
      alt: resolvedAlt,
      originalUrl: resolvedOriginalUrl,
      renditions: normalizedRenditions,
    },
  };
}

export function CardGridServer({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onCardClick,
}: CardGridServerProps) {
  const cards: CardItem[] = Array.isArray(content.cards) ? content.cards : [];
  const filters: CardGridFilter[] = Array.isArray(content.filters)
    ? content.filters.filter(filter => typeof filter?.label === 'string' && filter.label.trim().length > 0)
    : [];
  const resolvedTheme = resolveTheme(theme);

  if (cards.length === 0) {
    // Don't show empty state placeholder in production
    if (!shouldShowDevEmptyStateServer()) {
      return null;
    }

    const emptyClassName = buildCmsClassName({
      base:
        'cms-card-grid-empty border border-dashed border-border/50 bg-muted/30 text-sm text-muted-foreground backdrop-blur-sm rounded-[var(--ds-radius-lg)] ds-p-lg',
      theme: resolvedTheme,
      variant,
      className,
      includeVariant: true,
    });
    return (
      <div className={emptyClassName}>
        No cards are available for this grid.
      </div>
    );
  }

  const preparedContent: NormalizedCardGridContent = {
    heading: content.heading,
    subheading: content.subheading,
    cards: cards.map(normalizeCard),
    columns: content.columns ?? 3,
    gap: content.gap ?? 'medium',
    cardStyle: content.cardStyle ?? 'vertical',
    imagePosition: content.imagePosition ?? 'top',
    imageAspectRatio: content.imageAspectRatio ?? '16:9',
    ...(filters.length > 0 ? { filters } : {}),
  };

  const sectionClassName = cn('cms-card-grid', dsSpacing.spaceY('lg'), className);

  const renderFilters = () => {
    if (filters.length === 0) {
      return null;
    }

    return (
      <div
        className={cn('flex flex-wrap items-center', dsSpacing.gap('sm'))}
        aria-label="Content filters"
      >
        {filters.map((filter, index) => {
          const key = filter.id || `${filter.label}-${index}`;
          const chipClasses = cn(
            'inline-flex items-center rounded-full border px-4 py-1 text-sm font-medium transition-colors',
            filter.isActive
              ? 'border-ring bg-card text-foreground'
              : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'
          );

          const icon = filter.icon ? (
            <span className="mr-2 text-base" aria-hidden="true">
              {filter.icon}
            </span>
          ) : null;

          if (filter.href) {
            return (
              <a
                key={key}
                href={filter.href}
                className={chipClasses}
                data-filter-id={filter.id}
                aria-current={filter.isActive ? 'true' : undefined}
              >
                {icon}
                <span>{filter.label}</span>
              </a>
            );
          }

          return (
            <span
              key={key}
              className={chipClasses}
              data-filter-id={filter.id}
              aria-current={filter.isActive ? 'true' : undefined}
            >
              {icon}
              <span>{filter.label}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <CmsSection
      theme={theme}
      variant={variant}
      className={sectionClassName}
      size="md"
    >
      {content.heading && (
        <header className={cn('flex flex-col', dsSpacing.gap('xs'))}>
          <h2 className={cmsHeading(2, resolvedTheme)}>{content.heading}</h2>
          {content.subheading && (
            <p className={cmsBody('md', resolvedTheme)}>{content.subheading}</p>
          )}
        </header>
      )}

      {renderFilters()}

      <CardGridClient
        content={preparedContent}
        className="w-full"
        theme={resolvedTheme}
        variant={variant}
        hover={true}
        onCardClick={onCardClick}
      />
    </CmsSection>
  );
}
