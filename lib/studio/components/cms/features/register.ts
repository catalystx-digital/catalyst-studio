import { cmsComponentFactory } from '../_factory/factory';
import { ComponentType } from '../_core/types';
import { detectionToAIMetadata } from '../_core/component-definition';
import {
  FeatureGridAdapter,
  FeatureShowcaseAdapter,
  FeatureComparisonAdapter,
  FeatureListAdapter
} from './adapters';
import { FeatureGridDef } from './feature-grid/feature-grid.def';
import { FeatureShowcaseDef } from './feature-showcase/feature-showcase.def';
import { FeatureComparisonDef } from './feature-comparison/feature-comparison.def';
import { FeatureListDef } from './feature-list/feature-list.def';
import { FeatureItemDef } from './feature-item/feature-item.def';

// Register Feature Grid component
cmsComponentFactory.registerComponent(
  ComponentType.FeatureGrid,
  FeatureGridAdapter,
  detectionToAIMetadata(FeatureGridDef.detection!, ComponentType.FeatureGrid),
  { description: FeatureGridDef.description, schema: FeatureGridDef.schema }
);

// Register Feature Showcase component as a top-level wrapper for sections
cmsComponentFactory.registerComponent(
  ComponentType.FeatureShowcase,
  FeatureShowcaseAdapter,
  detectionToAIMetadata(FeatureShowcaseDef.detection!, ComponentType.FeatureShowcase),
  { description: FeatureShowcaseDef.description, schema: FeatureShowcaseDef.schema }
);

// Register Feature Comparison component
cmsComponentFactory.registerComponent(
  ComponentType.FeatureComparison,
  FeatureComparisonAdapter,
  detectionToAIMetadata(FeatureComparisonDef.detection!, ComponentType.FeatureComparison),
  { description: FeatureComparisonDef.description, schema: FeatureComparisonDef.schema }
);

// Register Feature List component
cmsComponentFactory.registerComponent(
  ComponentType.FeatureList,
  FeatureListAdapter,
  detectionToAIMetadata(FeatureListDef.detection!, ComponentType.FeatureList),
  { description: FeatureListDef.description, schema: FeatureListDef.schema }
);

// Register CMS-only sub-components
cmsComponentFactory.registerComponent(
  ComponentType.FeatureItem,
  FeatureListAdapter,
  detectionToAIMetadata(FeatureItemDef.detection!, ComponentType.FeatureItem),
  { description: FeatureItemDef.description, schema: FeatureItemDef.schema, subOnly: true }
);

// Note: ShowcaseSection is a sub-component defined within FeatureShowcase, not a separate component
