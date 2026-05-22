/**
 * Adapter components that wrap data visualization components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { ComponentType, ComponentCategory } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';
import { readRuntimeContent } from '../_core/utils';
import Statistics from './statistics';
import DataTable from './data-table';
import Timeline from './timeline';
import Chart from './chart';
import type { StatisticsProps, StatisticsContent } from './statistics/statistics.types';
import type { DataTableProps, DataTableContent } from './data-table/data-table.types';
import type { TimelineProps, TimelineContent, TimelineAction } from './timeline/timeline.types';
import type { ChartProps, ChartContent } from './chart/chart.types';

function mapStatisticsVariant(variant: CMSComponentProps['variant']): StatisticsProps['variant'] {
  return variant === 'detailed' ? 'card' : ((variant as StatisticsProps['variant']) ?? 'default');
}

function mapDataTableVariant(variant: CMSComponentProps['variant']): DataTableProps['variant'] {
  return variant === 'expanded' ? 'spacious' : ((variant as DataTableProps['variant']) ?? 'default');
}

function mapTimelineVariant(variant: CMSComponentProps['variant']): TimelineProps['variant'] {
  return (variant as TimelineProps['variant']) ?? 'default';
}

/**
 * Statistics Adapter Component
 */
export const StatisticsAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = (readRuntimeContent<StatisticsContent>(props.content) || {}) as StatisticsContent;

  const validatedContent: StatisticsContent = {
    ...content,
    layout: content.layout ?? 'grid',
    columns: content.columns ?? 3,
    stats: Array.isArray(content.stats)
      ? content.stats.map((stat, index) => {
          const numericValue =
            typeof stat.value === 'number'
              ? stat.value
              : Number.parseFloat(String(stat.value));

          return {
            ...stat,
            id: stat.id || `stat-${index}`,
            value: Number.isFinite(numericValue) ? numericValue : 0,
            decimalPlaces: stat.decimalPlaces ?? 0,
          };
        })
      : [],
  };

  const adaptedProps: StatisticsProps = {
    id: props.id,
    type: ComponentType.Statistics,
    category: ComponentCategory.Data,
    content: validatedContent,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: mapStatisticsVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <Statistics {...adaptedProps} />;
};

/**
 * DataTable Adapter Component
 */
export const DataTableAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = (readRuntimeContent<DataTableContent>(props.content) || {}) as DataTableContent;

  const validatedContent: DataTableContent = {
    ...content,
    columns: Array.isArray(content.columns) ? content.columns : [],
    rows: Array.isArray(content.rows)
      ? content.rows.map((row, index) => ({
          ...row,
          id: row.id || `row-${index}`,
        }))
      : [],
    pagination: content.pagination ?? { enabled: false },
    sorting: content.sorting ?? { enabled: true },
    filtering: content.filtering ?? { enabled: false },
  };

  const adaptedProps: DataTableProps = {
    id: props.id,
    type: ComponentType.DataTable,
    category: ComponentCategory.Data,
    content: validatedContent,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: mapDataTableVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <DataTable {...adaptedProps} />;
};

/**
 * Timeline Adapter Component
 */
export const TimelineAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = (readRuntimeContent<TimelineContent>(props.content) || {}) as TimelineContent;

  const normalizeAction = (action: unknown): TimelineAction | null => {
    if (!action || typeof action !== 'object') {
      return null;
    }
    const record = action as Record<string, unknown>;
    const textRaw = record.text ?? record.label ?? record.title;
    const urlRaw = record.url ?? record.href ?? record.link;
    if (typeof textRaw !== 'string' || typeof urlRaw !== 'string') {
      return null;
    }
    const text = textRaw.trim();
    const url = urlRaw.trim();
    if (!text || !url) {
      return null;
    }
    const variant =
      typeof record.variant === 'string'
        ? (record.variant as TimelineAction['variant'])
        : undefined;
    const normalized: TimelineAction = { text, url };
    if (variant) {
      normalized.variant = variant;
    }
    return normalized;
  };

  const sanitizeActions = (raw: unknown): TimelineAction[] | undefined => {
    if (!Array.isArray(raw)) {
      return undefined;
    }
    const actions: TimelineAction[] = [];
    raw.forEach((entry) => {
      const normalized = normalizeAction(entry);
      if (normalized) {
        actions.push(normalized);
      }
    });
    return actions.length > 0 ? actions : undefined;
  };

  const validatedContent: TimelineContent = {
    ...content,
    events: Array.isArray(content.events)
      ? content.events.map((event, index) => ({
          ...event,
          id: event.id || `event-${index}`,
          date: event.date ?? new Date().toISOString(),
          title: event.title || 'Untitled Event',
          actions: sanitizeActions(event.actions),
        }))
      : [],
    layout:
      content.layout === 'horizontal' || content.layout === 'alternating'
        ? content.layout
        : 'vertical',
    showConnectors: content.showConnectors ?? true,
    showIcons: content.showIcons ?? true,
    dateFormat: content.dateFormat,
    animated: content.animated ?? true,
    footerCta: normalizeAction(content.footerCta) ?? undefined,
  };

  const adaptedProps: TimelineProps = {
    id: props.id,
    type: ComponentType.Timeline,
    category: ComponentCategory.Data,
    content: validatedContent,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: mapTimelineVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <Timeline {...adaptedProps} />;
};

/**
 * Chart Adapter Component
 */
export const ChartAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = (readRuntimeContent<ChartContent>(props.content) || {}) as ChartContent;

  const adaptedProps: ChartProps = {
    id: props.id,
    type: ComponentType.Chart,
    category: ComponentCategory.Data,
    content,
    className: props.className,
    style: props.style,
    theme: props.theme ?? 'auto',
    loading: props.loading ?? 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction,
  };

  return <Chart {...adaptedProps} />;
};
