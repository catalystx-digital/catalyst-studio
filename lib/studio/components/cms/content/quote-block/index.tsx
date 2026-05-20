import React from 'react';
import { QuoteBlockProps } from './quote-block.types';
import { QuoteBlockServer } from './quote-block.server';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';

function QuoteBlockBase(props: QuoteBlockProps) {
  return <QuoteBlockServer {...props} />;
}

export const QuoteBlock = withPerformanceTracking(QuoteBlockBase, ComponentType.QuoteBlock);

export type { QuoteBlockProps, QuoteBlockContent, QuoteAttribution } from './quote-block.types';