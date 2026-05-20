import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { type VideoSource, type Image } from '@/lib/studio/components/cms/_core/value-objects';

// Video Player specific content interface
export interface VideoPlayerContent extends ComponentContent {
  sources: VideoSource[];
  posterImage?: Image | string;
  title?: string;
  description?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  showPlayButton?: boolean;
  aspectRatio?: '16:9' | '4:3' | '21:9' | '1:1' | '9:16';
  fallbackImage?: Image | string;
  fallbackMessage?: string;
}

// Video Player specific props
export interface VideoPlayerProps extends Omit<CMSComponentProps, 'content'> {
  content: VideoPlayerContent;
  analyticsId?: string;
}