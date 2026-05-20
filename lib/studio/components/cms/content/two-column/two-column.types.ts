import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { RichText } from '../../_core/rich-text';

export type ColumnContent = {
  type: 'text' | 'image' | 'video' | 'html';
  heading?: string;
  body?: RichText;
  /** Raw HTML content for 'html' type - sanitized before rendering */
  html?: string;
  /** Optional link for clickable content blocks */
  link?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageAspectRatio?: string;
  imageHeight?: 'compact' | 'auto' | 'tall';
  imageFit?: 'cover' | 'contain';
  videoUrl?: string;
  videoAspectRatio?: string;
  videoHeight?: 'compact' | 'auto' | 'tall';
  videoFit?: 'cover' | 'contain';
  alignment?: 'left' | 'center' | 'right';
};

// Two-Column specific content interface
export interface TwoColumnContent extends ComponentContent {
  // Updated: support content[] for each column; optional for flexibility
  leftColumn?: CMSComponentProps[] | ColumnContent;
  rightColumn?: CMSComponentProps[] | ColumnContent;
  columnRatio?: '25-75' | '30-70' | '40-60' | '50-50' | '60-40' | '70-30' | '75-25';
  reverseOnMobile?: boolean;
  gap?: 'small' | 'medium' | 'large';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  // Optional slot-based child components for nested rendering
  areas?: {
    left?: CMSComponentProps[];
    right?: CMSComponentProps[];
  };
}

// Two-Column specific props
export interface TwoColumnProps extends Omit<CMSComponentProps, 'content'> {
  content: TwoColumnContent;
  analyticsId?: string;
}
