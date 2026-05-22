'use client';

import React from 'react';
import { Check, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { PricingCardProps } from './pricing-card.types';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';
import {
  sanitizeText,
  validateUrl,
} from '@/lib/studio/components/cms/_core/security';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { resolveCmsIcon } from '@/lib/studio/components/cms/_utils/icon-resolver';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CmsBadge,
  CARD_TONES,
  themeClass,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';

function formatPrice(amount: number | string, currency: string = 'USD'): string {
  // Handle string prices like "Custom", "Contact Us", etc.
  if (typeof amount === 'string') {
    return amount;
  }

  // Handle NaN or invalid numbers
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return 'Custom';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

function formatBillingPeriod(period: 'monthly' | 'annual' | 'one-time'): string {
  switch (period) {
    case 'monthly':
      return '/month';
    case 'annual':
      return '/year';
    default:
      return '';
  }
}

function resolveTone(params: {
  highlighted?: boolean;
  disabled?: boolean;
  variant?: PricingCardProps['variant'];
}): CmsCardTone {
  if (params.disabled) return 'minimal';
  if (params.highlighted) return 'accent';
  if (params.variant === 'filled') return 'muted';
  return 'default';
}

function navigateTo(url?: string) {
  if (!url || typeof window === 'undefined') {
    return;
  }

  window.open(url, '_self');
}

const PricingCardComponent: React.FC<PricingCardProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const {
    name,
    description,
    price,
    originalPrice,
    currency,
    period,
    features,
    ctaText = 'Get Started',
    ctaUrl,
    badge,
    highlighted,
    disabled,
  } = content;

  const billingPeriod = formatBillingPeriod(period);
  // Discount only applies when both prices are valid numbers
  const numericPrice = typeof price === 'number' && Number.isFinite(price) ? price : null;
  const hasDiscount =
    numericPrice !== null && typeof originalPrice === 'number' && originalPrice > numericPrice;
  const originalPriceLabel = hasDiscount
    ? formatPrice(originalPrice as number, currency)
    : null;
  const savingsPercentage =
    hasDiscount && originalPrice && numericPrice !== null
      ? Math.round((1 - numericPrice / originalPrice) * 100)
      : null;

  const featureItems = Array.isArray(features) ? features : [];
  const themeWrapperClass =
    theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : '';

  const ctaUrlValue = ctaUrl ?? '';
  const canNavigate =
    validateUrl(ctaUrlValue) || ctaUrlValue.startsWith('/');

  return (
    <Card
      id={id}
      className={cn(
        'cms-pricing-card relative h-full overflow-hidden',
        CARD_TONES[resolveTone({ highlighted, disabled, variant })],
        themeClass(theme),
        highlighted && 'shadow-lg ring-2 ring-primary',
        variant === 'outlined' && 'border-2 border-border',
        disabled && 'opacity-60',
        themeWrapperClass,
        className,
      )}
      data-highlighted={highlighted ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      data-testid="pricing-card"
    >
      {/* Theme is set via themeClass wrapper - children inherit via CSS cascade */}
      {badge && (
        <div className="absolute right-4 top-4">
          <CmsBadge
            variant={highlighted ? 'accent' : 'neutral'}
            className="inline-flex items-center gap-1 uppercase tracking-wide"
          >
            {badge.icon
              ? resolveCmsIcon(badge.icon, { className: 'h-3 w-3' })
              : null}
            {sanitizeText(badge.text)}
          </CmsBadge>
        </div>
      )}

      <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), dsSpacing.spaceY('md'))}>
        <CardTitle className="text-left line-clamp-2">
          {sanitizeText(name)}
        </CardTitle>
        {description && (
          <p className={cmsBody('sm', undefined, 'line-clamp-2')}>
            {sanitizeText(description)}
          </p>
        )}
      </CardHeader>

      <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), dsSpacing.spaceY('lg'))}>
        <div className={dsSpacing.spaceY('md')}>
          <div
            className={cn(
              'flex flex-wrap items-baseline',
              dsSpacing.gap('xs'),
            )}
          >
            <span className={cn(
              cmsHeading(2, theme),
              'tabular-nums text-foreground font-extrabold'
            )}>{formatPrice(price, currency)}</span>
            {billingPeriod && (
              <span className={cmsBody('sm', undefined, 'font-semibold text-muted-foreground')}>
                {billingPeriod}
              </span>
            )}
          </div>

          {hasDiscount && originalPriceLabel && (
            <div
              className={cn(
                'flex flex-wrap items-center',
                dsSpacing.gap('xs'),
              )}
            >
              <span className={cmsBody('sm', undefined, 'tabular-nums line-through text-muted-foreground')}>
                {originalPriceLabel}
              </span>
              {savingsPercentage !== null && (
                <span
                  className={cmsBody(
                    'xs',
                    theme,
                    'tabular-nums font-semibold text-success',
                  )}
                >
                  Save {savingsPercentage}%
                </span>
              )}
            </div>
          )}
        </div>

        <TooltipProvider delayDuration={150}>
          <ul className={dsSpacing.spaceY('md')}>
            {featureItems.map((feature, index) => {
              const included = Boolean(feature.included);
              return (
                <li
                  key={`feature-${index}`}
                  className={cn(
                    'flex items-start',
                    dsSpacing.gap('sm'),
                    !included && 'opacity-60',
                  )}
                >
                  {included ? (
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success/10">
                      <Check
                        aria-hidden="true"
                        className="h-4 w-4 text-success"
                      />
                    </div>
                  ) : (
                    <X
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                    />
                  )}

                  <div
                    className={cn(
                      'flex flex-1 items-start',
                      dsSpacing.gap('xs'),
                    )}
                  >
                    <span className={cmsBody('sm', undefined, 'break-words')}>
                      {sanitizeText(feature.text)}
                    </span>
                    {feature.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground "
                            aria-label={`More information about ${sanitizeText(feature.text)}`}
                          >
                            <Info aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className={cmsBody('xs', undefined, 'text-foreground')}>
                            {sanitizeText(feature.tooltip)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      </CardContent>

      <CardFooter className={cn('flex items-center gap-3 p-[var(--component-padding)] pt-0', themeClass(theme), 'mt-auto')}>
        <Button
          type="button"
          size="lg"
          variant={
            disabled ? 'secondary' : highlighted ? 'default' : 'outline'
          }
          className="w-full"
          disabled={disabled || !canNavigate}
          onClick={() => {
            if (!disabled && canNavigate) {
              navigateTo(ctaUrlValue);
            }
          }}
        >
          {sanitizeText(ctaText)}
        </Button>
      </CardFooter>
    </Card>
  );
};

const PricingCard = withPerformanceTracking(
  PricingCardComponent,
  ComponentType.PricingCard,
);
export default PricingCard;
