import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Rating } from '@/lib/studio/components/cms/_core/value-objects';

export interface ReviewCardContent {
  rating: Rating | number; // Support both Rating object and legacy number
  reviewText: RichText;
  author: string;
  date: Date | string;
  verified?: boolean;
  platform?: 'google' | 'trustpilot' | 'yelp' | 'facebook' | 'custom';
  platformName?: string; // For custom platform
  platformLogo?: string; // URL for custom platform logo
  helpful?: {
    yes: number;
    no: number;
  };
}

export interface ReviewCardProps extends Omit<CMSComponentProps, 'content'> {
  content: ReviewCardContent;
}
