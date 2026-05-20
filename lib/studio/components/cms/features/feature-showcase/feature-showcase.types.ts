import type { ReactNode } from 'react';
import type {
  CMSComponentProps,
  ComponentContent,
  ComponentPriority,
} from '../../_core/types';
import { type Image, type Badge } from '@/lib/studio/components/cms/_core/value-objects';

export interface ShowcaseFeature {
  text: string;
  icon?: ReactNode | string;
  highlighted?: boolean;
  highlightLabel?: string;
  badge?: Badge;
}

export interface ShowcaseSection {
  image?: Image;
  title: string;
  description?: string;
  features?: ShowcaseFeature[];
  cta?: {
    text?: string;
    url: string;
  };
  imagePosition?: 'left' | 'right';
  badge?: Badge;
  highlightLabel?: string;
}

export interface FeatureShowcaseContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  sections: ShowcaseSection[];
}

export interface FeatureShowcaseProps extends CMSComponentProps {
  content: FeatureShowcaseContent;
  ariaLabel?: string;
  loading?: HTMLImageElement['loading'];
  priority?: ComponentPriority;
}
