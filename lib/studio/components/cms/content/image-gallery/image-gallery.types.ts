import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface GalleryImage extends Omit<Image, 'src'> {
  url: string; // Kept for backward compatibility, maps to Image.src
}

// Image Gallery specific content interface
export interface ImageGalleryContent extends Omit<ComponentContent, 'images'> {
  images: GalleryImage[];
  displayMode?: 'grid' | 'carousel' | 'masonry';
  columns?: 2 | 3 | 4 | 5 | 6;
  spacing?: 'tight' | 'normal' | 'loose';
  maxWidth?: 'medium' | 'large' | 'full';
  showCaptions?: boolean;
  enableLightbox?: boolean;
  autoPlay?: boolean; // For carousel mode
  autoPlayInterval?: number; // In milliseconds
  pauseOnHover?: boolean; // Pause autoplay on hover (defaults to true)
}

// Image Gallery specific props
export interface ImageGalleryProps extends Omit<CMSComponentProps, 'content'> {
  content: ImageGalleryContent;
  analyticsId?: string;
}
