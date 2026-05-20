import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface LogoStripContent {
  logos: LogoItem[];
  size?: 'small' | 'medium' | 'large'; // 32px, 48px, 64px
  animateScroll?: boolean;
  scrollSpeed?: number; // pixels per second
  grayscale?: boolean;
  caption?: RichText;
}

export interface LogoItem extends Image {
  id: string;
  link?: string;
  caption?: RichText;
}

export interface LogoStripProps extends CMSComponentProps {
  content: LogoStripContent;
}
