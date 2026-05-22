import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Testimonial as TestimonialVO } from '@/lib/studio/components/cms/_core/value-objects';

export interface TestimonialSliderContent {
  testimonials: Testimonial[];
  autoPlayInterval?: number; // milliseconds, default 5000
  showNavigation?: boolean;
  showDots?: boolean;
  pauseOnHover?: boolean;
}

// Using Testimonial from value-objects registry
export type Testimonial = TestimonialVO;

export interface TestimonialSliderProps extends Omit<CMSComponentProps, 'content'> {
  content: TestimonialSliderContent;
}
