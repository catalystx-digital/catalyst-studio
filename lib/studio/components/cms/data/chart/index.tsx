'use client';

import React from 'react';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import {
  sanitizeHtml,
  sanitizeText,
} from '../../_core/security';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import type {
  ChartProps,
  ChartTone,
  ChartType,
  ChartDatum,
  ChartSeries,
} from './chart.types';

type NormalizedTone = ChartTone;

interface NormalizedDatum {
  id: string;
  label: string;
  value: number;
  tone: NormalizedTone;
}

interface NormalizedSeries {
  id: string;
  name: string;
  values: number[];
  tone: NormalizedTone;
  icon?: string;
}

interface NormalizedChart {
  type: ChartType;
  categories: string[];
  series: NormalizedSeries[];
  maxValue: number;
  unitLabel?: string;
  footnote?: string;
  description?: string;
  title?: string;
}

const TONE_COLOUR_MAP: Record<NormalizedTone, string> = {
  accent: 'bg-primary',
  positive: 'bg-success',
  negative: 'bg-destructive',
  neutral: 'bg-muted/80',
};

const BADGE_VARIANT_MAP: Record<NormalizedTone, 'accent' | 'positive' | 'negative' | 'neutral'> =
  {
    accent: 'accent',
    positive: 'positive',
    negative: 'negative',
    neutral: 'neutral',
  };

const DOT_VARIANT_CLASSES: Record<NormalizedTone, string> = {
  accent: 'text-primary',
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
};

const SERIES_TONE_SEQUENCE: NormalizedTone[] = ['accent', 'positive', 'neutral', 'negative'];


function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeSeriesTone(value: unknown, index: number): NormalizedTone {
  if (
    value === 'accent' ||
    value === 'positive' ||
    value === 'negative' ||
    value === 'neutral'
  ) {
    return value;
  }

  return SERIES_TONE_SEQUENCE[index % SERIES_TONE_SEQUENCE.length];
}

function normalizeSeriesEntry(
  entry: ChartSeries,
  index: number,
  categoriesLength: number,
): NormalizedSeries {
  const name = sanitizeText(entry.name ?? `Series ${index + 1}`);
  const tone = normalizeSeriesTone(entry.tone, index);
  const values = Array.isArray(entry.values)
    ? entry.values.map((value) => parseNumber(value))
    : [];

  const normalizedValues =
    values.length === categoriesLength
      ? values
      : [...values, ...Array(Math.max(0, categoriesLength - values.length)).fill(0)];

  return {
    id: entry.id && typeof entry.id === 'string' ? entry.id : `series-${index}`,
    name,
    values: normalizedValues,
    tone,
    icon: entry.icon,
  };
}

function normalizeSimpleData(
  data: ChartDatum[] | undefined,
  unitLabel?: string,
): {
  categories: string[];
  series: NormalizedSeries[];
} {
  if (!Array.isArray(data) || data.length === 0) {
    return { categories: [], series: [] };
  }

  const normalizedData: NormalizedDatum[] = data
    .map((item, index) => {
      const label = sanitizeText(item.label ?? `Item ${index + 1}`);
      const value = parseNumber(item.value);
      const tone = normalizeSeriesTone(item.tone, index);

      if (label.length === 0) {
        return null;
      }

      return {
        id: item.id && typeof item.id === 'string' ? item.id : `data-${index}`,
        label,
        value,
        tone,
      };
    })
    .filter((entry): entry is NormalizedDatum => entry !== null);

  if (normalizedData.length === 0) {
    return { categories: [], series: [] };
  }

  const categories = normalizedData.map((item) => item.label);
  const series: NormalizedSeries[] = [
    {
      id: 'series-0',
      name: unitLabel ? sanitizeText(unitLabel) : 'Value',
      values: normalizedData.map((item) => item.value),
      tone: 'accent',
    },
  ];

  return { categories, series };
}

