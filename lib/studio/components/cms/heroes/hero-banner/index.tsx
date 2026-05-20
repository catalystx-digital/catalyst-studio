"use client";

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { HeroBackground } from '../_shared/hero-background';
import { HeroCTA, type CTAButton } from '../_shared/hero-cta';
import { HEIGHT_CLASSES, ALIGNMENT_CLASSES } from '../_shared';
import type { HeroBannerProps } from './hero-banner.types';

const HeroBannerComponent: React.FC<HeroBannerProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'dark',
  onLoad,
  onInteraction,
}) => {
  const {
    heading,
    subheading,
    body,
    backgroundImage,
    overlay,
    ctaButtons,
    alignment = 'center',
    height = 'full',
    parallax,
  } = content;

  const resolvedTheme = resolveTheme(theme) ?? 'dark';

  const handleCtaClick = useCallback(
    (button: CTAButton, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const sectionClassName = cn(
    'cms-hero-banner relative flex w-full items-center justify-center overflow-hidden',
    // Default to 'full' for maximum visual impact (homepage heroes)
    HEIGHT_CLASSES[height as keyof typeof HEIGHT_CLASSES] ?? HEIGHT_CLASSES.full,
    resolvedTheme === 'dark' ? 'bg-background text-foreground' : 'bg-muted text-foreground',
    className,
  );

  return (
    <CmsSection
      container={false}
      size="xs"
      theme={theme}
      data-component-id={id}
      data-component-type={type}
      className={sectionClassName}
      style={style}
    >
      {/* Gradient fallback */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/30 via-primary/15 to-secondary/20" aria-hidden="true" />

      {/* Background image */}
      <HeroBackground
        image={backgroundImage}
        overlay={overlay ? { color: overlay.color, opacity: overlay.opacity, gradient: overlay.gradient } : undefined}
        parallax={parallax}
        onLoad={onLoad}
      />

      {/* Text contrast overlay for readability - stronger overlay for better text visibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/60 via-black/40 to-black/20" aria-hidden="true" />

      {/* Content - pt-16 accounts for fixed navbar height in transparent mode */}
      <div className="relative z-20 flex h-full w-full items-center pt-16">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className={cn(
            'flex flex-col justify-center',
            dsSpacing.gap('lg'),
            ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES],
            alignment === 'center' && 'mx-auto',
          )}>
            {heading && (
              <h1 className={cn(cmsHeading(1, resolvedTheme), 'leading-tight')}>{heading}</h1>
            )}
            {subheading && (
              <h2 className={cmsHeading(3, resolvedTheme, 'text-white/80 font-normal')}>{subheading}</h2>
            )}
            {body && (
              <p className={cn(cmsBody('lg', resolvedTheme), 'max-w-2xl')}>{body}</p>
            )}
            {ctaButtons && ctaButtons.length > 0 && (
              <HeroCTA
                buttons={ctaButtons as any}
                alignment={alignment}
                theme={resolvedTheme}
                onCtaClick={handleCtaClick as any}
                className={dsSpacing.mt('sm')}
              />
            )}
          </div>
        </div>
      </div>
    </CmsSection>
  );
};

export const HeroBanner = withPerformanceTracking(HeroBannerComponent, ComponentType.HeroBanner);
export default HeroBanner;
export type { HeroBannerProps, HeroBannerContent, CTAButton } from './hero-banner.types';
