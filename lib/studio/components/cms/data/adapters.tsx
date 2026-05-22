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
import type { TimelineProps, TimelineContent } from './timeline/timeline.types';
import type { ChartProps, ChartContent } from './chart/chart.types';

function requireStatisticsVariant(variant: CMSComponentProps['variant']): StatisticsProps['variant'] {
  if (variant === undefined || variant === 'default' || variant === 'card' || variant === 'minimal') {
    return variant as StatisticsProps['variant'];
  }
  throw new Error(`Statistics variant "${variant}" is not a canonical statistics variant.`);
}

function requireDataTableVariant(variant: CMSComponentProps['variant']): DataTableProps['variant'] {
  if (variant === undefined || variant === 'default' || variant === 'compact' || variant === 'spacious') {
    return variant as DataTableProps['variant'];
  }
  throw new Error(`DataTable variant "${variant}" is not a canonical data table variant.`);
}

function requireTimelineVariant(variant: CMSComponentProps['variant']): TimelineProps['variant'] {
  if (
    variant === undefined ||
    variant === 'default' ||
    variant === 'compact' ||
    variant === 'detailed' ||
    variant === 'progress'
  ) {
    return variant as TimelineProps['variant'];
  }
  throw new Error(`Timeline variant "${variant}" is not a canonical timeline variant.`);
}

/**
 * Statistics Adapter Component
 */
export const StatisticsAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<StatisticsContent>(props.content) as StatisticsContent;

  const adaptedProps: StatisticsProps = {
    id: props.id,
    type: ComponentType.Statistics,
    category: ComponentCategory.Data,
    content,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: requireStatisticsVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <Statistics {...adaptedProps} />;
};

/**
 * DataTable Adapter Component
 */
export const DataTableAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<DataTableContent>(props.content) as DataTableContent;

  const adaptedProps: DataTableProps = {
    id: props.id,
    type: ComponentType.DataTable,
    category: ComponentCategory.Data,
    content,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: requireDataTableVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <DataTable {...adaptedProps} />;
};

/**
 * Timeline Adapter Component
 */
export const TimelineAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<TimelineContent>(props.content) as TimelineContent;

  const adaptedProps: TimelineProps = {
    id: props.id,
    type: ComponentType.Timeline,
    category: ComponentCategory.Data,
    content,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: requireTimelineVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata,
  };

  return <Timeline {...adaptedProps} />;
};

/**
 * Chart Adapter Component
 */
export const ChartAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<ChartContent>(props.content) as ChartContent;

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
