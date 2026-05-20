import { CMSComponentProps } from '../../_core/types';
import { type CTAButton, type Image } from '@/lib/studio/components/cms/_core/value-objects';

// CTAButton now imported from registry

export interface HeroBannerBackgroundImage extends Image {
  renditions?: Array<{
    src?: string;
    width?: number | null;
    height?: number | null;
  }>;
}

export interface HeroBannerContent {
  heading: string;
  subheading?: string;
  body?: string;
  backgroundImage?: string | HeroBannerBackgroundImage | null;
  overlay?: {
    enabled: boolean;
    color?: string;
    opacity?: number;
    gradient?: string;
  };
  ctaButtons?: CTAButton[];
  alignment?: 'left' | 'center' | 'right';
  parallax?: boolean;
  height?: 'small' | 'medium' | 'large' | 'full';
}

export interface HeroBannerProps extends CMSComponentProps {
  content: HeroBannerContent;
}
