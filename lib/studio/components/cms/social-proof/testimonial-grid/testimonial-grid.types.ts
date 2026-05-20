import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Testimonial } from '@/lib/studio/components/cms/_core/value-objects';

export interface TestimonialGridContent {
  testimonials: GridTestimonial[];
  columns?: {
    desktop?: number; // >1024px
    tablet?: number;  // 768-1024px
    mobile?: number;  // <768px
  };
  showRating?: boolean;
}

// Using Testimonial from value-objects registry
export type GridTestimonial = Testimonial;

export interface TestimonialGridProps extends CMSComponentProps {
  content: TestimonialGridContent;
}