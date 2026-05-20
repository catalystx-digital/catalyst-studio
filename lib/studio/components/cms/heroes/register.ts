/**
 * Registration module for hero components with the CMS factory.
 * Uses adapter pattern to ensure TypeScript compatibility.
 */

import { cmsComponentFactory } from '../_factory/factory'
import { ComponentType } from '../_core/types'
import { detectionToAIMetadata } from '../_core/component-definition'
import {
  HeroSimpleAdapter,
  HeroBannerAdapter,
  HeroWithImageAdapter,
  HeroSplitAdapter,
  HeroMinimalAdapter,
  HeroVideoAdapter,
  HeroCarouselAdapter
} from './adapters'
import { HeroSimpleDef } from './hero-simple/hero-simple.def'
import { HeroBannerDef } from './hero-banner/hero-banner.def'
import { HeroWithImageDef } from './hero-with-image/hero-with-image.def'
import { HeroSplitDef } from './hero-split/hero-split.def'
import { HeroMinimalDef } from './hero-minimal/hero-minimal.def'
import { HeroVideoDef } from './hero-video/hero-video.def'
import { HeroCarouselDef } from './hero-carousel/hero-carousel.def'

// Register hero component adapters with factory
export function registerHeroComponents(): void {
  // Register HeroSimple adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroSimple,
    HeroSimpleAdapter,
    detectionToAIMetadata(HeroSimpleDef.detection!, ComponentType.HeroSimple),
    { description: HeroSimpleDef.description, schema: HeroSimpleDef.schema }
  )

  // Register HeroBanner adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroBanner,
    HeroBannerAdapter,
    detectionToAIMetadata(HeroBannerDef.detection!, ComponentType.HeroBanner),
    { description: HeroBannerDef.description, schema: HeroBannerDef.schema }
  )

  // Register HeroWithImage adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroWithImage,
    HeroWithImageAdapter,
    detectionToAIMetadata(HeroWithImageDef.detection!, ComponentType.HeroWithImage),
    { description: HeroWithImageDef.description, schema: HeroWithImageDef.schema }
  )

  // Register HeroSplit adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroSplit,
    HeroSplitAdapter,
    detectionToAIMetadata(HeroSplitDef.detection!, ComponentType.HeroSplit),
    { description: HeroSplitDef.description, schema: HeroSplitDef.schema }
  )

  // Register HeroMinimal adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroMinimal,
    HeroMinimalAdapter,
    detectionToAIMetadata(HeroMinimalDef.detection!, ComponentType.HeroMinimal),
    { description: HeroMinimalDef.description, schema: HeroMinimalDef.schema }
  )

  // Register HeroVideo adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroVideo,
    HeroVideoAdapter,
    detectionToAIMetadata(HeroVideoDef.detection!, ComponentType.HeroVideo),
    { description: HeroVideoDef.description, schema: HeroVideoDef.schema }
  )

  // Register HeroCarousel adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HeroCarousel,
    HeroCarouselAdapter,
    detectionToAIMetadata(HeroCarouselDef.detection!, ComponentType.HeroCarousel),
    { description: HeroCarouselDef.description, schema: HeroCarouselDef.schema }
  )
}

// Auto-register on import
registerHeroComponents()
