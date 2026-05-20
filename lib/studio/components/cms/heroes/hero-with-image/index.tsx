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
  const { eyebrow, heading, subheading, body, alignment = 'left', theme: contentTheme, image, ctaButtons } = content;

  const resolvedTheme = resolveTheme(contentTheme ?? theme);
  const alignCenter = alignment === 'center';

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
      className={cn('cms-hero-with-image relative overflow-hidden', className)}
      style={style}
    >
      {/* Full-width hero with text overlay on image - min-h-screen for full viewport height */}
      <div className="relative w-full min-h-screen">
        {/* Background Image */}
        {normalizedImg?.src ? (
          <button type="button" onClick={handleImageClick} className="absolute inset-0 w-full h-full">
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
            {/* Dark overlay for text readability - strong enough for busy images */}
            <div className={cn(
              'absolute inset-0',
              alignCenter
                ? 'bg-black/60' // Uniform overlay for centered text
                : 'bg-gradient-to-r from-black/80 via-black/60 to-black/30' // Strong left overlay for left-aligned
            )} aria-hidden="true" />
            {/* Additional bottom gradient for CTA visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden="true" />
          </button>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-primary to-primary/80" />
        )}

        {/* Text Overlay */}
        <div className={cn(
          'absolute inset-0 flex items-center',
          alignCenter ? 'justify-center text-center' : 'justify-start text-left'
        )}>
          <div className={cn(
            'px-4 sm:px-6 lg:px-8 max-w-7xl w-full',
            alignCenter ? 'mx-auto' : ''
          )}>
            <div className={cn(
              'flex flex-col text-white',
              dsSpacing.gap('sm'),
              alignCenter ? 'items-center max-w-3xl mx-auto' : 'items-start max-w-2xl'
            )}>
              {eyebrow && (
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/90">
                  {eyebrow}
                </p>
              )}
              {heading && (
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] text-balance">
                  {heading}
                </h1>
              )}
              {subheading && (
                <p className="text-lg sm:text-xl lg:text-2xl font-medium text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                  {subheading}
                </p>
              )}
              {body && (
                <p className="text-base sm:text-lg text-white/80 max-w-xl">
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
      </div>
    </CmsSection>
  );
};

export const HeroWithImage = withPerformanceTracking(HeroWithImageComponent, ComponentType.HeroWithImage);
export default HeroWithImage;
