"use client";

import React, { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { cmsBody, cmsHeading, CmsSection, dsSpacing, resolveTheme } from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { validateUrl } from '../../_utils/url-validation';
import type { VideoEmbedContent, VideoEmbedProps } from './video-embed.types';

const aspectRatioClasses: Record<
  NonNullable<VideoEmbedContent['aspectRatio']>,
  string
> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
};

function toYouTubeEmbed(content: VideoEmbedContent, safeUrl: string): string {
  try {
    const parsed = new URL(safeUrl);
    let videoId = '';

    if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.replace('/', '');
    } else if (parsed.searchParams.has('v')) {
      videoId = parsed.searchParams.get('v') ?? '';
    } else {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = segments.indexOf('embed');
      if (embedIndex >= 0 && segments[embedIndex + 1]) {
        videoId = segments[embedIndex + 1];
      } else if (segments.length > 0) {
        videoId = segments[segments.length - 1];
      }
    }

    if (!videoId) {
      return safeUrl;
    }

    const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
    if (content.autoPlay) params.set('autoplay', '1');
    if (content.muted) params.set('mute', '1');
    if (content.startTime && content.startTime > 0) {
      params.set('start', Math.floor(content.startTime).toString());
    }

    const query = params.toString();
    return `https://www.youtube.com/embed/${videoId}${query ? `?${query}` : ''}`;
  } catch {
    return safeUrl;
  }
}

function toVimeoEmbed(content: VideoEmbedContent, safeUrl: string): string {
  try {
    const parsed = new URL(safeUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const videoId = segments[segments.length - 1] || '';
    if (!videoId) {
      return safeUrl;
    }

    const params = new URLSearchParams();
    if (content.autoPlay) params.set('autoplay', '1');
    if (content.muted) params.set('muted', '1');
    const query = params.toString();
    let embed = `https://player.vimeo.com/video/${videoId}`;
    if (query) {
      embed += `?${query}`;
    }
    if (content.startTime && content.startTime > 0) {
      embed += `#t=${Math.floor(content.startTime)}s`;
    }
    return embed;
  } catch {
    return safeUrl;
  }
}

function toLoomEmbed(content: VideoEmbedContent, safeUrl: string): string {
  try {
    const parsed = new URL(safeUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const shareIndex = segments.indexOf('share');
    let videoId = '';
    if (shareIndex >= 0 && segments[shareIndex + 1]) {
      videoId = segments[shareIndex + 1];
    } else if (segments.length > 0) {
      videoId = segments[segments.length - 1];
    }
    if (!videoId) {
      return safeUrl;
    }

    const params = new URLSearchParams();
    if (content.autoPlay) params.set('autoplay', '1');
    if (content.muted) params.set('mute', '1');
    const query = params.toString();
    return `https://www.loom.com/embed/${videoId}${query ? `?${query}` : ''}`;
  } catch {
    return safeUrl;
  }
}

function toWistiaEmbed(content: VideoEmbedContent, safeUrl: string): string {
  try {
    const parsed = new URL(safeUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const mediaIndex = segments.indexOf('medias');
    let mediaId = '';
    if (mediaIndex >= 0 && segments[mediaIndex + 1]) {
      mediaId = segments[mediaIndex + 1];
    } else if (segments.length > 0) {
      mediaId = segments[segments.length - 1];
    }
    if (!mediaId) {
      return safeUrl;
    }

    const params = new URLSearchParams({
      seo: 'false',
      videoFoam: 'true',
    });
    if (content.autoPlay) params.set('autoPlay', 'true');
    if (content.muted) params.set('muted', 'true');
    const query = params.toString();
    return `https://fast.wistia.net/embed/iframe/${mediaId}${query ? `?${query}` : ''}`;
  } catch {
    return safeUrl;
  }
}

function buildEmbedSrc(content: VideoEmbedContent): string {
  const safeUrl = validateUrl(content.url, { fallback: '' });
  if (!safeUrl) {
    return '';
  }

  switch (content.provider) {
    case 'youtube':
      return toYouTubeEmbed(content, safeUrl);
    case 'vimeo':
      return toVimeoEmbed(content, safeUrl);
    case 'loom':
      return toLoomEmbed(content, safeUrl);
    case 'wistia':
      return toWistiaEmbed(content, safeUrl);
    case 'iframe':
    default:
      return safeUrl;
  }
}

const VideoEmbedComponent: React.FC<VideoEmbedProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  onLoad,
  onError,
}) => {
  const embedSrc = useMemo(
    () => buildEmbedSrc(content),
    [content],
  );
  const aspectClass =
    content.aspectRatio && aspectRatioClasses[content.aspectRatio]
      ? aspectRatioClasses[content.aspectRatio]
      : aspectRatioClasses['16:9'];

  useEffect(() => {
    if (!embedSrc) {
      onError?.(new Error('Invalid video embed configuration'));
    }
  }, [embedSrc, onError]);

  if (!embedSrc) {
    return (
      <CmsSection
        id={id}
        size="sm"
        theme={theme}
        variant={variant}
        className={cn(
          'cms-video-embed',
          className,
        )}
        containerClassName={cn(
          'w-full rounded-lg border border-border/60 bg-muted/40 text-sm text-muted-foreground',
          dsSpacing.padding('lg'),
        )}
        data-component-type={type}
        style={style}
      >
        Unable to render video embed. Please verify the configuration.
      </CmsSection>
    );
  }

  const resolvedTheme = resolveTheme(theme);
  const sectionBackgroundClass =
    resolvedTheme === 'dark' || resolvedTheme === 'inverted'
      ? 'bg-background text-foreground'
      : 'bg-muted text-foreground';

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn(
        'cms-video-embed',
        sectionBackgroundClass,
        className,
      )}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('lg'))}
      data-component-id={id}
      data-component-type={type}
      style={style}
    >
      {content.title && (
        <h2 className={cmsHeading(3, resolvedTheme, 'text-balance font-bold tracking-tight')}>
          {content.title}
        </h2>
      )}
      {content.description && (
        <p className={cmsBody('md', resolvedTheme, 'text-muted-foreground leading-relaxed')}>
          {content.description}
        </p>
      )}
      <div
        className={cn(
          'group relative w-full overflow-hidden rounded-xl bg-card shadow-md',
          aspectClass,
        )}
      >
        <iframe
          src={embedSrc}
          title={content.title || 'Embedded video'}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen={content.allowFullScreen !== false}
          loading="lazy"
          onLoad={() => onLoad?.()}
        />
      </div>
      {content.caption && (
        <p className={cmsBody('sm', theme, 'text-center text-muted-foreground italic')}>
          {content.caption}
        </p>
      )}
    </CmsSection>
  );
};

export const VideoEmbed = withPerformanceTracking(
  VideoEmbedComponent,
  ComponentType.VideoEmbed,
);

export default VideoEmbed;
