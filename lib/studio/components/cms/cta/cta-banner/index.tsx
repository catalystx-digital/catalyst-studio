'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import type { CTABannerProps, CTABannerContent } from './cta-banner.types';

export type { CTABannerProps, CTABannerContent } from './cta-banner.types';

const CTA_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline'> = { primary: 'default', secondary: 'secondary', outline: 'outline' };

const ALIGNMENT_CLASSES = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

function normalizeButton(btn?: { label?: string; href?: string; variant?: string } | null) {
  if (typeof btn?.label !== 'string' || typeof btn?.href !== 'string') return null;
  const label = btn.label.trim();
  const href = btn.href.trim();
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

  const primaryBtn = normalizeButton(content?.primaryButton);
  const secondaryBtn = normalizeButton(content?.secondaryButton);
  const align = ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES] ?? ALIGNMENT_CLASSES.center;

  const handleClick = useCallback((btnType: string, url: string) => {
    onInteraction?.(`${btnType}-cta-click`, url);
  }, [onInteraction]);

  // Simplified: Only use background image if provided, ignore custom gradients for cleaner look
  const bannerStyle: React.CSSProperties = {
    ...(backgroundImage ? { backgroundImage: `url("${backgroundImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
    ...style,
  };

  // Ignore gradient backgrounds - use shadcn primary for cleaner, modern look
  const hasCustomBg = backgroundImage;

  return (
    <CmsSection size="sm" theme={theme} className={cn('cms-cta-banner', sanitizedClassName)} container={false} data-component-type={type} data-component-id={id}>
      <div className={cn('flex w-full flex-col', fullWidth ? 'mx-0 max-w-none' : 'mx-auto max-w-7xl', 'px-4 sm:px-6 lg:px-8')}>
        <div
          className={cn(
            'flex flex-col rounded-xl px-6 py-6 md:px-8 md:py-8',
            dsSpacing.gap('sm'),
            align,
            hasCustomBg ? 'text-primary-foreground' : 'bg-primary text-primary-foreground',
          )}
          style={bannerStyle}
        >
          {heading && <h2 className={cn(cmsHeading(2, theme), (typeof textColor === 'string' && textColor.trim()) || 'text-inherit')}>{heading}</h2>}
          {subheading && <p className={cn(cmsBody('lg', theme), 'opacity-90 max-w-2xl', (typeof textColor === 'string' && textColor.trim()) || 'text-inherit')}>{subheading}</p>}

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
