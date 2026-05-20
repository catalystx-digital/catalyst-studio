import { CMSComponentProps } from '../../_core/types';
import { type CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

export interface CTAButtonGroupContent {
  heading?: string;
  subheading?: string;
  buttons: CTAButton[];
  alignment?: 'left' | 'center' | 'right';
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'loose';
  fullWidthOnMobile?: boolean;
}

export interface CTAButtonGroupProps extends CMSComponentProps {
  content: CTAButtonGroupContent;
}
