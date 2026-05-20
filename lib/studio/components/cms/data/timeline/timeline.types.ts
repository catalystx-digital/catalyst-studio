import { ComponentCategory, ComponentTheme, ComponentType } from '@/lib/studio/components/cms/_core/types';
import { LucideIcon } from 'lucide-react';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface TimelineAction {
  text: string;
  url: string;
  variant?: 'primary' | 'secondary' | 'link' | 'accent' | 'neutral' | 'outline';
}

export interface TimelineEvent {
  id: string;
  date: Date | string;
  title: string;
  description?: string;
  icon?: string | LucideIcon;
  type?: 'milestone' | 'event' | 'achievement' | 'default';
  link?: {
    text: string;
    url: string;
  };
  image?: Image;
  actions?: TimelineAction[];
}

export interface TimelineContent {
  title?: string;
  subtitle?: string;
  events: TimelineEvent[];
  layout?: 'vertical' | 'horizontal' | 'alternating' | 'balanced';
  showConnectors?: boolean;
  dateFormat?: string;
  showIcons?: boolean;
  animated?: boolean;
  footerCta?: TimelineAction;
}

export interface TimelineProps {
  id: string;
  type: ComponentType.Timeline;
  category: ComponentCategory.Data;
  content: TimelineContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'compact' | 'detailed' | 'progress';
  loading?: 'eager' | 'lazy';
  aiMetadata?: {
    keywords?: string[];
    confidence?: number;
  };
}
