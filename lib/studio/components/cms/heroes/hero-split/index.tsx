"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

import { CmsSection, cmsBody, cmsHeading, dsSpacing, resolveTheme } from '../../_ui';
import { HeroSplitProps, MediaContent, CTAButton } from './hero-split.types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { validateImageUrl, validateVideoUrl } from '../../_utils/url-validation';
import { HeroCTA } from '../_shared';

function normalizeMedia(media?: MediaContent) {
  if (!media?.src) return undefined;
  if (media.type === 'video') {
    return { ...media, src: validateVideoUrl(media.src), poster: media.poster ? validateImageUrl(media.poster) : undefined };
  }
  return { ...media, type: 'image' as const, src: validateImageUrl(media.src) };
}

const HeroSplitComponent: React.FC<HeroSplitProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'auto',
  onLoad,
  onInteraction,
}) => {
  const {
    heading,
    subheading,
    body,
    media: rawMedia,
    mediaPosition = 'right',
    splitRatio = '50-50',
    ctaButtons,
  } = content;

  const resolvedTheme = resolveTheme(theme);

  const media = useMemo(
    () => normalizeMedia(rawMedia),
    [rawMedia],
  );

  const isDataUrl = media?.src?.startsWith('data:');
  const [mediaLoaded, setMediaLoaded] = useState(
    isDataUrl || media?.type === 'video' || !media?.src,
  );
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (media?.type === 'image' && media.src && !isDataUrl) {
      const img = new window.Image();
      img.src = media.src;
      img.onload = () => {
        setMediaLoaded(true);
        onLoad?.();
      };
    } else {
      onLoad?.();
    }
  }, [media, isDataUrl, onLoad]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleCtaClick = useCallback(
    (button: CTAButton, index: number) => {
      onInteraction?.('cta-click', { label: button.label, href: button.href, index });
    },
    [onInteraction],
  );

  const handleMediaClick = useCallback(() => {
    if (media?.type === 'image' && media.src) {
      onInteraction?.('media-click', { src: media.src, alt: media.alt });
    }
  }, [media, onInteraction]);

  const gridTemplate = splitRatio === '60-40' ? 'lg:grid-cols-[3fr_2fr]' : splitRatio === '40-60' ? 'lg:grid-cols-[2fr_3fr]' : 'lg:grid-cols-2';
  const textFirst = mediaPosition === 'right';
  const sectionBackgroundClass = resolvedTheme === 'dark' || resolvedTheme === 'inverted' ? 'bg-background text-foreground' : 'bg-muted text-foreground';

  return (
    <CmsSection
      ref={sectionRef}
      container={false}
      size="md"
      theme={theme}

      data-component-id={id}
      data-component-type={type}
      className={cn('cms-hero-split relative overflow-hidden', sectionBackgroundClass, className)}
      style={style}
    >
      {/* pt-16 accounts for fixed navbar height in transparent mode */}
      <div className="relative z-10 w-full pt-16">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className={cn('grid items-center', dsSpacing.gap('xl'), 'lg:ds-gap-2xl', gridTemplate)}>
            <div className={cn('flex flex-col', dsSpacing.gap('lg'), !textFirst && 'lg:order-2', isVisible && 'animate-in fade-in duration-500')}>
              {heading && <h1 className={cmsHeading(2, resolvedTheme)}>{heading}</h1>}
              {subheading && <p className={cmsBody('lg', resolvedTheme, 'text-muted-foreground')}>{subheading}</p>}
              {body && <p className={cmsBody('md', resolvedTheme)}>{body}</p>}
              {ctaButtons && ctaButtons.length > 0 && (
                <HeroCTA buttons={ctaButtons as any} alignment="left" theme={resolvedTheme} onCtaClick={handleCtaClick as any} className="mt-6" />
              )}
            </div>
            <div className={cn('hero-split-media relative', !textFirst && 'lg:order-1', isVisible && 'animate-in fade-in duration-500 delay-150')}>
              {media?.type === 'image' && media.src && (
                <AspectRatio ratio={16 / 9} className="w-full shadow-xl">
                  <button type="button" onClick={handleMediaClick} className="absolute inset-0 h-full w-full">
                    <span className="sr-only">Focus hero media</span>
                    <Image src={media.src} alt={media.alt ?? ''} fill className={cn('rounded-xl object-cover', (media as any)?.objectFit === 'contain' && 'object-contain')} sizes="(max-width: 768px) 100vw, 50vw" onLoadingComplete={() => setMediaLoaded(true)} />
                    {!mediaLoaded && (
                      <div aria-hidden="true" className="absolute inset-0 rounded-xl bg-background/65 backdrop-blur-sm">
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-12 w-12 animate-pulse rounded-full bg-muted/70 ring-2 ring-border/60" />
                        </div>
                      </div>
                    )}
                  </button>
                </AspectRatio>
              )}
              {media?.type === 'video' && media.src && (
                <AspectRatio ratio={16 / 9} className="w-full overflow-hidden shadow-xl">
                  <video className="h-full w-full rounded-xl object-cover" controls poster={media.poster}>
                    <source src={media.src} type="video/mp4" />
                  </video>
                </AspectRatio>
              )}
            </div>
          </div>
        </div>
      </div>
    </CmsSection>
  );
};

export const HeroSplit = withPerformanceTracking(HeroSplitComponent, ComponentType.HeroSplit);
export default HeroSplit;
