import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface MilestoneItem {
  year: string;
  title: string;
  description?: string;
  icon?: string;
}

export interface ValueItem {
  title: string;
  description: string;
  icon?: string;
}

export interface AboutSectionContent {
  heading: string;
  subheading?: string;
  story?: RichText;
  mission?: RichText;
  vision?: RichText;
  values?: ValueItem[];
  milestones?: MilestoneItem[];
  imageList?: Image[];
  stats?: Array<{
    value: string;
    label: string;
    prefix?: string;
    suffix?: string;
  }>;
  layout?: 'single-column' | 'two-column' | 'timeline';
  showMilestones?: boolean;
  showValues?: boolean;
  showStats?: boolean;
}

export interface AboutSectionProps extends CMSComponentProps {
  content: AboutSectionContent;
}
