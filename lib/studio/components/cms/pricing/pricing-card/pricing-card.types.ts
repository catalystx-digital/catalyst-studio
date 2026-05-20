import { ComponentCategory, ComponentTheme, ComponentType } from '@/lib/studio/components/cms/_core/types';
import { type Badge } from '@/lib/studio/components/cms/_core/value-objects';

export interface PricingCardContent {
  name: string;
  description?: string;
  /** Price as number for display, or string for custom pricing (e.g., "Custom", "Contact Us") */
  price: number | string;
  originalPrice?: number;
  currency: string;
  period: 'monthly' | 'annual' | 'one-time';
  features: Array<{
    text: string;
    included: boolean;
    tooltip?: string;
  }>;
  ctaText?: string;
  ctaUrl?: string;
  badge?: Badge;
  highlighted?: boolean;
  disabled?: boolean;
}

export interface PricingCardProps {
  id: string;
  type: ComponentType.PricingCard;
  category: ComponentCategory.Pricing;
  content: PricingCardContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'outlined' | 'filled';
  loading?: 'eager' | 'lazy';
  aiMetadata?: {
    keywords?: string[];
    confidence?: number;
  };
}
