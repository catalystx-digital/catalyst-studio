"use client";

import React, { useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { HeroWithImageProps, HeroWithImageCTA } from './hero-with-image.types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { normalizeImage } from '../../_utils/image-normalization';
import { HeroCTA } from '../_shared';

const HERO_IMAGE_SIZES = '100vw';

function stripMarkup(value: string | undefined): string | undefined {
  return value?.replace(/<[^>]*>/g, '').trim();
}

const HeroWithImageComponent: React.FC<HeroWithImageProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'auto',
  onLoad,
  onInteraction,
}) => {
  const {
    eyebrow: rawEyebrow,
    heading: rawHeading,
    subheading: rawSubheading,
    body: rawBody,
    alignment = 'left',
    layout = 'image-left',
    theme: contentTheme,
    image,
    ctaButtons,
  } = content;

  const resolvedTheme = resolveTheme(contentTheme ?? theme);
  const alignCenter = alignment === 'center';
  const imageFirst = layout !== 'image-right';
  const eyebrow = stripMarkup(rawEyebrow);
  const heading = stripMarkup(rawHeading);
  const subheading = stripMarkup(rawSubheading);
  const body = stripMarkup(rawBody);

  // Use shared image normalization utility
  const normalizedImg = useMemo(() => normalizeImage(image as any, heading, HERO_IMAGE_SIZES), [image, heading]);

  useEffect(() => { onLoad?.(); }, [onLoad]);

  const handleCtaClick = useCallback(
    (button: HeroWithImageCTA, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const handleImageClick = useCallback(() => {
    if (normalizedImg?.src) {
      onInteraction?.('image-click', { src: normalizedImg.src, alt: normalizedImg.alt });
    }
  }, [normalizedImg, onInteraction]);

  return (
    <CmsSection
      container={false}
      data-component-id={id}
      data-component-type={type}
      theme={resolvedTheme}
      size="none"
      className={cn('cms-hero-with-image bg-background', className)}
      style={style}
    >
      <div className="mx-auto grid w-full max-w-7xl md:min-h-[28rem] md:grid-cols-[2fr_1fr]">
        <div className={cn(
          'relative min-h-[18rem] overflow-hidden md:min-h-[28rem]',
          !imageFirst && 'md:order-2'
        )}>
          {normalizedImg?.src ? (
            <button type="button" onClick={handleImageClick} className="absolute inset-0 h-full w-full">
              <span className="sr-only">Expand hero media</span>
              <img
                src={normalizedImg.src}
                srcSet={normalizedImg.srcSet}
                sizes={normalizedImg.sizes}
                alt={normalizedImg.alt ?? ''}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                data-original-url={normalizedImg.originalUrl}
              />
            </button>
          ) : (
            <div className="absolute inset-0 h-full w-full bg-muted" />
          )}
        </div>

        <div className={cn(
          'flex min-h-[18rem] items-center bg-primary px-8 py-10 text-primary-foreground md:min-h-[28rem] lg:px-10',
          !imageFirst && 'md:order-1',
          alignCenter ? 'justify-center text-center' : 'justify-start text-left'
        )}>
          <div className={cn(
            'flex flex-col',
            dsSpacing.gap('sm'),
            alignCenter ? 'items-center' : 'items-start'
          )}>
              {eyebrow && (
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground/90">
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h1 className="text-3xl font-bold leading-tight text-primary-foreground sm:text-4xl">
                  {heading}
                </h1>
              )}
              {subheading && (
                <p className={cn(cmsHeading(3), 'text-primary-foreground/95')}>
                  {subheading}
                </p>
              )}
              {body && (
                <p className={cn(cmsBody(), 'text-primary-foreground/90')}>
                  {body}
                </p>
              )}
              {ctaButtons && ctaButtons.length > 0 && (
                <HeroCTA
                  buttons={ctaButtons as any}
                  alignment={alignment}
                  theme="dark"
                  onCtaClick={handleCtaClick as any}
                  className={dsSpacing.mt('xs')}
                />
              )}
          </div>
        </div>
      </div>
    </CmsSection>
  );
};

export const HeroWithImage = withPerformanceTracking(HeroWithImageComponent, ComponentType.HeroWithImage);
export default HeroWithImage;
