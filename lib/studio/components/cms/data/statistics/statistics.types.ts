import { ComponentCategory, ComponentTheme, ComponentType } from '@/lib/studio/components/cms/_core/types';
import { LucideIcon } from 'lucide-react';

export interface StatDelta {
  value?: number;
  label?: string;
  trend?: 'up' | 'down';
}

export interface StatItem {
  id: string;
  /** Numeric value for animation, or string for display-only (e.g., "25,000+", "4.8/5") */
  value: number | string;
  label: string;
  prefix?: string;
  suffix?: string;
  icon?: string | LucideIcon;
  description?: string;
  animationDuration?: number;
  decimalPlaces?: number;
  delta?: StatDelta;
}

export interface StatisticsContent {
  title?: string;
  subtitle?: string;
  stats: StatItem[];
  animateOnScroll?: boolean;
  animationDuration?: number;
  layout?: 'grid' | 'row';
  columns?: 2 | 3 | 4;
}

export interface StatisticsProps {
  id: string;
  type: ComponentType.Statistics;
  category: ComponentCategory.Data;
  content: StatisticsContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'card' | 'minimal';
  loading?: 'eager' | 'lazy';
  aiMetadata?: {
    keywords?: string[];
    confidence?: number;
  };
}
