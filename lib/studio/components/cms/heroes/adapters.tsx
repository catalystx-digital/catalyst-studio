/**
 * Adapter components that wrap hero components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import type { CMSComponentProps } from '../_core/types';
import { HeroSimple } from './hero-simple';
import { HeroBanner } from './hero-banner';
import { HeroWithImage } from './hero-with-image';
import { HeroSplit } from './hero-split';
import { HeroMinimal } from './hero-minimal';
import { HeroVideo } from './hero-video';
import { HeroCarousel } from './hero-carousel';
import type { HeroSimpleProps, HeroSimpleContent } from './hero-simple/hero-simple.types';
import type { HeroBannerProps, HeroBannerContent } from './hero-banner/hero-banner.types';
import type { HeroWithImageProps, HeroWithImageContent } from './hero-with-image/hero-with-image.types';
import type { HeroSplitProps, HeroSplitContent } from './hero-split/hero-split.types';
import type { HeroMinimalProps, HeroMinimalContent } from './hero-minimal/hero-minimal.types';
import type { HeroVideoProps, HeroVideoContent } from './hero-video/hero-video.types';
import type { HeroCarouselProps, HeroCarouselContent } from './hero-carousel/hero-carousel.types';

/**
 * HeroSimple Adapter Component
 */
export const HeroSimpleAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroSimpleProps = {
    ...props,
    content: props.content as HeroSimpleContent
  };
  return <HeroSimple {...adaptedProps} />;
};

/**
 * HeroBanner Adapter Component
 */
export const HeroBannerAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroBannerProps = {
    ...props,
    content: props.content as HeroBannerContent
  };
  return <HeroBanner {...adaptedProps} />;
};

/**
 * HeroSplit Adapter Component
 */
export const HeroSplitAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroSplitProps = {
    ...props,
    content: props.content as HeroSplitContent
  };
  return <HeroSplit {...adaptedProps} />;
};

/**
 * HeroMinimal Adapter Component
 */
export const HeroMinimalAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroMinimalProps = {
    ...props,
    content: props.content as HeroMinimalContent
  };
  return <HeroMinimal {...adaptedProps} />;
};

/**
 * HeroVideo Adapter Component
 */
export const HeroVideoAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroVideoProps = {
    ...props,
    content: props.content as HeroVideoContent
  };
  return <HeroVideo {...adaptedProps} />;
};
/**
 * HeroWithImage Adapter Component
 */
export const HeroWithImageAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroWithImageProps = {
    ...props,
    content: props.content as HeroWithImageContent
  };
  return <HeroWithImage {...adaptedProps} />;
};

/**
 * HeroCarousel Adapter Component
 */
export const HeroCarouselAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: HeroCarouselProps = {
    ...props,
    content: props.content as HeroCarouselContent
  };
  return <HeroCarousel {...adaptedProps} />;
};
