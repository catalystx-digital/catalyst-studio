import { ComponentTheme } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface QuoteAttribution {
  author?: string;
  title?: string;
  organization?: string;
  image?: Image | string;
  date?: string;
}

export interface QuoteBlockContent {
  heading?: string;
  subheading?: string;
  quote: RichText;
  attribution?: QuoteAttribution;
  highlight?: boolean;
  icon?: 'quotes' | 'none' | 'custom';
  customIcon?: string;
  style?: 'default' | 'bordered' | 'highlighted' | 'testimonial' | 'pullquote';
  align?: 'left' | 'center' | 'right';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

export interface QuoteBlockProps {
  content: QuoteBlockContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal' | 'detailed' | 'compact' | 'expanded';
  animated?: boolean;
  onShare?: (platform: string) => void;
}

export interface QuoteBlockServerProps {
  content: QuoteBlockContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal' | 'detailed' | 'compact' | 'expanded';
  onShare?: (platform: string) => void;
}

export interface QuoteBlockClientProps extends QuoteBlockServerProps {
  animated?: boolean;
}
