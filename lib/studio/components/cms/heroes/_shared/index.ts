export { HeroBackground, type BackgroundImage, type Rendition } from './hero-background';
export { HeroCTA, type CTAButton } from './hero-cta';

// Shared alignment and height configurations
export const HEIGHT_CLASSES = {
  small: 'min-h-[50vh] md:min-h-[60vh]',
  medium: 'min-h-[60vh] md:min-h-[80vh]',
  large: 'min-h-[75vh] md:min-h-[90vh]',
  full: 'min-h-screen',
} as const;

export const ALIGNMENT_CLASSES = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
} as const;

export type HeroHeight = keyof typeof HEIGHT_CLASSES;
export type HeroAlignment = keyof typeof ALIGNMENT_CLASSES;
