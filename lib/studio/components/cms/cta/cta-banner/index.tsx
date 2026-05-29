'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import type { CTABannerProps, CTABannerContent } from './cta-banner.types';

export type { CTABannerProps, CTABannerContent } from './cta-banner.types';

const CTA_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline'> = { primary: 'default', secondary: 'secondary', outline: 'outline' };

const ALIGNMENT_CLASSES = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

function normalizeButton(btn?: { label?: string; href?: unknown; variant?: string } | null) {
  if (typeof btn?.label !== 'string') return null;
  const label = btn.label.trim();
  const href = resolveSmartLinkHref(btn.href);
  if (!label || !href) return null;
  return { label, href, variant: CTA_VARIANT_MAP[btn.variant ?? ''] ?? 'default' };
}

// Filter out gradient/background classes from className to use shadcn primary instead
function sanitizeClassName(className?: string): string {
  if (!className) return '';
  return className
    .split(' ')
    .filter(cls => !cls.includes('gradient') && !cls.includes('from-') && !cls.includes('to-') && !cls.includes('via-') && !cls.includes('shadow-xl'))
    .join(' ');
}

const CTABannerComponent: React.FC<CTABannerProps> = ({ id, type, content, className, style, theme, onInteraction }) => {
  const { heading, subheading, backgroundColor, textColor, alignment = 'center', backgroundImage, fullWidth } = content ?? {};
  const sanitizedClassName = sanitizeClassName(className);
  const normalizedBackgroundImage = typeof backgroundImage === 'string' ? backgroundImage.trim() : '';

  const primaryBtn = normalizeButton(content?.primaryButton);
  const secondaryBtn = normalizeButton(content?.secondaryButton);
  const align = ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES] ?? ALIGNMENT_CLASSES.center;

  const handleClick = useCallback((btnType: string, url: string) => {
    onInteraction?.(`${btnType}-cta-click`, url);
  }, [onInteraction]);

  const explicitTextColor =
    typeof textColor === 'string' && textColor.trim().startsWith('#')
      ? textColor.trim()
      : undefined;
  const textStyle = explicitTextColor ? { color: explicitTextColor } : undefined;

  // Simplified: Only use background image if provided, ignore custom gradients for cleaner look
  const bannerStyle: React.CSSProperties = {
    ...(normalizedBackgroundImage
      ? {
          backgroundImage: `url("${normalizedBackgroundImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          ...(typeof backgroundColor === 'string' && backgroundColor.trim() ? { backgroundColor } : {}),
        }
      : {}),
    ...style,
  };

  // Ignore gradient backgrounds - use shadcn primary for cleaner, modern look
  const hasCustomBg = Boolean(normalizedBackgroundImage);

  return (
    <CmsSection size="sm" theme={theme} className={cn('cms-cta-banner', sanitizedClassName)} container={false} data-component-type={type} data-component-id={id}>
      <div className={cn('flex w-full flex-col', fullWidth ? 'mx-0 max-w-none' : 'mx-auto max-w-7xl', 'px-4 sm:px-6 lg:px-8')}>
        <div
          className={cn(
            'relative isolate flex min-h-44 flex-col overflow-hidden rounded-xl px-6 py-6 md:min-h-56 md:px-8 md:py-8',
            dsSpacing.gap('sm'),
            align,
            hasCustomBg ? 'text-primary-foreground' : 'bg-primary text-primary-foreground',
          )}
          style={bannerStyle}
        >
          {hasCustomBg && (
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-black/10"
              aria-hidden="true"
            />
          )}
          {heading && (
            <h2
              className={cn(cmsHeading(2, theme), 'max-w-3xl text-inherit drop-shadow-sm')}
              style={textStyle}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p
              className={cn(cmsBody('lg', theme), 'max-w-2xl text-inherit opacity-95 drop-shadow-sm')}
              style={textStyle}
            >
              {subheading}
            </p>
          )}

          {(primaryBtn || secondaryBtn) && (
            <div className={cn('flex flex-wrap gap-4 mt-2', align.includes('center') ? 'justify-center' : align.includes('right') ? 'justify-end' : 'justify-start')}>
              {primaryBtn && (
                <Button asChild size="lg" variant="secondary" onClick={() => handleClick('primary', primaryBtn.href)}>
                  <Link href={primaryBtn.href}>{primaryBtn.label}</Link>
                </Button>
              )}
              {secondaryBtn && (
                <Button asChild size="lg" variant="outline" onClick={() => handleClick('secondary', secondaryBtn.href)}>
                  <Link href={secondaryBtn.href}>{secondaryBtn.label}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </CmsSection>
  );
};

export const CTABanner = withPerformanceTracking(CTABannerComponent, ComponentType.CTABanner);
export default CTABanner;
