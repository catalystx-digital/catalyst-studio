import type { CMSComponentProps } from '../../_core/types';
import { type CTAButton as RegistryCTAButton, type Image } from '@/lib/studio/components/cms/_core/value-objects';

// CTAButton now imported from registry
export type CTAButton = RegistryCTAButton;

export type HeroBannerBackgroundImage = Image & Record<string, unknown> & {
  renditions?: Array<{
    src?: string;
    width?: number | null;
    height?: number | null;
  }>;
};

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
