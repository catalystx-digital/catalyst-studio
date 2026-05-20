'use client';

import React, { useMemo } from 'react';
import { Check, Info, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { PricingTableProps } from './pricing-table.types';
import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types';
import {
  sanitizeText,
  validateUrl,
} from '@/lib/studio/components/cms/_core/security';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CmsBadge,
  CARD_TONES,
  themeClass,
  CmsSection,
  CmsTable,
  CmsTableBody,
  CmsTableCell,
  CmsTableHead,
  CmsTableHeader,
  CmsTableRow,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
} from '../../_ui';

const PLAN_GRID_LAYOUT: Record<number, string> = {
  1: 'mx-auto max-w-xl',
  2: 'mx-auto max-w-4xl md:grid-cols-2',
  3: 'mx-auto max-w-6xl md:grid-cols-3',
  4: 'mx-auto max-w-7xl md:grid-cols-4',
};

function resolveGridLayout(count: number): string {
  if (count <= 1) return PLAN_GRID_LAYOUT[1];
  if (count === 2) return PLAN_GRID_LAYOUT[2];
  if (count === 3) return PLAN_GRID_LAYOUT[3];
  return PLAN_GRID_LAYOUT[4];
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

function formatPrice(value: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

function navigateTo(url?: string) {
  if (!url || typeof window === 'undefined') {
    return;
  }

  window.open(url, '_self');
}

const PricingTableComponent: React.FC<PricingTableProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const {
    title,
    subtitle,
    plans,
    features = [],
    showComparison = true,
    highlightDifferences = true,
  } = content;

  const normalizedPlans = Array.isArray(plans) ? plans : [];

  const recommendedPlanIndex = useMemo(
    () => normalizedPlans.findIndex((plan) => plan.popular || plan.highlighted),
    [normalizedPlans],
  );

  const resolvedTheme = resolveTheme(theme);

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-pricing-table', className)}
      containerClassName={dsSpacing.gap('2xl')}
      data-component-type={ComponentType.PricingTable}
      data-category={ComponentCategory.Pricing}
    >
      {(title || subtitle) && (
        <div
          className={cn(
            'mx-auto flex max-w-3xl flex-col items-center text-center',
            dsSpacing.gap('md'),
          )}
        >
          {title && (
            <h2 className={cmsHeading(2, resolvedTheme)}>
              {sanitizeText(title)}
            </h2>
          )}
          {subtitle && (
            <p className={cmsBody('lg', resolvedTheme, 'text-muted-foreground')}>
              {sanitizeText(subtitle)}
            </p>
          )}
        </div>
      )}

      <div className="w-full">
        <div
          data-testid="cms-pricing-plan-grid"
          className={cn(
            'grid w-full',
            dsSpacing.gap('xl'),
            resolveGridLayout(normalizedPlans.length),
          )}
        >
          {normalizedPlans.map((plan, index) => {
            const isRecommended = index === recommendedPlanIndex && highlightDifferences;
            const billingPeriod = formatBillingPeriod(plan.period);
            const hasDiscount =
              typeof plan.originalPrice === 'number' &&
              plan.originalPrice > plan.price;

            const priceLabel = formatPrice(plan.price, plan.currency);
            const originalPriceLabel = hasDiscount
              ? formatPrice(plan.originalPrice as number, plan.currency)
              : null;

            const savingsPercentage =
              hasDiscount && plan.originalPrice
                ? Math.round((1 - plan.price / plan.originalPrice) * 100)
                : null;

            const cardPaddingClass =
              variant === 'compact'
                ? 'ds-p-md'
                : variant === 'detailed'
                  ? 'ds-p-xl'
                  : 'ds-p-lg';

            const planFeatures = Array.isArray(plan.features) ? plan.features : [];

            return (
              <Card
                key={plan.id}
                className={cn(
                  'cms-pricing-plan flex h-full flex-col justify-between',
                  CARD_TONES[plan.disabled ? 'minimal' : 'default'],
                  themeClass(resolvedTheme),
                  cardPaddingClass,
                  isRecommended && 'ring-2 ring-ring shadow-lg',
                  plan.disabled && 'opacity-60',
                )}
                data-recommended={isRecommended ? 'true' : undefined}
              >
                <div className={dsSpacing.spaceY('lg')}>
                  {plan.badge && (
                    <div className="flex justify-center">
                      <CmsBadge
                        theme={resolvedTheme}
                        variant={isRecommended ? 'accent' : 'neutral'}
                        className="uppercase tracking-wide"
                      >
                        {sanitizeText(plan.badge)}
                      </CmsBadge>
                    </div>
                  )}

                  <CardHeader
                    className={cn(
                      'flex flex-col gap-2 p-[var(--component-padding)]',
                      themeClass(resolvedTheme),
                      'items-start gap-3 p-0',
                      variant === 'compact' && 'gap-2',
                    )}
                  >
                    <CardTitle className="text-left">
                      {sanitizeText(plan.name)}
                    </CardTitle>
                    {plan.description && (
                      <p className={cmsBody('sm', resolvedTheme, 'text-left')}>
                        {sanitizeText(plan.description)}
                      </p>
                    )}
                  </CardHeader>

                  <div className={dsSpacing.spaceY('md')}>
                    <div
                      className={cn(
                        'flex flex-wrap items-baseline',
                        dsSpacing.gap('xs'),
                      )}
                    >
                      <span className={cmsHeading(3, resolvedTheme, 'tabular-nums')}>{priceLabel}</span>
                      {billingPeriod && (
                        <span className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
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
                        <span className={cmsBody('sm', resolvedTheme, 'tabular-nums line-through text-muted-foreground')}>
                          {originalPriceLabel}
                        </span>
                        {savingsPercentage !== null && (
                          <span
                            className={cmsBody(
                              'xs',
                              resolvedTheme,
                              'tabular-nums font-semibold text-success',
                            )}
                          >
                            Save {savingsPercentage}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    variant={
                      plan.disabled
                        ? 'secondary'
                        : isRecommended
                          ? 'default'
                          : 'outline'
                    }
                    className="w-full"
                    disabled={plan.disabled}
                    onClick={() => {
                      const ctaUrl = plan.ctaUrl ?? '';
                      const isNavigable =
                        typeof ctaUrl === 'string' &&
                        (validateUrl(ctaUrl) || ctaUrl.startsWith('/'));

                      if (!plan.disabled && isNavigable) {
                        navigateTo(ctaUrl);
                      }
                    }}
                  >
                    {sanitizeText(plan.ctaText || 'Get Started')}
                  </Button>

                  <CardContent
                    className={cn(
                      'p-[var(--component-padding)] pt-0',
                      themeClass(resolvedTheme),
                      dsSpacing.spaceY('md'),
                      'p-0',
                      planFeatures.length === 0 && 'pb-0',
                    )}
                  >
                    {planFeatures.length > 0 && (
                      <ul
                        className={cn(
                          'text-left',
                          dsSpacing.spaceY('md'),
                        )}
                      >
                        {planFeatures.map((feature, featureIndex) => (
                          <li
                            key={`${plan.id}-feature-${featureIndex}`}
                            className={cn(
                              'flex items-start',
                              dsSpacing.gap('sm'),
                            )}
                          >
                            <Check
                              aria-hidden="true"
                              className={cn(
                                'mt-0.5 h-5 w-5 flex-shrink-0',
                                isRecommended ? 'text-primary' : 'text-success',
                              )}
                            />
                            <span className={cmsBody('sm', resolvedTheme)}>
                              {sanitizeText(feature)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {showComparison && features.length > 0 && normalizedPlans.length > 0 && (
        <div className={cn('mx-auto max-w-6xl', dsSpacing.mt('3xl'))}>
          <div className={cn('text-center', dsSpacing.mb('lg'))}>
            <h3 className={cmsHeading(3, resolvedTheme)}>Feature Comparison</h3>
            <p
              className={cmsBody(
                'sm',
                resolvedTheme,
                cn(dsSpacing.mt('sm'), 'text-muted-foreground'),
              )}
            >
              Understand exactly what is included with each plan.
            </p>
          </div>

          <TooltipProvider delayDuration={150}>
            <CmsTable theme={resolvedTheme} className="border border-border/40 shadow-sm">
              <CmsTableHeader sticky>
                <CmsTableRow className="bg-muted/50">
                  <CmsTableHead theme={resolvedTheme} className="font-semibold">Features</CmsTableHead>
                  {normalizedPlans.map((plan, index) => {
                    const isRecommended = index === recommendedPlanIndex && highlightDifferences;
                    return (
                      <CmsTableHead
                        key={`plan-head-${plan.id}`}
                        theme={resolvedTheme}
                        align="center"
                        className={cn(
                          'font-semibold transition-colors duration-200',
                          isRecommended && 'text-primary',
                        )}
                        data-recommended={isRecommended ? 'true' : undefined}
                      >
                        {sanitizeText(plan.name)}
                      </CmsTableHead>
                    );
                  })}
                </CmsTableRow>
              </CmsTableHeader>

              <CmsTableBody theme={resolvedTheme}>
                {features.map((feature, featureIndex) => {
                  const availability = Array.isArray(feature.availability)
                    ? feature.availability
                    : [];

                  return (
                    <CmsTableRow key={`feature-row-${featureIndex}`} theme={resolvedTheme} className="group transition-colors duration-200 hover:bg-muted/20">
                      <CmsTableCell theme={resolvedTheme}>
                        <div
                          className={cn(
                            'flex items-center',
                            dsSpacing.gap('xs'),
                          )}
                        >
                          <span className={cmsBody('sm', resolvedTheme, 'font-medium')}>
                            {sanitizeText(feature.name)}
                          </span>
                          {feature.tooltip && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    'flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-shadow hover:text-foreground  ',
                                  )}
                                  aria-label={`More information about ${sanitizeText(feature.name)}`}
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
                      </CmsTableCell>

                      {normalizedPlans.map((plan, planIndex) => {
                        const isAvailable = Boolean(availability[planIndex]);
                        const isRecommended =
                          planIndex === recommendedPlanIndex && highlightDifferences;
                        const iconClass = cn(
                          'mx-auto h-5 w-5 transition-shadow',
                          isAvailable
                            ? isRecommended
                              ? 'text-primary'
                              : 'text-success'
                            : 'text-muted-foreground',
                        );

                        return (
                          <CmsTableCell
                            key={`feature-${featureIndex}-plan-${plan.id}`}
                            theme={resolvedTheme}
                            align="center"
                          >
                            {isAvailable ? (
                              <Check aria-hidden="true" className={iconClass} />
                            ) : (
                              <X aria-hidden="true" className={iconClass} />
                            )}
                            <span className="sr-only">
                              {sanitizeText(plan.name)}{' '}
                              {isAvailable ? 'includes' : 'excludes'}{' '}
                              {sanitizeText(feature.name)}
                            </span>
                          </CmsTableCell>
                        );
                      })}
                    </CmsTableRow>
                  );
                })}
              </CmsTableBody>
            </CmsTable>
          </TooltipProvider>
        </div>
      )}
    </CmsSection>
  );
};

const PricingTable = withPerformanceTracking(
  PricingTableComponent,
  ComponentType.PricingTable,
);
export default PricingTable;
