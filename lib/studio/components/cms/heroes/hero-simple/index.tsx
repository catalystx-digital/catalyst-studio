"use client";

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { safeString } from '../../_core/safe-string';
import { HeroBackground } from '../_shared/hero-background';
import { HeroCTA, type CTAButton } from '../_shared/hero-cta';
import { ALIGNMENT_CLASSES, HEIGHT_CLASSES } from '../_shared';
import type { HeroSimpleProps, HeroSimpleLink } from './hero-simple.types';

const HeroSimpleComponent: React.FC<HeroSimpleProps> = ({
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
    eyebrow,
    heading,
    subheading,
    body,
    ctaButtons = [],
    supportingLinks,
    alignment = 'center',
    background,
    height = 'full',
  } = content;

  // Auto-detect theme based on background: use dark (white text) when image is present
  const hasBackgroundImage = Boolean(background?.image);
  const resolvedTheme = resolveTheme(theme) ?? (hasBackgroundImage ? 'dark' : undefined);

  const handleCtaClick = useCallback(
    (button: CTAButton, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const handleLinkClick = (link: HeroSimpleLink, index: number) => {
    onInteraction?.('link-click', { label: link.label, href: link.href, index });
  };

  // Compute height class - use HEIGHT_CLASSES for consistent hero sizing
  // Default to 'full' for maximum visual impact (homepage heroes)
  const heightClass = HEIGHT_CLASSES[height as keyof typeof HEIGHT_CLASSES] ?? HEIGHT_CLASSES.full;

  return (
    <CmsSection
      container={false}
      data-component-id={id}
      data-component-type={type}
      theme={resolvedTheme}
      size="none"
      className={cn(
        'cms-hero-simple relative flex items-center justify-center overflow-hidden',
        heightClass,
        className,
      )}
      style={{
        ...style,
        ...(background?.color ? { backgroundColor: background.color } : null),
        ...(background?.gradient ? { backgroundImage: background.gradient } : null),
      }}
    >
      <HeroBackground
        image={background?.image}
        overlay={background?.overlayColor ? { color: background.overlayColor, opacity: background.overlayOpacity } : undefined}
        onLoad={onLoad}
      />

      {/* pt-16 accounts for fixed navbar height in transparent mode */}
      <div className="relative z-10 flex h-full w-full items-center justify-center pt-16">
        <div className={cn(
          'mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8',
          dsSpacing.gap('xl'),
          'flex flex-col',
          ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES],
        )}>
          {eyebrow && (
            <p className={cmsBody('sm', resolvedTheme, 'font-bold uppercase tracking-widest text-accent')}>
              {safeString(eyebrow)}
            </p>
          )}
          {heading && <h1 className={cmsHeading(1, resolvedTheme, 'leading-tight')}>{safeString(heading)}</h1>}
          {subheading && (
            <p className={cmsBody('xl', resolvedTheme, cn(
              'font-light',
              // For dark theme (white text on image), use high-contrast white instead of muted-foreground
              hasBackgroundImage ? 'text-white/90' : 'text-muted-foreground'
            ))}>{safeString(subheading)}</p>
          )}
          {body && <p className={cmsBody('lg', resolvedTheme, hasBackgroundImage ? 'text-white/80' : 'text-muted-foreground')}>{safeString(body)}</p>}

          {ctaButtons.length > 0 && (
            <HeroCTA
              buttons={ctaButtons as any}
              alignment={alignment}
              theme={resolvedTheme}
              onCtaClick={handleCtaClick as any}
              className={dsSpacing.mt('md')}
            />
          )}

          {supportingLinks && supportingLinks.length > 0 && (
            <div className={cn('flex flex-wrap text-sm gap-4', alignment === 'center' && 'justify-center')}>
              {supportingLinks.map((link, index) => (
                <a
                  key={`${link.href}-${index}`}
                  href={link.href}
                  className="text-accent hover:text-accent-foreground transition-colors"
                  onClick={() => handleLinkClick(link, index)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </CmsSection>
  );
};

export const HeroSimple = withPerformanceTracking(HeroSimpleComponent, ComponentType.HeroSimple);
export default HeroSimple;
