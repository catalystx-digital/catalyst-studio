import type { CMSComponentProps } from '../../_core/types';
import { type CTAButton as RegistryCTAButton, type VideoSource, type Image } from '@/lib/studio/components/cms/_core/value-objects';

// CTAButton now imported from registry
export type CTAButton = RegistryCTAButton;

export interface VideoSettings {
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  showOverlayToggle?: boolean;
}

export interface OverlayContent {
  heading?: string;
  subheading?: string;
  body?: string;
  ctaButtons?: CTAButton[];
  backgroundColor?: string;
  textColor?: string;
  maxWidth?: 'small' | 'medium' | 'large' | 'full';
  padding?: 'none' | 'compact' | 'comfortable' | 'spacious';
  disableDefaultBackground?: boolean;
}

export interface HeroVideoContent {
  videoUrl: VideoSource | string;
  posterImage?: Image | string;
  overlayContent?: OverlayContent;
  videoSettings?: VideoSettings;
  fallbackImage?: Image | string;
  height?: 'small' | 'medium' | 'large' | 'full';
  alignment?: 'left' | 'center' | 'right';
}

export interface HeroVideoProps extends Omit<CMSComponentProps, 'content'> {
  content: HeroVideoContent;
}
