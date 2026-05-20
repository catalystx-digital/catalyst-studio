import { CMSComponentProps } from '../../_core/types';
import { type CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

export interface CTASimpleContent {
  eyebrow?: string;
  heading: string;
  body?: string;
  primaryButton: CTAButton;
  secondaryButton?: CTAButton;
  alignment?: 'left' | 'center' | 'right';
  backgroundVariant?: 'surface' | 'accent' | 'inverted';
}

export interface CTASimpleProps extends CMSComponentProps {
  content: CTASimpleContent;
}
