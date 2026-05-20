'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Icons from 'lucide-react';

import { cn } from '@/lib/utils';

import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { sanitizeText } from '@/lib/studio/components/cms/_core/security';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';

import { Card, CardContent } from '@/components/ui/card';
import {
  CmsBadge,
  CARD_TONES,
  themeClass,
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import type { StatisticsProps, StatItem, StatDelta } from './statistics.types';

const DELTA_NEUTRAL_TEXT = 'No change';

const COLUMN_CLASS_MAP: Record<NonNullable<StatisticsProps['content']['columns']>, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const ICON_CLASSNAME = 'mb-3 h-10 w-10 text-primary';

const ICON_COMPONENTS = Icons as unknown as Record<
  string,
  React.ComponentType<{ className?: string }>
>;

const useCountAnimation = (
  end: number,
  duration = 2000,
  decimalPlaces = 0,
  startAnimation = false,
) => {
  const [count, setCount] = useState(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startAnimation) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;
    const endValue = end;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (endValue - startValue) * easeOutQuart;

      setCount(parseFloat(currentValue.toFixed(decimalPlaces)));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [end, duration, decimalPlaces, startAnimation]);

  return count;
};

function resolveGridClasses(
  layout: NonNullable<StatisticsProps['content']['layout']>,
  columns: NonNullable<StatisticsProps['content']['columns']>,
): string {
  if (layout === 'row') {
    return cn(
      'grid auto-cols-[minmax(220px,1fr)] grid-flow-col',
      dsSpacing.gap('lg'),
      `sm:${dsSpacing.gap('xl')}`,
      'overflow-x-auto sm:overflow-x-visible',
    );
  }

  return cn(
    'grid grid-cols-1',
    dsSpacing.gap('lg'),
    `sm:${dsSpacing.gap('xl')}`,
    COLUMN_CLASS_MAP[columns] ?? COLUMN_CLASS_MAP[3],
  );
}

function resolveCardTone(variant: StatisticsProps['variant']): CmsCardTone {
  if (variant === 'card') {
    return 'default';
  }

  return 'minimal';
}

function resolveDeltaVariant(delta?: StatDelta) {
  if (!delta) {
    return 'neutral';
  }

  if (typeof delta.value === 'number') {
    if (delta.value > 0) return 'positive';
    if (delta.value < 0) return 'negative';
  }

  if (delta.trend === 'up') {
    return 'positive';
  }

  if (delta.trend === 'down') {
    return 'negative';
  }

  return 'neutral';
}

function formatDeltaLabel(delta?: StatDelta): string | null {
  if (!delta) return null;

  if (typeof delta.label === 'string' && delta.label.trim().length > 0) {
    return sanitizeText(delta.label);
  }

  if (typeof delta.value === 'number') {
    const sign = delta.value > 0 ? '+' : '';
    return `${sign}${delta.value.toFixed(1)}%`;
  }

  return DELTA_NEUTRAL_TEXT;
}

function getIcon(icon?: StatItem['icon']): React.ReactNode {
  if (!icon) {
    return null;
  }

  if (typeof icon === 'string') {
    const IconComponent = ICON_COMPONENTS[icon];
    if (IconComponent) {
      return <IconComponent className={ICON_CLASSNAME} aria-hidden />;
    }
    return null;
  }

  if (React.isValidElement(icon)) {
    const element = icon as React.ReactElement<{
      className?: string;
      'aria-hidden'?: boolean;
    }>;
    return React.cloneElement(element, {
      className: cn(ICON_CLASSNAME, element.props?.className),
      'aria-hidden': true,
    });
  }

  if (typeof icon === 'function') {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className={ICON_CLASSNAME} aria-hidden />;
  }

  return null;
}

interface StatisticCardProps {
  stat: StatItem;
  theme?: StatisticsProps['theme'];
  variant: StatisticsProps['variant'];
  defaultAnimationDuration: number;
  isVisible: boolean;
  shouldAnimate: boolean;
}

