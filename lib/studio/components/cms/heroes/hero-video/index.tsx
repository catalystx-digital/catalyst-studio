'use client';

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { HeroVideoProps, CTAButton, OverlayContent } from './hero-video.types';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { hexToRgba } from '@/lib/studio/design-system/utils/color-utils';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { validateVideoUrl, validateImageUrl, isTrustedVideoEmbedUrl, isStreamingManifestUrl } from '../../_utils/url-validation';
import { sanitizeText } from '../../_core/security';
import { HeroCTA, ALIGNMENT_CLASSES } from '../_shared';

type OverlayMaxWidth = NonNullable<OverlayContent['maxWidth']>;
type OverlayPadding = NonNullable<OverlayContent['padding']>;

const overlayMaxWidthClasses: Record<OverlayMaxWidth, string> = {
  small: 'max-w-2xl',
  medium: 'max-w-3xl',
  large: 'max-w-4xl',
  full: 'max-w-none',
};

const overlayPaddingClasses: Record<OverlayPadding, string> = {
  none: 'p-0',
  compact: `${dsSpacing.padding('sm')} md:${dsSpacing.padding('md')}`,
  comfortable: `${dsSpacing.padding('md')} md:${dsSpacing.padding('lg')}`,
  spacious: `${dsSpacing.padding('lg')} md:${dsSpacing.padding('xl')}`,
};

