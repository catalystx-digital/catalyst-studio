'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { CmsButtonGroup, CARD_TONES, themeClass, CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import type { CTAButtonGroupProps, CTAButtonGroupContent, CTAButton } from './cta-button-group.types';

export type { CTAButtonGroupProps, CTAButtonGroupContent, CTAButton } from './cta-button-group.types';

const VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'> = {
  primary: 'default', accent: 'default', default: 'default', secondary: 'secondary',
  neutral: 'secondary', outline: 'outline', ghost: 'ghost', link: 'link', destructive: 'destructive',
};

const SIZE_MAP: Record<string, 'sm' | 'default' | 'lg'> = { small: 'sm', medium: 'default', large: 'lg' };

const ALIGNMENT = {
  left: { header: 'items-start text-left', align: 'start' as const },
  center: { header: 'items-center text-center', align: 'center' as const },
  right: { header: 'items-end text-right', align: 'end' as const },
} as const;

type NormalizedButton = {
  label: string;
  href: string;
  variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  size: 'lg';
  icon?: string;
  iconPosition: 'left' | 'right';
  backgroundColor?: string;
};

function normalizeButtons(buttons?: CTAButton[]) {
  if (!Array.isArray(buttons)) return [];
  const normalized: NormalizedButton[] = [];
  buttons.forEach(b => {
    if (typeof b?.label !== 'string') return;
    const label = b.label.trim();
    const href = resolveSmartLinkHref(b.href);
    if (!label || !href) return;
    normalized.push({
      label,
      href,
      variant: VARIANT_MAP[b.variant ?? ''] ?? 'default',
      size: 'lg',
      icon: typeof b.icon === 'string' ? b.icon.trim() : undefined,
      iconPosition: 'left',
      backgroundColor: undefined,
    });
  });
  return normalized;
}

const CTAButtonGroupComponent: React.FC<CTAButtonGroupProps> = ({ id, type, content, className, style, theme, onInteraction }) => {
  const { heading, subheading, alignment = 'center', orientation = 'horizontal', fullWidthOnMobile = false } = content ?? {};

  const buttons = normalizeButtons(content?.buttons);
  const align = ALIGNMENT[alignment as keyof typeof ALIGNMENT] ?? ALIGNMENT.center;
  const isVertical = orientation === 'vertical';

  const handleClick = useCallback((index: number, href: string, label: string) => {
    onInteraction?.('button-click', { index, href, label });
  }, [onInteraction]);

  return (
    <CmsSection size="md" theme={theme} className={cn('cms-cta-button-group w-full', className)} containerClassName="items-center gap-0" style={style} data-component-type={type} data-component-id={id}>
      <Card className={cn('mx-auto flex w-full max-w-3xl flex-col', CARD_TONES['minimal'], themeClass(theme), dsSpacing.gap('md'), dsSpacing.px('md'), 'sm:' + dsSpacing.px('lg'), dsSpacing.py('lg'), 'md:' + dsSpacing.py('xl'))}>
        <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'px-0 pt-0 text-inherit', dsSpacing.gap('sm'), align.header)}>
          {heading && <h2 className={cmsHeading(2, theme, 'text-inherit')}>{heading}</h2>}
          {subheading && <p className={cmsBody('md', theme, 'text-muted-foreground')}>{subheading}</p>}
        </CardHeader>
        <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'px-0 pb-0')}>
          {buttons.length > 0 && (
            <CmsButtonGroup align={isVertical ? 'stretch' : align.align} responsive={isVertical ? 'md' : 'sm'} wrap={!isVertical} theme={theme} fullWidthOnMobile={fullWidthOnMobile} className={cn('w-full', isVertical && 'flex-col')}>
              {buttons.map((btn, i) => {
                const buttonStyle = btn.backgroundColor ? { backgroundColor: btn.backgroundColor, borderColor: btn.backgroundColor } : undefined;
                return (
                  <Button key={`${id}-btn-${i}`} asChild size={btn.size} variant={btn.variant} className={cn('font-semibold', isVertical ? 'w-full' : fullWidthOnMobile ? 'w-full sm:w-auto' : undefined, btn.backgroundColor && 'text-white hover:opacity-90')} style={buttonStyle} onClick={() => handleClick(i, btn.href, btn.label)}>
                    <Link href={btn.href} className={cn('inline-flex items-center justify-center', dsSpacing.gap('xs'))}>
                      {btn.icon && btn.iconPosition === 'left' && <span aria-hidden="true">{btn.icon}</span>}
                      <span>{btn.label}</span>
                      {btn.icon && btn.iconPosition === 'right' && <span aria-hidden="true">{btn.icon}</span>}
                    </Link>
                  </Button>
                );
              })}
            </CmsButtonGroup>
          )}
        </CardContent>
      </Card>
    </CmsSection>
  );
};

export const CTAButtonGroup = withPerformanceTracking(CTAButtonGroupComponent, ComponentType.CTAButtonGroup);
export default CTAButtonGroup;
