import { CMSComponentProps, ComponentTheme } from '../../_core/types';
import { type Link } from '../../_core/value-objects';

export type HeroCarouselCtaVariant = 'primary' | 'secondary' | 'outline';

export interface HeroCarouselSlideCta {
  href: Link | string;
  label?: string;
  text?: string;
  variant?: HeroCarouselCtaVariant;
  icon?: string;
}

export interface HeroCarouselSlideImage extends Record<string, unknown> {
  src?: string | { url?: string; originalUrl?: string; src?: string };
  alt?: string;
  focalPoint?: { x: number; y: number };
  overlayColor?: string;
}

export interface HeroCarouselSlideOverlay {
  color?: string;
  opacity?: number;
  gradient?: string;
}

export interface HeroCarouselSlideContent {
  eyebrow?: string;
  kicker?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  summary?: string;
  description?: string;
  alignment?: 'left' | 'center' | 'right';
  theme?: ComponentTheme;
  backgroundColor?: string;
  image?: HeroCarouselSlideImage;
  overlay?: HeroCarouselSlideOverlay;
  ctaButtons?: HeroCarouselSlideCta[];
  analyticsId?: string;
}

export interface HeroCarouselSlide {
  id?: string;
  type?: string;
  content?: HeroCarouselSlideContent;
  analyticsId?: string;
}

export interface HeroCarouselContent {
  slides?: HeroCarouselSlide[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  pauseOnHover?: boolean;
  showIndicators?: boolean;
  showControls?: boolean;
  loop?: boolean;
  height?: 'small' | 'medium' | 'large' | 'full';
  alignment?: 'left' | 'center' | 'right';
  indicatorStyle?: 'dots' | 'bars';
  transitionStyle?: 'fade' | 'slide';
  theme?: ComponentTheme;
}

export interface HeroCarouselProps extends Omit<CMSComponentProps, 'content'> {
  content: HeroCarouselContent;
  analyticsId?: string;
}
