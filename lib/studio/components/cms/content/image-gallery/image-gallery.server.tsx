import React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  cmsBody,
  cmsHeading,
  CmsButtonGroup,
  CmsSection,
  dsSpacing,
  themeClass,
} from '../../_ui';
import { shouldShowDevEmptyStateServer } from '../../_core/env-utils';
import { sanitizeText } from '../../_core/security';
import type { ImageGalleryProps, GalleryImage } from './image-gallery.types';

const GRID_COLUMN_CLASSES: Record<
  NonNullable<ImageGalleryProps['content']['columns']>,
  string
> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

const MASONRY_COLUMN_CLASSES: Record<
  NonNullable<ImageGalleryProps['content']['columns']>,
  string
> = {
  2: 'columns-1 sm:columns-2',
  3: 'columns-1 sm:columns-2 lg:columns-3',
  4: 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4',
  5: 'columns-1 sm:columns-2 lg:columns-3 xl:columns-5',
  6: 'columns-1 sm:columns-2 lg:columns-3 xl:columns-6',
};

const GRID_GAP_CLASS: Record<
  NonNullable<ImageGalleryProps['content']['spacing']>,
  string
> = {
  tight: dsSpacing.gap('sm'),
  normal: dsSpacing.gap('lg'),
  loose: dsSpacing.gap('xl'),
};

const MASONRY_COLUMN_GAP_CLASS: Record<
  NonNullable<ImageGalleryProps['content']['spacing']>,
  string
> = {
  tight: '[column-gap:var(--ds-spacing-sm)]',
  normal: '[column-gap:var(--ds-spacing-lg)]',
  loose: '[column-gap:var(--ds-spacing-xl)]',
};

const MASONRY_VERTICAL_GAP_CLASS: Record<
  NonNullable<ImageGalleryProps['content']['spacing']>,
  string
> = {
  tight: dsSpacing.spaceY('sm'),
  normal: dsSpacing.spaceY('md'),
  loose: dsSpacing.spaceY('lg'),
};

const DEFAULT_RATIO = 4 / 3;

function resolveRatio(image: GalleryImage, fallback = DEFAULT_RATIO): number {
  if (image.width && image.height && image.height !== 0) {
    return image.width / image.height;
  }
  return fallback;
}

