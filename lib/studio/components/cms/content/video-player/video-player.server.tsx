import React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  cmsBody,
  cmsHeading,
  CmsSection,
  dsSpacing,
  themeClass,
} from '../../_ui';
import { sanitizeText } from '../../_core/security';
import { normalizeCmsImage } from '../../_utils/media-reference';
import { validateVideoUrl } from '../../_utils/url-validation';
import type { VideoPlayerProps, VideoSource } from './video-player.types';

const RATIO_MAP: Record<
  NonNullable<VideoPlayerProps['content']['aspectRatio']>,
  number
> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '21:9': 21 / 9,
  '1:1': 1,
  '9:16': 9 / 16,
};

const EMBED_BASE_CLASS =
  'cms-video-embed relative h-full w-full overflow-hidden rounded-xl';
const OVERLAY_BASE_CLASS =
  'cms-video-overlay absolute inset-0 pointer-events-none flex items-center justify-center';

type NativeVideoSource = Omit<VideoSource, 'type'> & {
  type: string;
  resolvedUrl: string;
};

export const VideoPlayerServer: React.FC<VideoPlayerProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}) => {
  const {
    sources = [],
    posterImage,
    title,
    description,
    autoPlay = false,
    muted = false,
    loop = false,
    controls = true,
    showPlayButton = true,
    aspectRatio = '16:9',
    fallbackImage,
    fallbackMessage = 'Your browser does not support video playback.',
  } = content;

  const ratio = RATIO_MAP[aspectRatio] ?? RATIO_MAP['16:9'];
  const normalizedPosterImage = normalizeCmsImage(posterImage, title);
  const normalizedFallbackImage = normalizeCmsImage(fallbackImage, title);

  const resolveVideoSourceUrl = (source: VideoSource): string | undefined => {
    const resolved = validateVideoUrl(source.url);
    return resolved || undefined;
  };

  const youtubeSource = sources.find(
    (source) => source.type === 'youtube' && resolveVideoSourceUrl(source),
  );
  const vimeoSource = sources.find(
    (source) => source.type === 'vimeo' && resolveVideoSourceUrl(source),
  );
  const nativeSources: NativeVideoSource[] = sources.flatMap((source) => {
    if (!source.type || !['mp4', 'webm', 'ogg'].includes(source.type)) {
      return [];
    }

    const resolvedUrl = resolveVideoSourceUrl(source);
    return resolvedUrl ? [{ ...source, type: source.type, resolvedUrl }] : [];
  });

  const getYouTubeId = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    );
    return match ? match[1] : null;
  };

  const getVimeoId = (url: string): string | null => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  };

  const renderYouTubeEmbed = (source: VideoSource) => {
    const sourceUrl = resolveVideoSourceUrl(source);
    if (!sourceUrl) {
      return null;
    }

    const videoId = getYouTubeId(sourceUrl);
    if (!videoId) {
      return null;
    }

    const params = new URLSearchParams({
      autoplay: autoPlay ? '1' : '0',
      mute: muted ? '1' : '0',
      loop: loop ? '1' : '0',
      controls: controls ? '1' : '0',
      rel: '0',
      modestbranding: '1',
    });

    return (
      <iframe
        className={`${EMBED_BASE_CLASS} border border-border/40 bg-background`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  };

  const renderVimeoEmbed = (source: VideoSource) => {
    const sourceUrl = resolveVideoSourceUrl(source);
    if (!sourceUrl) {
      return null;
    }

    const videoId = getVimeoId(sourceUrl);
    if (!videoId) {
      return null;
    }

    const params = new URLSearchParams({
      autoplay: autoPlay ? '1' : '0',
      muted: muted ? '1' : '0',
      loop: loop ? '1' : '0',
      controls: controls ? '1' : '0',
      title: '0',
      byline: '0',
      portrait: '0',
    });

    return (
      <iframe
        className={`${EMBED_BASE_CLASS} border border-border/40 bg-background`}
        src={`https://player.vimeo.com/video/${videoId}?${params.toString()}`}
        title={title || 'Vimeo video'}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  };

  const renderNativeVideo = () => {
    if (nativeSources.length === 0) {
      return null;
    }

    return (
      <video
        id={`${id}-video`}
        className={`${EMBED_BASE_CLASS} border border-border/40 bg-background object-contain`}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        poster={normalizedPosterImage?.src}
        preload="metadata"
      >
        {nativeSources.map((source, index) => (
          <source key={index} src={source.resolvedUrl} type={`video/${source.type}`} />
        ))}
        {sanitizeText(fallbackMessage)}
      </video>
    );
  };

  const renderFallback = () => {
    if (normalizedFallbackImage) {
      return (
        <div className="relative h-full w-full rounded-xl border border-border/40">
          <Image
            src={normalizedFallbackImage.src}
            alt={sanitizeText(normalizedFallbackImage.alt ?? title ?? 'Video fallback')}
            fill
            className="rounded-xl object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
            <p className={cmsBody('md', theme, 'text-foreground')}>
              {sanitizeText(fallbackMessage)}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/40 bg-muted/60">
        <p className={cmsBody('md', theme)}>
          {sanitizeText(fallbackMessage)}
        </p>
      </div>
    );
  };

  return (
    <CmsSection
      id={id}
      theme={theme}
      variant={variant}
      className={cn('cms-video-player-section', className)}
      style={style}
      size="md"
      containerClassName={cn('w-full', dsSpacing.gap('xl'))}
      data-testid="cms-video-player"
      data-analytics-id={analyticsId}
      data-component-type="video-player"
    >
    <Card
      id={`${id}-card`}
      className={cn(themeClass(theme), 'flex w-full flex-col')}
      data-variant={variant}
    >
      {(title || description) && (
        <CardHeader
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), dsSpacing.gap('sm'), 'pb-0')}
        >
          {title && (
            <h3 className={cmsHeading(3, theme)}>{sanitizeText(title)}</h3>
          )}
          {description && (
            <p className={cmsBody('md', theme)}>
              {sanitizeText(description)}
            </p>
          )}
        </CardHeader>
      )}

      <CardContent className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'p-0')}>
        <AspectRatio
          ratio={ratio}
          className={cn(
            'cms-video-aspect w-full overflow-hidden rounded-xl',
            'border border-border/40 bg-background/80',
            'shadow-sm transition-shadow hover:shadow-md'
          )}
          data-aspect-ratio={aspectRatio}
          data-video-container="true"
          data-has-fallback={Boolean(normalizedFallbackImage)}
        >
          {youtubeSource
            ? renderYouTubeEmbed(youtubeSource)
            : vimeoSource
              ? renderVimeoEmbed(vimeoSource)
              : nativeSources.length > 0
                ? renderNativeVideo()
                : renderFallback()}

          {showPlayButton &&
            !autoPlay &&
            normalizedPosterImage &&
            nativeSources.length > 0 && (
              <div
                className={cn(
                  OVERLAY_BASE_CLASS,
                  'backdrop-blur-[2px] bg-black/10 transition-opacity duration-300 hover:bg-black/20'
                )}
                data-play-overlay="true"
              >
                <button
                  className={cn(
                    'pointer-events-auto inline-flex h-20 w-20 items-center justify-center',
                    'rounded-full bg-primary/95 text-white',
                    'shadow-lg',
                    'transition-shadow hover:shadow-md',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  aria-label="Play video"
                  data-play-button="true"
                  type="button"
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-1"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            )}
        </AspectRatio>
      </CardContent>
    </Card>
  </CmsSection>
  );
};
