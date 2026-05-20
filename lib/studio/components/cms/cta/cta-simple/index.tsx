'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { CARD_TONES, themeClass, CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import type { CTASimpleProps, CTASimpleContent } from './cta-simple.types';
import type { CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

export type { CTASimpleProps, CTASimpleContent } from './cta-simple.types';

const VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'> = {
  accent: 'default', neutral: 'secondary', default: 'default', secondary: 'secondary',
  outline: 'outline', ghost: 'ghost', link: 'link', destructive: 'destructive', primary: 'default',
};

const ALIGNMENT = {
  left: { container: 'items-start text-left', buttons: 'sm:justify-start' },
  center: { container: 'items-center text-center', buttons: 'sm:justify-center' },
  right: { container: 'items-end text-right', buttons: 'sm:justify-end' },
} as const;

const CARD_TONE = { surface: 'default', accent: 'accent', inverted: 'minimal' } as const;

function resolveUrl(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value) {
    for (const key of ['href', 'url', 'value', 'originalUrl', 'link', 'path']) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

function normalizeButton(btn?: CTAButton | null) {
  if (!btn) return null;
  // Support both 'label' (standard) and 'text' (legacy) for backwards compatibility
  const rawLabel = (btn as Record<string, unknown>).label ?? (btn as Record<string, unknown>).text;
  const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  const href = resolveUrl(btn.href || btn);
  if (!label || !href) return null;
  return { label, href, variant: VARIANT_MAP[btn.variant ?? ''] };
}

const CTASimpleComponent: React.FC<CTASimpleProps> = ({ id, type, content, className, style, theme, onInteraction }) => {
  const { eyebrow, heading, body, alignment = 'center', backgroundVariant = 'surface' } = content ?? {};

  const primaryBtn = normalizeButton(content?.primaryButton);
  const secondaryBtn = normalizeButton(content?.secondaryButton);
  const align = ALIGNMENT[alignment as keyof typeof ALIGNMENT] ?? ALIGNMENT.left;
  const tone = CARD_TONE[backgroundVariant as keyof typeof CARD_TONE] ?? 'default';

  const handleClick = useCallback((btnType: string, url: string) => {
    onInteraction?.(`${btnType}-cta-click`, url);
  }, [onInteraction]);

  return (
    <CmsSection size="md" theme={theme} className={cn('cms-cta-simple', className)} data-component-type={type} data-component-id={id} style={style}>
      <Card className={cn('mx-auto w-full max-w-4xl', CARD_TONES[tone], themeClass(theme), dsSpacing.gap('md'), backgroundVariant === 'accent' && 'bg-gradient-to-br from-secondary via-secondary to-secondary/80 shadow-xl')}>
        <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'pb-0 text-inherit', align.container, dsSpacing.gap('xs'), dsSpacing.px('lg'), dsSpacing.pt('lg'))}>
          {eyebrow && <span className="text-xs font-semibold uppercase tracking-wide text-primary truncate max-w-full">{eyebrow}</span>}
          {heading && <h3 className={cmsHeading(3, theme, 'text-inherit line-clamp-3')}>{heading}</h3>}
          {body && <p className={cmsBody('md', theme, 'text-inherit opacity-90 line-clamp-4')}>{body}</p>}
        </CardHeader>
        {(primaryBtn || secondaryBtn) && (
          <CardFooter className={cn('flex items-center gap-3 p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col sm:flex-row items-stretch', dsSpacing.gap('sm'), dsSpacing.px('lg'), dsSpacing.pb('lg'), align.buttons)}>
            {primaryBtn && (
              <Button asChild size="lg" variant={primaryBtn.variant ?? 'default'} onClick={() => handleClick('primary', primaryBtn.href)}>
                <Link href={primaryBtn.href}>{primaryBtn.label}</Link>
              </Button>
            )}
            {secondaryBtn && (
              <Button asChild size="lg" variant={secondaryBtn.variant ?? 'outline'} onClick={() => handleClick('secondary', secondaryBtn.href)}>
                <Link href={secondaryBtn.href}>{secondaryBtn.label}</Link>
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </CmsSection>
  );
};

export const CTASimple = withPerformanceTracking(CTASimpleComponent, ComponentType.CTASimple);
export default CTASimple;
