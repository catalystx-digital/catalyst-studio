import type { ComponentTheme } from '../../_core/types';
import { type SmartLink } from '../../_core/value-objects';

type CardMedia =
  | string
  | {
      src?: string | {
        src?: string;
        url?: string;
        mediaId?: string;
        mediaType?: 'image' | 'video' | 'file';
        originalUrl?: string;
        renditions?: unknown[];
      };
      url?: string;
      alt?: string;
      originalUrl?: string;
      mediaId?: string;
      renditions?: Array<{
        src?: string;
        width?: number | null;
        height?: number | null;
      }>;
    };

export interface CardItem {
  id: string;
  title: string;
  description?: string;
  image?: CardMedia;
  imageAlt?: string;
  variant?: 'default' | 'muted' | 'accent' | 'minimal';
  link?: string;
  href?: SmartLink | string;
  linkText?: string;
  badge?: string;
  icon?: string;
  /** CSS background-color extracted from import (hex format, e.g., "#008ccc") */
  backgroundColor?: string;
  metadata?: {
    author?: string;
    date?: string;
    category?: string;
    tags?: string[];
  };
  actions?: Array<{
    label: string;
    url?: SmartLink | string;
    href?: SmartLink | string;
    variant?: 'primary' | 'secondary' | 'outline';
  }>;
}

export interface CardGridFilter {
  id: string;
  label: string;
  value?: string;
  href?: SmartLink | string;
  isActive?: boolean;
  icon?: string;
}

export interface NormalizedCardItem
  extends Omit<CardItem, 'image'> {
  image?: {
    src: string;
    alt?: string;
    originalUrl?: string;
    renditions?: Array<{
      src?: string;
      width?: number | null;
      height?: number | null;
    }>;
  };
}

export interface CardGridContent {
  heading?: string;
  subheading?: string;
  cards: CardItem[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'small' | 'medium' | 'large';
  cardStyle?: 'vertical' | 'horizontal' | 'compact';
  imagePosition?: 'top' | 'left' | 'right' | 'background';
  imageAspectRatio?: '16:9' | '4:3' | '1:1' | '3:2';
  imageLoading?: 'lazy' | 'eager';
  featureFirstCard?: boolean;
  filters?: CardGridFilter[];
}

export interface NormalizedCardGridContent
  extends Omit<CardGridContent, 'cards'> {
  cards: NormalizedCardItem[];
}

export interface CardGridProps {
  content: CardGridContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal' | 'detailed' | 'compact' | 'expanded';
  hover?: boolean;
  onCardClick?: (cardId: string) => void;
}

export interface CardGridServerProps {
  content: CardGridContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal' | 'detailed' | 'compact' | 'expanded';
  onCardClick?: (cardId: string) => void;
}

export interface CardGridClientProps
  extends Omit<CardGridServerProps, 'content'> {
  content: NormalizedCardGridContent;
  hover?: boolean;
}
