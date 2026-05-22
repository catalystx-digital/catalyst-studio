/**
 * Adapter components that wrap pricing components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { ComponentType, ComponentCategory } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';
import { readRuntimeContent } from '../_core/utils';
import PricingTable from './pricing-table';
import PricingCard from './pricing-card';
import type { PricingTableProps, PricingTableContent } from './pricing-table/pricing-table.types';
import type { PricingCardProps, PricingCardContent } from './pricing-card/pricing-card.types';

function mapPricingTableVariant(variant: CMSComponentProps['variant']): PricingTableProps['variant'] {
  return variant === 'expanded' ? 'detailed' : ((variant as PricingTableProps['variant']) ?? 'default');
}

function mapPricingCardVariant(variant: CMSComponentProps['variant']): PricingCardProps['variant'] {
  if (variant === 'minimal') {
    return 'outlined';
  }
  if (variant === 'detailed' || variant === 'expanded') {
    return 'filled';
  }
  return (variant as PricingCardProps['variant']) ?? 'default';
}

/**
 * PricingTable Adapter Component
 */
export const PricingTableAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<PricingTableContent>(props.content) as PricingTableContent;
  
  const adaptedProps: PricingTableProps = {
    id: props.id,
    type: ComponentType.PricingTable,
    category: ComponentCategory.Pricing,
    content: content,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: mapPricingTableVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata
  };
  
  return <PricingTable {...adaptedProps} />;
};

/**
 * PricingCard Adapter Component
 */
export const PricingCardAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<PricingCardContent>(props.content) as PricingCardContent;
  
  const adaptedProps: PricingCardProps = {
    id: props.id,
    type: ComponentType.PricingCard,
    category: ComponentCategory.Pricing,
    content: content,
    className: props.className,
    theme: props.theme ?? 'auto',
    variant: mapPricingCardVariant(props.variant),
    loading: props.loading ?? 'eager',
    aiMetadata: props.aiMetadata
  };
  
  return <PricingCard {...adaptedProps} />;
};
