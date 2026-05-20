import { ComponentCategory, ComponentTheme, ComponentType } from '@/lib/studio/components/cms/_core/types';
import { type PricingTier, type Badge } from '@/lib/studio/components/cms/_core/value-objects';

export interface PricingFeature {
  name: string;
  availability: boolean[];
  tooltip?: string;
}

export interface PricingTableContent {
  title?: string;
  subtitle?: string;
  plans: PricingTier[];
  features?: PricingFeature[];
  showComparison?: boolean;
  highlightDifferences?: boolean;
}

export interface PricingTableProps {
  id: string;
  type: ComponentType.PricingTable;
  category: ComponentCategory.Pricing;
  content: PricingTableContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'compact' | 'detailed';
  loading?: 'eager' | 'lazy';
  aiMetadata?: {
    keywords?: string[];
    confidence?: number;
  };
}
