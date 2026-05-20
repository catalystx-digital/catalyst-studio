import React from 'react';
import { CardGridProps } from './card-grid.types';
import { CardGridServer } from './card-grid.server';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';

function CardGridBase(props: CardGridProps) {
  return <CardGridServer {...props} />;
}

export const CardGrid = withPerformanceTracking(CardGridBase, ComponentType.CardGrid);

export type {
  CardGridProps,
  CardGridContent,
  CardItem,
  CardGridFilter,
  NormalizedCardGridContent,
  NormalizedCardItem,
} from './card-grid.types';
