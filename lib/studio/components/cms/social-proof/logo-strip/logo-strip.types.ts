import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Image, type SmartLink } from '@/lib/studio/components/cms/_core/value-objects';

export interface LogoStripContent extends ComponentContent {
  logos: LogoItem[];
  size?: 'small' | 'medium' | 'large'; // 32px, 48px, 64px
  animateScroll?: boolean;
  scrollSpeed?: number; // pixels per second
  grayscale?: boolean;
  caption?: RichText;
}

export interface LogoItem extends Image {
  id: string;
  href?: SmartLink;
  caption?: RichText;
}

export interface LogoStripProps extends CMSComponentProps {
  content: LogoStripContent;
}