export const ImageGalleryServer: React.FC<ImageGalleryProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}) => {
  const {
    images = [],
    displayMode = 'grid',
    columns = 3,
    spacing = 'normal',
    showCaptions = true,
    enableLightbox = true,
    heading,
    subheading,
    maxWidth = 'large',
  } = content;

  const gridGapClass = GRID_GAP_CLASS[spacing] ?? GRID_GAP_CLASS.normal;
  const masonryColumnGapClass =
    MASONRY_COLUMN_GAP_CLASS[spacing] ?? MASONRY_COLUMN_GAP_CLASS.normal;
  const masonryVerticalGapClass =
    MASONRY_VERTICAL_GAP_CLASS[spacing] ?? MASONRY_VERTICAL_GAP_CLASS.normal;
  const isCarousel = displayMode === 'carousel';
  const isMasonry = displayMode === 'masonry';
  const maxWidthClass =
    maxWidth === 'full'
      ? 'w-full'
      : maxWidth === 'medium'
        ? 'max-w-4xl'
        : 'max-w-6xl';

  const gridWrapperClass = isMasonry
    ? cn(
        'cms-gallery-collection w-full list-none p-0',
        MASONRY_COLUMN_CLASSES[columns] ?? MASONRY_COLUMN_CLASSES[3],
        masonryVerticalGapClass,
        masonryColumnGapClass,
      )
    : cn(
        'cms-gallery-collection grid w-full list-none p-0',
        GRID_COLUMN_CLASSES[columns] ?? GRID_COLUMN_CLASSES[3],
        gridGapClass,
      );

  const renderCaption = (image: GalleryImage) => {
    if (!showCaptions || !image.caption) {
      return null;
    }

    return (
      <figcaption className={cmsBody('sm', theme, 'text-center text-muted-foreground')}>
        {sanitizeText(image.caption)}
      </figcaption>
    );
  };

  const renderGridOrMasonry = () => {
    if (images.length === 0) {
      // In production/exported sites, hide empty galleries entirely
      if (!shouldShowDevEmptyStateServer()) {
        return null;
      }
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-xl border border-border/40 bg-gradient-to-br from-muted/60 to-muted/30 shadow-md shadow-black/5',
            dsSpacing.px('lg'),
            dsSpacing.py('2xl'),
          )}
        >
          <p className={cmsBody('md', theme, 'text-muted-foreground')}>
            No images available for this gallery.
          </p>
        </div>
      );
    }

    return (
      <div className={cn('mx-auto w-full', maxWidthClass)}>
        <div
          className={gridWrapperClass}
          data-gallery-collection="grid"
          data-columns={columns}
        >
          {images.map((image, index) => {
            const ratio = resolveRatio(image);
            return (
              <figure
                key={`${image.url}-${index}`}
                className={cn(
                  'cms-gallery-item group relative flex flex-col',
                  dsSpacing.gap('sm'),
                  isMasonry && 'break-inside-avoid',
                )}
                data-gallery-item
                data-image-index={index}
                data-interactive={enableLightbox ? 'true' : 'false'}
              >
                <AspectRatio
                  ratio={ratio}
                  className="overflow-hidden rounded-xl border border-border/40 bg-muted/80 transition-shadow group-hover:shadow-md"
                >
                  <Image
                    src={image.url}
                    alt={sanitizeText(image.alt)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover"
                  />
                </AspectRatio>
                {renderCaption(image)}
              </figure>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCarousel = () => {
    if (images.length === 0) {
      // In production/exported sites, hide empty carousels entirely
      if (!shouldShowDevEmptyStateServer()) {
        return null;
      }
      return (
        <div
          className={cn(
            'flex items-center justify-center rounded-xl border border-border/40 bg-gradient-to-br from-muted/60 to-muted/30 shadow-md shadow-black/5',
            dsSpacing.px('lg'),
            dsSpacing.py('2xl'),
          )}
        >
          <p className={cmsBody('md', theme, 'text-muted-foreground')}>
            No images available for this carousel.
          </p>
        </div>
      );
    }

    return (
      <div className={cn('cms-gallery-carousel flex flex-col', dsSpacing.gap('md'))}>
        <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/70">
          <div
            className="flex transition-transform duration-500 ease-out"
            data-gallery-track
            style={{ transform: 'translateX(0%)' }}
          >
            {images.map((image, index) => (
              <figure
                key={`${image.url}-${index}`}
                className={cn('flex w-full shrink-0 flex-col', dsSpacing.gap('sm'))}
                data-gallery-slide={index}
              >
                <AspectRatio
                  ratio={resolveRatio(image, 16 / 9)}
                  className="overflow-hidden rounded-xl bg-muted/80"
                >
                  <Image
                    src={image.url}
                    alt={sanitizeText(image.alt)}
                    fill
                    sizes="100vw"
                    priority={index === 0}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="h-full w-full object-contain"
                  />
                </AspectRatio>
                {renderCaption(image)}
              </figure>
            ))}
          </div>
        </div>

        {images.length > 1 && (
          <div className={cn('flex items-center justify-center', dsSpacing.gap('sm'))}>
            <CmsButtonGroup>
              {images.map((_, index) => (
                <Button
                  key={`dot-${index}`}
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Go to slide ${index + 1}`}
                  aria-pressed={index === 0}
                  data-gallery-dot
                  data-index={index}
                  className="h-8 w-8 rounded-full transition-shadow aria-pressed:bg-gradient-to-r aria-pressed:from-primary/20 aria-pressed:to-primary/10 aria-pressed:shadow-md aria-pressed:text-foreground hover:bg-muted/50"
                >
                  <span className="sr-only">Slide {index + 1}</span>
                  <span className="mx-auto block h-2 w-2 rounded-full bg-border-default/50 transition-[width,height,background-color] aria-pressed:bg-primary aria-pressed:h-2.5 aria-pressed:w-2.5" />
                </Button>
              ))}
            </CmsButtonGroup>
          </div>
        )}
      </div>
    );
  };

  return (
    <CmsSection
      id={id}
      size="lg"
      theme={theme}
      variant={variant}
      className={cn('cms-image-gallery', className)}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('xl'))}
      style={style}
      data-testid="cms-image-gallery"
      data-analytics-id={analyticsId}
      data-component-type="image-gallery"
      data-variant={variant}
      data-display-mode={displayMode}
    >
      <Card className={cn(themeClass(theme), 'w-full')}>
      {(heading || subheading) && (
        <CardHeader
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'items-center text-center', dsSpacing.gap('sm'))}
        >
          {heading && (
            <h2 className={cmsHeading(3, theme)}>{sanitizeText(heading)}</h2>
          )}
          {subheading && (
            <p className={cmsBody('md', theme, 'text-muted-foreground')}>
              {sanitizeText(subheading)}
            </p>
          )}
        </CardHeader>
      )}

      <CardContent
        className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('lg'), dsSpacing.padding('lg'))}
      >
        {isCarousel ? renderCarousel() : renderGridOrMasonry()}
      </CardContent>
      </Card>
    </CmsSection>
  );
};
