/**
 * Registration of data visualization components with the CMS component factory.
 */

import { ComponentType } from '../_core/types';
import { cmsComponentFactory } from '../_factory/factory';
import { detectionToAIMetadata } from '../_core/component-definition';
import { StatisticsAdapter, DataTableAdapter, TimelineAdapter, ChartAdapter } from './adapters';
import { StatisticsDef } from './statistics/statistics.def';
import { DataTableDef } from './data-table/data-table.def';
import { TimelineDef } from './timeline/timeline.def';
import { ChartDef } from './chart/chart.def';

// Register Statistics component
cmsComponentFactory.registerComponent(
  ComponentType.Statistics,
  StatisticsAdapter,
  detectionToAIMetadata(StatisticsDef.detection!, ComponentType.Statistics),
  { description: StatisticsDef.description, schema: StatisticsDef.schema }
);

// Register DataTable component
cmsComponentFactory.registerComponent(
  ComponentType.DataTable,
  DataTableAdapter,
  detectionToAIMetadata(DataTableDef.detection!, ComponentType.DataTable),
  { description: DataTableDef.description, schema: DataTableDef.schema }
);

// Register Chart component
cmsComponentFactory.registerComponent(
  ComponentType.Chart,
  ChartAdapter,
  detectionToAIMetadata(ChartDef.detection!, ComponentType.Chart),
  { description: ChartDef.description, schema: ChartDef.schema }
);

// Register Timeline component
cmsComponentFactory.registerComponent(
  ComponentType.Timeline,
  TimelineAdapter,
  detectionToAIMetadata(TimelineDef.detection!, ComponentType.Timeline),
  { description: TimelineDef.description, schema: TimelineDef.schema }
);

// Note: TimelineEvent and TimelineAction are sub-components defined within Timeline, not separate components

// Registration complete - components are now available in factory
if (process.env.NODE_ENV === 'development') {
  console.log('[Data Components] Successfully registered:', {
    components: [ComponentType.Statistics, ComponentType.DataTable, ComponentType.Chart, ComponentType.Timeline],
    timestamp: new Date().toISOString()
  });
}
