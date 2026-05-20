import type { CMSComponentProps } from '../../_core/types';
import { type VideoSource } from '@/lib/studio/components/cms/_core/value-objects';

export const VIDEO_EMBED_PROVIDERS = [
  'youtube',
  'vimeo',
  'loom',
  'wistia',
  'iframe',
] as const;

export type VideoEmbedProvider = (typeof VIDEO_EMBED_PROVIDERS)[number];

export const VIDEO_EMBED_VARIANTS = ['default', 'portrait', 'square'] as const;
export type VideoEmbedVariant = (typeof VIDEO_EMBED_VARIANTS)[number];

export interface VideoEmbedContent {
  provider: VideoEmbedProvider;
  url: VideoSource | string;
  title?: string;
  description?: string;
  allowFullScreen?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  startTime?: number;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16';
  caption?: string;
}

export interface VideoEmbedProps extends Omit<CMSComponentProps, 'content'> {
  content: VideoEmbedContent;
}
