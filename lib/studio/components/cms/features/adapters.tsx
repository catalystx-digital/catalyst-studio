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

function requireObjectContent<T>(content: unknown, componentType: ComponentType): T {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    throw new Error(`${componentType} content must be canonical object content.`);
  }

  return content as T;
}

export const FeatureGridAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = requireObjectContent<FeatureGridContent>(
    props.content,
    ComponentType.FeatureGrid,
  );
  
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
  const content = requireObjectContent<FeatureShowcaseContent>(
    props.content,
    ComponentType.FeatureShowcase,
  );
  
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
  const content = requireObjectContent<FeatureComparisonContent>(
    props.content,
    ComponentType.FeatureComparison,
  );
  
  const adaptedProps = {
    id: props.id,
    type: ComponentType.FeatureComparison,
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
  const content = requireObjectContent<FeatureListContent>(
    props.content,
    ComponentType.FeatureList,
  );
  
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