function StatisticCard({
  stat,
  theme,
  variant,
  defaultAnimationDuration,
  isVisible,
  shouldAnimate,
}: StatisticCardProps) {
  const { prefix, suffix } = stat;
  const decimalPlaces = stat.decimalPlaces ?? 0;
  const animationDuration = stat.animationDuration ?? defaultAnimationDuration;

  // Determine if value is animatable (valid finite number)
  const isNumericValue = typeof stat.value === 'number' && Number.isFinite(stat.value);
  const numericValue = isNumericValue ? (stat.value as number) : 0;

  const animatedValue = useCountAnimation(
    numericValue,
    animationDuration,
    decimalPlaces,
    isVisible && isNumericValue, // Only animate if numeric
  );

  const formattedValue = useMemo(() => {
    // For string values, display as-is
    if (!isNumericValue) {
      return String(stat.value);
    }
    return animatedValue.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  }, [animatedValue, decimalPlaces, isNumericValue, stat.value]);

  const targetValue = useMemo(() => {
    // For string values, return as-is
    if (!isNumericValue) {
      return String(stat.value);
    }
    return numericValue.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  }, [numericValue, decimalPlaces, isNumericValue, stat.value]);

  // Only show pending animation for numeric values
  const isPendingAnimation = shouldAnimate && !isVisible && isNumericValue;
  const placeholderStyle = useMemo(() => {
    const length = Math.max(targetValue.length, 2);
    return {
      minWidth: `calc(${length}ch + 0.75rem)`,
    };
  }, [targetValue]);

  const deltaLabel = formatDeltaLabel(stat.delta);
  const deltaVariant = resolveDeltaVariant(stat.delta);
  const iconElement = getIcon(stat.icon);
  const tone = resolveCardTone(variant);
  const isMinimal = variant === 'minimal';

  return (
    <Card
      key={stat.id}
      className={cn(
        'cms-statistics-item group h-full text-center',
        'flex flex-col',
        CARD_TONES[tone],
        themeClass(theme),
        isMinimal && 'border-transparent bg-transparent shadow-none',
      )}
      data-testid="cms-statistics-item"
    >
      <CardContent
        className={cn(
          'p-[var(--component-padding)] pt-0',
          themeClass(theme),
          'flex flex-1 flex-col items-center text-center text-foreground',
          dsSpacing.gap('sm'),
          dsSpacing.padding('lg'),
          `sm:${dsSpacing.padding('xl')}`,
        )}
      >
        {iconElement}
        <div
          className={cn(
            cmsHeading(2, theme, 'font-semibold text-primary'),
            'flex flex-col items-center',
            dsSpacing.gap('xs'),
          )}
        >
          <div className={cn('flex items-baseline', dsSpacing.gap('xxs'))}>
            {prefix && <span>{sanitizeText(prefix)}</span>}
            <span className="relative inline-flex min-h-[1.5rem] items-center">
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={cn('tabular-nums', isPendingAnimation && 'sr-only')}
                aria-label={`${sanitizeText(stat.label)}: ${formattedValue}`}
              >
                {formattedValue}
              </span>
              {isPendingAnimation && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 animate-pulse items-center rounded-full bg-muted ds-ml-xs"
                  style={placeholderStyle}
                />
              )}
            </span>
            {suffix && <span>{sanitizeText(suffix)}</span>}
          </div>
          {isPendingAnimation && (
            <span className="sr-only">
              {sanitizeText(stat.label)} value loading
            </span>
          )}
          <div className={cmsBody('sm', theme, 'font-semibold text-foreground line-clamp-2')}>
            {sanitizeText(stat.label)}
          </div>
        </div>

        {deltaLabel && (
          <CmsBadge variant={deltaVariant} theme={theme}>
            {sanitizeText(deltaLabel)}
          </CmsBadge>
        )}

        {stat.description && (
          <p
            className={cmsBody(
              'sm',
              theme,
              cn('text-muted-foreground line-clamp-3', dsSpacing.mt('xxs')),
            )}
          >
            {sanitizeText(stat.description)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const StatisticsComponent: React.FC<StatisticsProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const {
    title,
    subtitle,
    stats,
    animateOnScroll = true,
    animationDuration = 2000,
    layout = 'grid',
    columns = 3,
  } = content;

  const [isVisible, setIsVisible] = useState(!animateOnScroll);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!animateOnScroll) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
      observer.disconnect();
    };
  }, [animateOnScroll, isVisible]);

  const gridClasses = resolveGridClasses(layout, columns);
  const sectionVariant = variant === 'card' ? 'detailed' : variant ?? 'default';

  return (
    <CmsSection
      id={id}
      ref={containerRef}
      size="md"
      theme={theme}
      variant={sectionVariant}
      className={cn('cms-statistics', className)}
      data-testid="cms-statistics"
    >
      {(title || subtitle) && (
        <header
          className={cn(
            'mx-auto flex max-w-3xl flex-col items-center text-center',
            dsSpacing.gap('sm'),
          )}
        >
          {title && (
            <h2 className={cmsHeading(2, theme)}>{sanitizeText(title)}</h2>
          )}
          {subtitle && (
            <p className={cmsBody('md', theme, 'text-muted-foreground')}>
              {sanitizeText(subtitle)}
            </p>
          )}
        </header>
      )}

      <div className={cn('w-full', gridClasses)}>
        {stats.map((stat) => (
          <StatisticCard
            key={stat.id}
            stat={stat}
            theme={theme}
            variant={variant}
            defaultAnimationDuration={animationDuration}
            isVisible={isVisible}
            shouldAnimate={animateOnScroll}
          />
        ))}
      </div>
    </CmsSection>
  );
};

const Statistics = withPerformanceTracking(StatisticsComponent, ComponentType.Statistics);
export default Statistics;
