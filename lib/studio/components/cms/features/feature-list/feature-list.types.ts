import type { ReactNode } from 'react';
import type { CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Badge } from '@/lib/studio/components/cms/_core/value-objects';

export interface FeatureListItem {
  title: string;
  description?: string;
  icon?: ReactNode | string;
  link?: {
    text?: string;
    url: string;
  };
  highlighted?: boolean;
  highlightLabel?: string;
  badge?: Badge;
}

export interface FeatureListContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  items: FeatureListItem[];
  layout?: 'vertical' | 'horizontal';
}

export interface FeatureListProps extends CMSComponentProps {
  content: FeatureListContent;
  ariaLabel?: string;
}
