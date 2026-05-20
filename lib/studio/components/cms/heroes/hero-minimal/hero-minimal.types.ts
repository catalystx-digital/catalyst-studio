import { CMSComponentProps } from '../../_core/types';
import { type CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

// CTAButton now imported from registry

export interface HeroMinimalContent {
  heading: string;
  subheading?: string;
  ctaButtons?: CTAButton[];
  alignment?: 'left' | 'center' | 'right';
  backgroundPattern?: string;
  padding?: 'small' | 'medium' | 'large' | 'xlarge';
  backgroundColor?: string;
  textColor?: string;
  maxWidth?: 'small' | 'medium' | 'large' | 'full';
}

export interface HeroMinimalProps extends CMSComponentProps {
  content: HeroMinimalContent;
}