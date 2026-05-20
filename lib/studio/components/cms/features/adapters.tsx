import React from 'react';
import { ComponentType } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';
import { FeatureGrid } from './feature-grid';
import { FeatureShowcase } from './feature-showcase';
import { FeatureComparison } from './feature-comparison';
import { FeatureList } from './feature-list';
import type { FeatureGridContent } from './feature-grid/feature-grid.types';
import type { FeatureShowcaseContent } from './feature-showcase/feature-showcase.types';
import type { FeatureComparisonContent } from './feature-comparison/feature-comparison.types';
import type { FeatureListContent } from './feature-list/feature-list.types';

export const FeatureGridAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as FeatureGridContent;
  
  const adaptedProps = {
    id: props.id,
    type: ComponentType.FeatureGrid,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    ariaLabel: props.aiMetadata?.accessibility?.ariaLabel
  };
  
  return <FeatureGrid {...adaptedProps} />;
};

export const FeatureShowcaseAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as FeatureShowcaseContent;
  
  const adaptedProps = {
    id: props.id,
    type: ComponentType.FeatureShowcase,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'lazy',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    ariaLabel: props.aiMetadata?.accessibility?.ariaLabel
  };
  
  return <FeatureShowcase {...adaptedProps} />;
};

export const FeatureComparisonAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as FeatureComparisonContent;
  
  const adaptedProps = {
    id: props.id,
    type: ComponentType.PricingTable, // Maps to PricingTable for comparison tables
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    ariaLabel: props.aiMetadata?.accessibility?.ariaLabel
  };
  
  return <FeatureComparison {...adaptedProps} />;
};

export const FeatureListAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as FeatureListContent;
  
  const adaptedProps = {
    id: props.id,
    type: ComponentType.FeatureList,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    ariaLabel: props.aiMetadata?.accessibility?.ariaLabel
  };
  
  return <FeatureList {...adaptedProps} />;
};
