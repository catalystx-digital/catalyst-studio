import { CMSComponentProps } from '../../_core/types';
import { type CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

export type CTABannerButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'primary';

// CTAButtonConfig now uses the registry CTAButton type
export type CTAButtonConfig = CTAButton & {
  variant?: CTABannerButtonVariant; // Extended to support additional variants
};

export interface CTABannerContent {
  heading: string;
  subheading?: string;
  primaryButton?: CTAButtonConfig;
  secondaryButton?: CTAButtonConfig;
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  alignment?: 'left' | 'center' | 'right';
  fullWidth?: boolean;
}

export interface CTABannerProps extends CMSComponentProps {
  content: CTABannerContent;
}
