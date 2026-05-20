"use client";

import React, { useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { HeroMinimalProps, CTAButton } from './hero-minimal.types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { validatePatternUrl } from '../../_utils/url-validation';
import { HeroCTA, ALIGNMENT_CLASSES } from '../_shared';

const MAX_WIDTH_CLASSES = {
  small: 'max-w-2xl',
  medium: 'max-w-3xl',
  large: 'max-w-4xl',
  full: 'max-w-none',
} as const;

const HeroMinimalComponent: React.FC<HeroMinimalProps> = ({
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
    heading,
    subheading,
    ctaButtons,
    alignment = 'center',
    backgroundPattern: rawBackgroundPattern,
    padding = 'large',
    backgroundColor,
    textColor,
    maxWidth = 'large',
  } = content;

  const resolvedTheme = resolveTheme(theme);
  const backgroundPattern = validatePatternUrl(rawBackgroundPattern);

  useEffect(() => { onLoad?.(); }, [onLoad]);

  const handleCtaClick = useCallback(
    (button: CTAButton, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const sectionBackgroundClass = resolvedTheme === 'dark' || resolvedTheme === 'inverted'
    ? 'bg-background text-foreground'
    : 'bg-muted text-foreground';

  return (
    <CmsSection
      container={false}
      size={padding === 'small' ? 'sm' : 'md'}
      theme={theme}

      data-component-id={id}
      data-component-type={type}
      className={cn('cms-hero-minimal relative w-full', sectionBackgroundClass, className)}
      style={{
        ...style,
        ...(backgroundColor ? { background: backgroundColor } : null),
        ...(textColor ? { color: textColor } : null),
      }}
    >
      {backgroundPattern && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `url("${backgroundPattern}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}

      {/* pt-16 accounts for fixed navbar height in transparent mode */}
      <div className="relative z-10 flex w-full pt-16">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className={cn(
            'flex flex-col',
            dsSpacing.gap('lg'),
            MAX_WIDTH_CLASSES[maxWidth as keyof typeof MAX_WIDTH_CLASSES] ?? MAX_WIDTH_CLASSES.large,
            ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES],
            alignment === 'center' ? 'mx-auto' : alignment === 'left' ? 'mr-auto' : 'ml-auto',
          )}>
            {heading && <h1 className={cmsHeading(1, resolvedTheme)}>{heading}</h1>}
            {subheading && (
              <p className={cmsBody('xl', resolvedTheme, 'max-w-2xl text-muted-foreground')}>
                {subheading}
              </p>
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

export const HeroMinimal = withPerformanceTracking(HeroMinimalComponent, ComponentType.HeroMinimal);
export default HeroMinimal;
export type { HeroMinimalProps, HeroMinimalContent, CTAButton } from './hero-minimal.types';
