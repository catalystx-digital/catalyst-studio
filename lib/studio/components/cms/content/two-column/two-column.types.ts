import { CMSComponentProps, ComponentContent } from '../../_core/types';

// Two-Column specific content interface
export interface TwoColumnContent extends ComponentContent {
  leftColumn?: CMSComponentProps[];
  rightColumn?: CMSComponentProps[];
  columnRatio?: '25-75' | '30-70' | '40-60' | '50-50' | '60-40' | '70-30' | '75-25';
  reverseOnMobile?: boolean;
  gap?: 'small' | 'medium' | 'large';
  verticalAlignment?: 'top' | 'center' | 'bottom';
}

// Two-Column specific props
export interface TwoColumnProps extends Omit<CMSComponentProps, 'content'> {
  content: TwoColumnContent;
  analyticsId?: string;
}
