/**
 * Adapter components that wrap social proof components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { ComponentType } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';
import { TestimonialSlider } from './testimonial-slider';
import { TestimonialGrid } from './testimonial-grid';
import { LogoStrip } from './logo-strip';
import { ReviewCard } from './review-card';
import type { TestimonialSliderContent } from './testimonial-slider/testimonial-slider.types';
import type { TestimonialGridContent } from './testimonial-grid/testimonial-grid.types';
import type { LogoStripContent } from './logo-strip/logo-strip.types';
import type { ReviewCardContent } from './review-card/review-card.types';
import { readRuntimeContent } from '../_core/utils';

/**
 * TestimonialSlider Adapter Component
 */
export const TestimonialSliderAdapter: React.FC<CMSComponentProps> = (props) => {
  // Type assertion with validation
  const content = readRuntimeContent<TestimonialSliderContent>(props.content) as TestimonialSliderContent;
  
  // Validate required content
  if (!content.testimonials || !Array.isArray(content.testimonials)) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('TestimonialSliderAdapter: Invalid content structure');
    }
    return null;
  }
  
  return <TestimonialSlider {...props} content={content} />;
};

/**
 * TestimonialGrid Adapter Component
 */
export const TestimonialGridAdapter: React.FC<CMSComponentProps> = (props) => {
  // Type assertion with validation
  const content = readRuntimeContent<TestimonialGridContent>(props.content) as TestimonialGridContent;
  
  // Validate required content
  if (!content.testimonials || !Array.isArray(content.testimonials)) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('TestimonialGridAdapter: Invalid content structure');
    }
    return null;
  }
  
  return <TestimonialGrid {...props} content={content} />;
};

/**
 * LogoStrip Adapter Component
 */
export const LogoStripAdapter: React.FC<CMSComponentProps> = (props) => {
  // Type assertion with validation
  const content = readRuntimeContent<LogoStripContent>(props.content) as LogoStripContent;
  
  // Validate required content
  if (!content.logos || !Array.isArray(content.logos)) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('LogoStripAdapter: Invalid content structure');
    }
    return null;
  }
  
  return <LogoStrip {...props} content={content} />;
};

/**
 * ReviewCard Adapter Component
 */
export const ReviewCardAdapter: React.FC<CMSComponentProps> = (props) => {
  // Type assertion with validation
  const content = readRuntimeContent<ReviewCardContent>(props.content) as ReviewCardContent;
  
  // Validate required content
  if (typeof content.rating !== 'number' || !content.reviewText || !content.author) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('ReviewCardAdapter: Invalid content structure');
    }
    return null;
  }
  
  return <ReviewCard {...props} content={content} />;
};
