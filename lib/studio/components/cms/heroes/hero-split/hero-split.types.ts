import { CMSComponentProps } from '../../_core/types';
import { type CTAButton as RegistryCTAButton } from '@/lib/studio/components/cms/_core/value-objects';

// CTAButton now imported from registry
export type CTAButton = RegistryCTAButton;

export interface MediaContent {
  type: 'image' | 'video' | 'embed';
  src?: string;
  alt?: string;
  poster?: string;
  mediaId?: string;
  originalUrl?: string;
}

export interface HeroSplitContent {
  heading: string;
  subheading?: string;
  body?: string;
  media?: MediaContent;
  mediaPosition?: 'left' | 'right';
  splitRatio?: '50-50' | '60-40' | '40-60';
  ctaButtons?: CTAButton[];
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface HeroSplitProps extends CMSComponentProps {
  content: HeroSplitContent;
}
