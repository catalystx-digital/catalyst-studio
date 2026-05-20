/**
 * Component registration module for social proof components
 * Registers all social proof components with the CMS factory
 */

import { cmsComponentFactory } from '../_factory/factory';
import { ComponentType } from '../_core/types';
import {
  TestimonialSliderAdapter,
  TestimonialGridAdapter,
  LogoStripAdapter,
  ReviewCardAdapter
} from './adapters';
import { detectionToAIMetadata } from '../_core/component-definition';
import { TestimonialSliderDef } from './testimonial-slider/testimonial-slider.def';
import { TestimonialGridDef } from './testimonial-grid/testimonial-grid.def';
import { LogoStripDef } from './logo-strip/logo-strip.def';
import { ReviewCardDef } from './review-card/review-card.def';
import { TestimonialItemDef } from './testimonial-item/testimonial-item.def';

// Register TestimonialSlider component
cmsComponentFactory.registerComponent(
  ComponentType.Testimonials,
  TestimonialSliderAdapter,
  detectionToAIMetadata(TestimonialSliderDef.detection!, ComponentType.Testimonials),
  { description: TestimonialSliderDef.description, schema: TestimonialSliderDef.schema }
);

// Register TestimonialGrid component
// Note: Using a separate registration approach for grid variant
cmsComponentFactory.registerComponent(
  ComponentType.Testimonials + '-grid' as ComponentType,
  TestimonialGridAdapter,
  detectionToAIMetadata(TestimonialGridDef.detection!, ComponentType.Testimonials),
  { description: TestimonialGridDef.description, schema: TestimonialGridDef.schema }
);

// Register LogoStrip component
cmsComponentFactory.registerComponent(
  ComponentType.LogoCloud,
  LogoStripAdapter,
  detectionToAIMetadata(LogoStripDef.detection!, ComponentType.LogoCloud),
  { description: LogoStripDef.description, schema: LogoStripDef.schema }
);

// Register ReviewCard component
cmsComponentFactory.registerComponent(
  ComponentType.Reviews,
  ReviewCardAdapter,
  detectionToAIMetadata(ReviewCardDef.detection!, ComponentType.Reviews),
  { description: ReviewCardDef.description, schema: ReviewCardDef.schema }
);

// Register CMS-only sub-component for testimonial items
cmsComponentFactory.registerComponent(
  ComponentType.TestimonialItem,
  TestimonialGridAdapter,
  detectionToAIMetadata(TestimonialItemDef.detection!, ComponentType.TestimonialItem),
  { description: TestimonialItemDef.description, schema: TestimonialItemDef.schema, subOnly: true }
);

// Export for convenience
export {
  TestimonialSliderAdapter,
  TestimonialGridAdapter,
  LogoStripAdapter,
  ReviewCardAdapter
};