function normalizeChartContent(content: ChartProps['content']): NormalizedChart | null {
  const type: ChartType =
    content?.type === 'line' || content?.type === 'donut' ? content.type : 'bar';

  const title =
    typeof content?.title === 'string' && content.title.trim().length > 0
      ? sanitizeText(content.title)
      : undefined;
  const description =
    typeof content?.description === 'string' && content.description.trim().length > 0
      ? sanitizeHtml(content.description, {
          ALLOWED_TAGS: ['strong', 'em', 'a', 'br'],
          ALLOWED_ATTR: ['href', 'rel', 'target'],
        })
      : undefined;

  const footnote =
    typeof content?.footnote === 'string' && content.footnote.trim().length > 0
      ? sanitizeText(content.footnote)
      : undefined;

  const categoriesSource = Array.isArray(content?.categories)
    ? content.categories
    : undefined;

  const categories = (categoriesSource ?? [])
    .map((label) => sanitizeText(typeof label === 'string' ? label : ''))
    .filter((label) => label.length > 0);

  const unitLabel =
    typeof content?.unitLabel === 'string' && content.unitLabel.trim().length > 0
      ? sanitizeText(content.unitLabel)
      : undefined;

  let series: NormalizedSeries[] = [];
  let resolvedCategories = categories;

  if (Array.isArray(content?.series) && content.series.length > 0) {
    resolvedCategories =
      categories.length > 0
        ? categories
        : Array.from(
            new Set(
              content.series
                .flatMap((item) => item.values ?? [])
                .map((_value, index) => `Value ${index + 1}`),
            ),
          );

    series = content.series
      .map((entry, index) =>
        normalizeSeriesEntry(entry, index, Math.max(resolvedCategories.length, 1)),
      )
      .filter((entry) => entry.values.length > 0);
  }

  if (series.length === 0 && Array.isArray(content?.data)) {
    const simple = normalizeSimpleData(content.data, unitLabel);
    resolvedCategories = simple.categories;
    series = simple.series;
  }

  const maxValue = series.length
    ? Math.max(
        ...series.flatMap((entry) => entry.values.map((value) => Math.abs(value))),
        0,
      )
    : 0;

  if (series.length === 0 || resolvedCategories.length === 0) {
    return null;
  }

  return {
    type,
    categories: resolvedCategories,
    series,
    maxValue: maxValue || 1,
    unitLabel,
    footnote,
    description,
    title,
  };
}

function formatValue(value: number, unitLabel?: string): string {
  const formatted = Number.isFinite(value) ? value.toLocaleString() : '0';
  return unitLabel ? `${formatted} ${unitLabel}`.trim() : formatted;
}

