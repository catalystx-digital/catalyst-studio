import type { ReactNode } from 'react';
import type { CMSComponentProps, ComponentContent, SectionBackground } from '../../_core/types';
import { type Image, type Badge } from '@/lib/studio/components/cms/_core/value-objects';

export interface FeatureItem {
  title: string;
  description?: string;
  icon?: ReactNode | string;
  highlighted?: boolean;
  highlightLabel?: string;
  badge?: Badge;
  media?: Image;
  link?: {
    text?: string;
    url: string;
  };
}

export interface FeatureGridContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  features: FeatureItem[];
  columns?: 2 | 3 | 4;
  /** Section background for visual rhythm */
  background?: SectionBackground;
}

export interface FeatureGridProps extends CMSComponentProps {
  content: FeatureGridContent;
  ariaLabel?: string;
}
