'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { validateImageUrl } from '../../_utils/url-validation';

export interface BackgroundImage {
  src?: string | { src?: string; originalUrl?: string; renditions?: Rendition[] };
  alt?: string;
  originalUrl?: string;
  renditions?: Rendition[];
  focalPoint?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  mediaId?: string; // From media resolver
}

export interface Rendition {
  src?: string;
  width?: number | null;
  height?: number | null;
}

interface HeroBackgroundProps {
  // Accept flexible image types from various hero components
  image?: string | BackgroundImage | { src?: unknown; alt?: string; originalUrl?: string; renditions?: unknown[]; [key: string]: unknown } | null;
  overlay?: { color?: string; opacity?: number; gradient?: string };
  parallax?: boolean;
  onLoad?: () => void;
  className?: string;
}

const FOCAL_POINT_MAP: Record<string, string> = {
  center: 'center',
  top: 'top center',
  bottom: 'bottom center',
  left: 'center left',
  right: 'center right',
};

function normalizeRenditions(renditions?: Rendition[] | unknown[]): Array<{ src: string; width: number | null }> {
  if (!Array.isArray(renditions)) return [];
  return renditions
    .map(r => {
      if (!r || typeof r !== 'object') return null;
      const obj = r as Record<string, unknown>;
      const src = typeof obj.src === 'string' ? validateImageUrl(obj.src) : undefined;
      if (!src) return null;
      return { src, width: typeof obj.width === 'number' ? obj.width : null };
    })
    .filter((r): r is { src: string; width: number | null } => Boolean(r))
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
}

function normalizeBackgroundImage(image?: string | BackgroundImage | { src?: unknown; alt?: string; originalUrl?: string; renditions?: unknown[]; [key: string]: unknown } | null) {
  if (!image) return null;

  if (typeof image === 'string') {
    const src = validateImageUrl(image);
    return src ? { src, srcSet: undefined, sizes: undefined, alt: '', originalUrl: src, objectPosition: 'center' } : null;
  }

  let srcCandidate: string | undefined;
  let originalUrl: string | undefined;
  let renditions = image.renditions;

  if (typeof image.src === 'string') {
    srcCandidate = validateImageUrl(image.src);
    originalUrl = typeof image.originalUrl === 'string' ? validateImageUrl(image.originalUrl) : undefined;
  } else if (typeof image.src === 'object' && image.src) {
    const nested = image.src as { src?: string; url?: string; originalUrl?: string; renditions?: Rendition[] };
    // Support both 'src' and 'url' property names (MediaReference uses 'url')
    srcCandidate = typeof nested.src === 'string' ? validateImageUrl(nested.src) :
                   typeof nested.url === 'string' ? validateImageUrl(nested.url) : undefined;
    originalUrl = typeof nested.originalUrl === 'string' ? validateImageUrl(nested.originalUrl) :
                  typeof image.originalUrl === 'string' ? validateImageUrl(image.originalUrl) : undefined;
    if (Array.isArray(nested.renditions)) renditions = nested.renditions;
  } else {
    originalUrl = typeof image.originalUrl === 'string' ? validateImageUrl(image.originalUrl) : undefined;
  }

  const normalized = normalizeRenditions(renditions);
  const fallbackSrc = srcCandidate ?? normalized[normalized.length - 1]?.src ?? originalUrl;
  if (!fallbackSrc) return null;

  const srcSet = normalized.length > 0
    ? normalized.filter(r => r.width).map(r => `${r.src} ${r.width}w`).join(', ')
    : undefined;

  const focalPoint = typeof (image as BackgroundImage).focalPoint === 'string' ? (image as BackgroundImage).focalPoint : undefined;
  return {
    src: fallbackSrc,
    srcSet,
    sizes: srcSet ? '100vw' : undefined,
    alt: image.alt ?? '',
    originalUrl: image.originalUrl ?? fallbackSrc,
    objectPosition: focalPoint && focalPoint in FOCAL_POINT_MAP ? FOCAL_POINT_MAP[focalPoint] : 'center',
  };
}

export function HeroBackground({ image, overlay, parallax, onLoad, className }: HeroBackgroundProps) {
  const media = normalizeBackgroundImage(image);
  const isDataUrl = media?.src?.startsWith('data:') ?? false;
  const [loaded, setLoaded] = useState(() => !media?.src || isDataUrl);
  const loadHandledRef = useRef(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadHandledRef.current = false;
    const skip = !media?.src || isDataUrl;
    setLoaded(skip);
    if (skip && !loadHandledRef.current) {
      loadHandledRef.current = true;
      onLoad?.();
    }
  }, [media?.src, isDataUrl, onLoad]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    if (!loadHandledRef.current) {
      loadHandledRef.current = true;
      onLoad?.();
    }
  }, [onLoad]);

  // Handle cached images - if image is already complete when mounted, trigger load
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !loaded) {
      handleLoad();
    }
  }, [handleLoad, loaded]);

  useEffect(() => {
    if (!parallax) return;
    let rafId: number | null = null;
    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        setParallaxOffset(window.pageYOffset * -0.3);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [parallax]);

  if (!media?.src) return null;

  return (
    <div ref={containerRef} className={cn('absolute inset-0 z-0', className)} aria-hidden="true">
      <div
        className="relative h-full w-full"
        style={parallax ? { transform: `translate3d(0, ${parallaxOffset}px, 0)`, willChange: 'transform' } : undefined}
      >
        {/* width/height prevent CLS (layout shift). CSS h-full w-full handles actual sizing. */}
        <img
          ref={imgRef}
          src={media.src}
          srcSet={media.srcSet}
          sizes={media.sizes}
          alt={media.alt}
          width={1920}
          height={1080}
          className={cn('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
          style={{ objectPosition: media.objectPosition }}
          loading="eager"
          decoding="async"
          data-original-url={media.originalUrl}
          onLoad={handleLoad}
          onError={handleLoad}
        />
      </div>

      {/* Overlay: custom if provided, else default dark overlay for text readability */}
      {overlay ? (
        <div
          className="absolute inset-0"
          style={{
            background: overlay.gradient ?? (overlay.color ? `linear-gradient(135deg, ${overlay.color}, ${overlay.color}80)` : undefined),
            opacity: overlay.opacity ?? 0.6,
          }}
        />
      ) : (
        /* Default overlay when none specified - ensures text is readable on any image */
        <>
          {/* Primary overlay - uniform coverage for center-positioned text */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Secondary bottom gradient for CTA visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </>
      )}

      {!loaded && <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />}
    </div>
  );
}
