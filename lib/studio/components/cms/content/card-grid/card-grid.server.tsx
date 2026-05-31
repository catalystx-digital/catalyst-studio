import React from 'react';

import { cn } from '@/lib/utils';
import {
  CmsSection,
  buildCmsClassName,
  cmsBody,
  dsSpacing,
  resolveTheme,
  themeClass,
} from '../../_ui';
import { shouldShowDevEmptyStateServer } from '../../_core/env-utils';
import { normalizeCmsImage } from '../../_utils/media-reference';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import { CardGridClient } from './card-grid.client';
import {
  CardGridServerProps,
  CardItem,
  CardGridFilter,
  NormalizedCardGridContent,
  NormalizedCardItem,
} from './card-grid.types';

function normalizeCard(card: CardItem & { bgColor?: string }): NormalizedCardItem {
  const id = card.id || `card-${Math.random().toString(36).slice(2, 11)}`;
  const { image, imageAlt, bgColor, ...rest } = card;
  const link = resolveSmartLinkHref(rest.link) ?? resolveSmartLinkHref(rest.href);
  const base: NormalizedCardItem = {
    ...rest,
    id,
    imageAlt,
    ...(link ? { link } : {}),
    // Map bgColor from LLM output to backgroundColor expected by component
    backgroundColor: bgColor ?? rest.backgroundColor,
  };

  const normalizedImage = normalizeCmsImage(image, imageAlt);
  if (!normalizedImage) {
    return base;
  }

  const imageAltText = typeof normalizedImage.alt === 'string' ? normalizedImage.alt.trim() : '';
  const titleText = typeof rest.title === 'string' ? rest.title.trim() : '';
  const normalizedAlt = imageAltText.toLowerCase();
  const normalizedTitle = titleText.toLowerCase();

  return {
    ...base,
    image: {
      ...normalizedImage,
      alt: normalizedAlt && normalizedAlt !== normalizedTitle ? imageAltText : '',
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
    imageLoading: content.imageLoading,
    featureFirstCard: content.featureFirstCard,
    ...(filters.length > 0 ? { filters } : {}),
  };

  const sectionClassName = cn('cms-card-grid', className);

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
            const href = resolveSmartLinkHref(filter.href);
            if (!href) {
              return null;
            }
            return (
              <a
                key={key}
                href={href}
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
      container
      containerClassName={cn('items-stretch', dsSpacing.gap('lg'))}
      size="md"
    >
      {content.heading && (
        <header className={cn('flex max-w-3xl flex-col', dsSpacing.gap('xs'))}>
          <h2
            className={cn(
              'text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:ds-heading-2',
              themeClass(resolvedTheme),
            )}
          >
            {content.heading}
          </h2>
          {content.subheading && (
            <p className={cmsBody('md', resolvedTheme, 'max-w-2xl')}>{content.subheading}</p>
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