const HeroVideoComponent: React.FC<HeroVideoProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'auto',
  onLoad,
  onError,
  onInteraction
}) => {
  const {
    videoUrl: rawVideoUrl,
    posterImage: rawPosterImage,
    overlayContent,
    videoSettings = {
      autoplay: true,
      loop: true,
      muted: true,
      controls: false,
      showOverlayToggle: true,
    },
    fallbackImage: rawFallbackImage,
    height = 'full',
    alignment = 'center'
  } = content;

  // Validate URLs for security
  const videoUrl = validateVideoUrl(rawVideoUrl);
  const isEmbedVideo = isTrustedVideoEmbedUrl(videoUrl);
  const isStreamingManifest = isStreamingManifestUrl(videoUrl);
  const posterImage = validateImageUrl(rawPosterImage);
  const fallbackImage = validateImageUrl(rawFallbackImage);
  const fallbackSrc = fallbackImage ?? posterImage ?? null;
  const shouldShowOverlayToggle =
    (videoSettings && typeof videoSettings.showOverlayToggle !== 'undefined'
      ? videoSettings.showOverlayToggle
      : true) && !videoSettings.controls && !isEmbedVideo;

  const heroHeading = overlayContent?.heading
    ? sanitizeText(overlayContent.heading)
    : undefined;
  const heroSubheading = overlayContent?.subheading
    ? sanitizeText(overlayContent.subheading)
    : undefined;
  const heroBody = overlayContent?.body
    ? sanitizeText(overlayContent.body)
    : undefined;
  const fallbackAltText = sanitizeText(
    heroHeading
      ? `Background visual for "${heroHeading}"`
      : 'Background visual for hero video',
  );

  const overlayBackgroundColor =
    overlayContent?.backgroundColor ?? null;
  const overlayTextColor = overlayContent?.textColor ?? null;
  const overlayMaxWidth =
    overlayContent?.maxWidth ?? 'large';
  const overlayPadding =
    overlayContent?.padding ?? 'comfortable';
  const disableDefaultOverlayBackground =
    overlayContent?.disableDefaultBackground ?? false;

  const overlayStyle: CSSProperties = {
    ...(overlayBackgroundColor
      ? {
          background: overlayBackgroundColor.startsWith('#')
            ? hexToRgba(overlayBackgroundColor, 0.82)
            : overlayBackgroundColor,
          ...(overlayBackgroundColor.startsWith('#') ? {} : { opacity: 0.82 }),
        }
      : null),
    ...(overlayTextColor ? { color: overlayTextColor } : null),
  };
  const overlayTextStyle: CSSProperties | undefined = overlayTextColor
    ? { color: overlayTextColor }
    : undefined;

  const [videoState, setVideoState] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'error'>(
    videoUrl && !isEmbedVideo ? 'loading' : 'ready',
  );
  const [showControls, setShowControls] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle video load with timeout
  useEffect(() => {
    if (!videoUrl || isEmbedVideo) {
      setVideoState('ready');
      onLoad?.();
      return;
    }

    // Set a timeout for video loading (10 seconds)
    loadTimeoutRef.current = setTimeout(() => {
      setVideoState('error');
      setFallbackActive(true);
      onError?.(new Error('Video load timeout'));
    }, 10000);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [videoUrl, onLoad, onError]);

  // Handle video events
  const handleVideoLoad = () => {
    if (isEmbedVideo) {
      return;
    }
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    setVideoState('ready');
    onLoad?.();
  };

  const handleVideoError = () => {
    if (isEmbedVideo) {
      return;
    }
    setVideoState('error');
    setFallbackActive(true);
    onError?.(new Error('Video failed to load'));
  };

  const handleVideoPlay = () => {
    setVideoState('playing');
    onInteraction?.('video-play', { videoUrl });
  };

  const handleVideoPause = () => {
    setVideoState('paused');
    onInteraction?.('video-pause', { videoUrl });
  };

  // Handle play/pause toggle
  const togglePlayPause = () => {
    if (isEmbedVideo) {
      return;
    }
    if (videoRef.current) {
      if (videoState === 'playing') {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {
          setShowControls(true); // Show controls if autoplay fails
        });
      }
    }
  };

  // Handle CTA button clicks
  const handleCtaClick = useCallback(
    (button: CTAButton, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const heightClasses = {
    small: 'min-h-[40vh]',
    medium: 'min-h-[60vh]',
    large: 'min-h-[80vh]',
    full: 'min-h-screen'
  };

  const resolvedTheme = resolveTheme(theme);
  const overlayToneClass =
    resolvedTheme === 'dark' || resolvedTheme === 'inverted'
      ? 'bg-background/75'
      : 'bg-background/60';

  const videoSources = useMemo(() => {
    if (!videoUrl || isEmbedVideo) {
      return [];
    }

    const lower = videoUrl.toLowerCase();
    const sources: Array<{ src: string; type?: string }> = [];

    if (isStreamingManifest) {
      const manifestType = lower.includes('.mpd') ? 'application/dash+xml' : 'application/x-mpegURL';
      sources.push({ src: videoUrl, type: manifestType });
      return sources;
    }

    if (/\.(webm)(\?|$)/.test(lower)) {
      sources.push({ src: videoUrl, type: 'video/webm' });
      return sources;
    }

    if (/\.(ogg|ogv)(\?|$)/.test(lower)) {
      sources.push({ src: videoUrl, type: 'video/ogg' });
      return sources;
    }

    const mp4Source = { src: videoUrl, type: 'video/mp4' };
    sources.push(mp4Source);

    const webmCandidate = videoUrl.replace(/\.mp4(\?.*)?$/i, '.webm$1');
    if (webmCandidate !== videoUrl) {
      sources.push({ src: webmCandidate, type: 'video/webm' });
    }

    return sources;
  }, [videoUrl, isEmbedVideo, isStreamingManifest]);

  const sectionBackgroundClass =
    resolvedTheme === 'dark' || resolvedTheme === 'inverted'
      ? 'bg-background text-foreground'
      : 'bg-muted text-foreground';

  const sectionClassName = cn(
    'cms-hero-video relative flex items-center justify-center overflow-hidden',
    heightClasses[height],
    sectionBackgroundClass,
    className,
  );

  const overlaySurfaceClass = disableDefaultOverlayBackground
    ? 'bg-background/40'
    : resolvedTheme === 'dark' || resolvedTheme === 'inverted'
      ? 'bg-slate-900/70'
      : 'bg-white/80';

  return (
    <CmsSection
      container={false}
      data-component-id={id}
      data-component-type={type}
      theme={theme}

      size="md"
      className={sectionClassName}
      style={style}
    >
      {/* Static backdrop */}
      <div className="absolute inset-0 z-0">
        {fallbackSrc ? (
          <img
            src={fallbackSrc}
            alt={fallbackAltText}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="h-full w-full bg-card" />
        )}
      </div>

      {/* Video / Embed */}
      {!fallbackActive && videoUrl && !isEmbedVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 z-10 h-full w-full object-cover"
          poster={posterImage ?? fallbackSrc ?? undefined}
          autoPlay={videoSettings.autoplay}
          loop={videoSettings.loop}
          muted={videoSettings.muted}
          controls={videoSettings.controls || showControls}
          playsInline
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
        >
          {videoSources.map(source => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
          Your browser does not support the video tag.
        </video>
      ) : null}

      {!fallbackActive && videoUrl && isEmbedVideo ? (
        <iframe
          src={videoUrl}
          title={heroHeading ? `${heroHeading} video` : 'Embedded video'}
          className="absolute inset-0 z-10 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          onLoad={() => setVideoState('ready')}
        />
      ) : null}

      {/* Poster fallback when playback fails */}
      {(fallbackActive || (!videoUrl && fallbackSrc)) && fallbackSrc ? (
        <div className="absolute inset-0 z-10">
          <img
            src={fallbackSrc}
            alt={fallbackAltText}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}

      {/* Global overlay tint */}
      <div
        className={cn(
          'absolute inset-0 z-15 pointer-events-none transition-opacity duration-300',
          overlayToneClass,
        )}
        aria-hidden="true"
      />

      {/* Loading State */}
      {videoState === 'loading' && videoUrl && !isEmbedVideo && (
        <div
          className="pointer-events-none absolute inset-0 z-[18] overflow-hidden rounded-none"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-br from-background/30 via-transparent to-background/20 opacity-80" />
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-background/45 to-transparent opacity-85" />
        </div>
      )}

      {/* Error State with Retry */}
      {videoState === 'error' && fallbackActive && !isEmbedVideo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <button
            onClick={() => {
              setFallbackActive(false);
              setVideoState('loading');
            }}
            className={cn(
              'rounded-lg backdrop-blur transition',
              dsSpacing.px('sm'),
              dsSpacing.py('xs'),
              'text-primary-foreground',
              'bg-background/20 hover:bg-background/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40',
            )}
          >
            Retry Video
          </button>
        </div>
      )}

      {/* Play/Pause Button Overlay */}
      {videoUrl && !isEmbedVideo && shouldShowOverlayToggle && videoState !== 'loading' && (
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 z-30 w-full h-full bg-transparent cursor-pointer group"
          aria-label={videoState === 'playing' ? 'Pause video' : 'Play video'}
        >
          <div
            className={cn(
              'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform',
              'bg-background/20 backdrop-blur rounded-full',
              dsSpacing.padding('sm'),
              'opacity-0 group-hover:opacity-100 transition-opacity',
              videoState !== 'playing' && 'opacity-100',
            )}
          >
            {videoState === 'playing' ? (
              <svg className="h-12 w-12 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="h-12 w-12 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>
      )}

      {/* Overlay Content - pt-16 accounts for fixed navbar height in transparent mode */}
      {overlayContent && (
        <div className="relative z-20 flex w-full pt-16">
          <div className="mx-auto flex w-full flex-col px-4 sm:px-6 lg:px-8">
            <div
              className={cn(
                'flex flex-col',
                dsSpacing.gap('md'),
                overlayMaxWidthClasses[overlayMaxWidth],
                ALIGNMENT_CLASSES[alignment as keyof typeof ALIGNMENT_CLASSES],
                alignment === 'center' ? 'mx-auto' : alignment === 'left' ? 'mr-auto' : 'ml-auto',
                overlayPaddingClasses[overlayPadding],
                'rounded-3xl backdrop-blur-xl shadow-2xl ring-1 ring-background/45',
                overlaySurfaceClass,
              )}
              style={overlayStyle}
            >
              {heroHeading && <h1 className={cmsHeading(1, resolvedTheme, 'drop-shadow-lg')} style={overlayTextStyle}>{heroHeading}</h1>}
              {heroSubheading && <h2 className={cmsHeading(3, resolvedTheme, 'text-muted-foreground')} style={overlayTextStyle}>{heroSubheading}</h2>}
              {heroBody && <p className={cn(cmsBody('lg', resolvedTheme), 'max-w-2xl')} style={overlayTextStyle}>{heroBody}</p>}
              {overlayContent.ctaButtons && overlayContent.ctaButtons.length > 0 && (
                <HeroCTA buttons={overlayContent.ctaButtons} alignment={alignment} theme={resolvedTheme} onCtaClick={handleCtaClick as any} className="mt-6" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mute/Unmute Controls */}
      {videoUrl && videoState === 'playing' && (
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted;
              onInteraction?.(videoRef.current.muted ? 'video-mute' : 'video-unmute', {});
            }
          }}
          className={cn(
            'absolute bottom-4 right-4 z-30 rounded-lg backdrop-blur transition',
            dsSpacing.padding('xs'),
            'text-primary-foreground',
            'bg-background/65',
            'hover:bg-background/75',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40',
          )}
          aria-label="Toggle mute"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        </button>
      )}
    </CmsSection>
  );
};

export const HeroVideo = withPerformanceTracking(HeroVideoComponent, ComponentType.HeroVideo);
export default HeroVideo;
export type { HeroVideoProps, HeroVideoContent, CTAButton, VideoSettings, OverlayContent } from './hero-video.types';
