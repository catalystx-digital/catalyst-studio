import type { CMSComponentProps } from '../../_core/types';
import { type CTAButton, type Link } from '@/lib/studio/components/cms/_core/value-objects';

// HeroSimpleCTA and HeroSimpleLink are now imported as CTAButton and Link
// Note: CTAButton supports both 'text' and 'label' properties for compatibility
export type HeroSimpleCTA = CTAButton;
export type HeroSimpleLink = Link;

export interface HeroSimpleBackgroundImage {
  src?: string;
  alt?: string;
  focalPoint?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  mediaId?: string;
  originalUrl?: string;
  renditions?: Array<{
    src?: string;
    width?: number | null;
    height?: number | null;
  }>;
}

export interface HeroSimpleBackground {
  color?: string;
  gradient?: string;
  image?: HeroSimpleBackgroundImage | string | null;
  overlayColor?: string;
  overlayOpacity?: number;
}

/** Height options matching HeroBanner and other hero variants */
export type HeroHeight = 'small' | 'medium' | 'large' | 'full';

export interface HeroSimpleContent {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  body?: string;
  ctaButtons?: HeroSimpleCTA[];
  supportingLinks?: HeroSimpleLink[];
  alignment?: 'left' | 'center' | 'right';
  background?: HeroSimpleBackground;
  /** Hero height option. 'full' = min-h-screen (full viewport). Default: 'full' for max impact */
  height?: HeroHeight;
}

export interface HeroSimpleProps extends CMSComponentProps {
  content: HeroSimpleContent;
}