function renderLegend(
  chart: NormalizedChart,
  theme: ChartProps['theme'],
  onInteraction?: ChartProps['onInteraction'],
) {
  return (
    <div
      className={cn('flex flex-wrap', dsSpacing.gap('md'))}
      aria-label="Chart legend"
    >
      {chart.series.map((series) => {
        const iconNode = resolveCmsIcon(series.icon, {
          className: 'h-4 w-4',
        });

        return (
          <button
            key={series.id}
            type="button"
            className={cn(
              'group flex items-center rounded-full border border-border/40',
              dsSpacing.gap('sm'),
              dsSpacing.px('md'),
              dsSpacing.py('xs'),
              'bg-card text-left text-muted-foreground transition-[color,border-color,box-shadow] duration-200',
              'hover:border-border hover:text-foreground hover:shadow-md',
            )}
            onClick={() =>
              onInteraction?.('chart-legend-click', {
                seriesId: series.id,
                seriesName: series.name,
              })
            }
          >
            <span
              aria-hidden
              className={cn(
                'flex h-2.5 w-2.5 items-center justify-center rounded-full transition-transform duration-200',
                DOT_VARIANT_CLASSES[series.tone],
              )}
            >
              <span className="sr-only">{series.name}</span>
            </span>
            <span className={cmsBody('xs', theme, 'font-medium')}>{series.name}</span>
            {iconNode ? <span aria-hidden>{iconNode}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function renderBarChart(
  chart: NormalizedChart,
  theme: ChartProps['theme'],
  unitLabel: string | undefined,
  onInteraction?: ChartProps['onInteraction'],
) {
  return (
    <div className={dsSpacing.spaceY('lg')}>
      {chart.categories.map((category, categoryIndex) => (
        <div key={category} className={dsSpacing.spaceY('md')}>
          <p className={cmsHeading(6, theme)}>{category}</p>
          <div className={dsSpacing.spaceY('sm')}>
            {chart.series.map((series) => {
              const value = series.values[categoryIndex] ?? 0;
              const percent = chart.maxValue
                ? Math.max(0, Math.min(100, (Math.abs(value) / chart.maxValue) * 100))
                : 0;
              const badgeVariant = BADGE_VARIANT_MAP[series.tone];

              return (
                <div
                  key={`${series.id}-${category}`}
                  role="button"
                  aria-label={`${series.name} ${category} value ${formatValue(value, unitLabel)}`}
                  tabIndex={0}
                  className={cn(
                    'group flex items-center rounded-lg border border-transparent',
                    dsSpacing.gap('md'),
                    dsSpacing.padding('md'),
                    'bg-muted/30 transition-[background-color,border-color,box-shadow] duration-200 hover:border-border/40 hover:bg-muted/50 hover:shadow-md focus-visible:border-border',
                  )}
                  onClick={() =>
                    onInteraction?.('chart-bar-click', {
                      category,
                      seriesId: series.id,
                      seriesName: series.name,
                      value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onInteraction?.('chart-bar-click', {
                        category,
                        seriesId: series.id,
                        seriesName: series.name,
                        value,
                      });
                    }
                  }}
                >
                  <span className={cmsBody('xs', theme, 'w-24 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-foreground')}>
                    {series.name}
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-full rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-3 rounded-full transition-[height] duration-300 ease-out group-hover:h-4',
                          TONE_COLOUR_MAP[series.tone],
                        )}
                        style={{ width: `${percent}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <CmsBadge
                    theme={theme}
                    variant={badgeVariant}
                    className="shrink-0"
                  >
                    {formatValue(value, unitLabel)}
                  </CmsBadge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Placeholder renderer – production charting tracked in analytics backlog.
function renderPlaceholder(
  chartType: ChartType,
  chart: NormalizedChart,
  theme: ChartProps['theme'],
) {
  // Use HSL opacity syntax instead of color-mix for better browser compatibility
  const gradientStyle =
    chartType === 'line'
      ? {
          backgroundImage:
            `linear-gradient(135deg, hsl(var(--primary) / 0.28), hsl(var(--primary) / 0.16) 55%, hsl(var(--background) / 0.12))`,
        }
      : {
          backgroundImage:
            `radial-gradient(circle at center, hsl(var(--primary) / 0.24), hsl(var(--primary) / 0.13) 45%, hsl(var(--background) / 0.1))`,
        };

  return (
    <div className={dsSpacing.spaceY('md')}>
      <div
        aria-hidden="true"
        className={cn(
          'flex h-56 items-center justify-center rounded-2xl border border-border/40 bg-muted/40',
        )}
        style={gradientStyle}
      >
        <span className={cmsBody('sm', theme, 'text-muted-foreground')}>
          Placeholder visualization – see analytics backlog for production charting.
        </span>
      </div>
      <div className={cn('grid md:grid-cols-2', dsSpacing.gap('md'))}>
        {chart.series.map((series) => (
          <div
            key={series.id}
            className={cn(
              'flex items-center justify-between rounded-lg border border-border/30 bg-card',
              dsSpacing.px('md'),
              dsSpacing.py('sm'),
            )}
          >
            <span className={cmsBody('sm', theme)}>{series.name}</span>
            <CmsBadge
              theme={theme}
              variant={BADGE_VARIANT_MAP[series.tone]}
            >
              {formatValue(
                series.values.reduce((total, value) => total + value, 0),
                chart.unitLabel,
              )}
            </CmsBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartBase: React.FC<ChartProps> = ({
  id,
  className,
  style,
  content,
  analytics,
  theme = 'auto',
  onInteraction,
  onLoad,
  onError,
}) => {
  React.useEffect(() => {
    try {
      onLoad?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onLoad, onError]);

  const normalized = React.useMemo(() => normalizeChartContent(content), [content]);

  if (!normalized) {
    return (
      <CmsSection
        id={id}
        size="md"
        theme={theme}
        className={cn('cms-data-chart', className)}
        containerClassName="w-full"
        style={style}
        data-component-type="chart"
        data-analytics-id={analytics?.trackingId}
      >
        <Card className={cn('w-full', CARD_TONES['default'], themeClass(theme))}>
          <CardContent
            className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), cmsBody('sm', theme, 'text-muted-foreground'))}
          >
            Data unavailable or improperly configured.
          </CardContent>
        </Card>
      </CmsSection>
    );
  }

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      className={cn('cms-data-chart', className)}
      containerClassName="w-full"
      style={style}
      data-component-type="chart"
      data-analytics-id={analytics?.trackingId}
    >
      <Card className={cn('w-full border border-border/40 shadow-sm', CARD_TONES['default'], themeClass(theme))}>
        <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), dsSpacing.spaceY('md'), 'bg-gradient-to-r from-card to-muted/20 rounded-t-lg')}>
          {normalized.title ? (
            <h2 className={cmsHeading(4, theme)}>{normalized.title}</h2>
          ) : null}
          {normalized.description ? (
            <SafeHtml
              html={normalized.description}
              tag="p"
              className={cmsBody('sm', theme, 'text-muted-foreground')}
            />
          ) : null}
        </CardHeader>

        <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), dsSpacing.spaceY('lg'))}>
          {renderLegend(normalized, theme, onInteraction)}

          {normalized.type === 'bar'
            ? renderBarChart(normalized, theme, normalized.unitLabel, onInteraction)
            : renderPlaceholder(normalized.type, normalized, theme)}

          {normalized.footnote ? (
            <p className={cmsBody('xs', theme, 'text-muted-foreground/90')}>
              {normalized.footnote}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </CmsSection>
  );
};

const Chart = withPerformanceTracking(ChartBase, ComponentType.Chart);

export default Chart;
