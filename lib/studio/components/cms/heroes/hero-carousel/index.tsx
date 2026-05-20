'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CmsSection,
  buildCmsClassName,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentTheme, ComponentType } from '../../_core/types';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import type {
  HeroCarouselProps,
  HeroCarouselSlide,
  HeroCarouselSlideCta,
  HeroCarouselContent,
} from './hero-carousel.types';

const AUTOPLAY_DEFAULT_INTERVAL = 7000;
const AUTOPLAY_MIN_INTERVAL = 3000;
const MANUAL_PAUSE_DURATION = 4000;

const heightClasses: Record<
  NonNullable<HeroCarouselProps['content']['height']>,
  string
> = {
  small: 'min-h-[50vh] md:min-h-[60vh]',
  medium: 'min-h-[60vh] md:min-h-[80vh]',
  large: 'min-h-[75vh] md:min-h-[90vh]',
  full: 'min-h-screen',
};

const alignmentClasses: Record<
  NonNullable<HeroCarouselProps['content']['alignment']>,
  string
> = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

const CTA_VARIANT_MAP: Record<
  NonNullable<HeroCarouselSlideCta['variant']>,
  'default' | 'secondary' | 'outline'
> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
};

type InteractionSource = 'next' | 'previous' | 'dot' | 'autoplay';

interface NormalizedCta {
  href: string;
  label: string;
  variant: 'default' | 'secondary' | 'outline';
  icon?: string;
}

interface NormalizedSlide {
  id: string;
  heading?: string;
  subheading?: string;
  body?: string;
  eyebrow?: string;
  theme: ComponentTheme;
  alignment: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundImage?: string | null;
  backgroundAlt?: string;
  overlay?: {
    color?: string;
    opacity?: number;
    gradient?: string;
  };
  ctaButtons: NormalizedCta[];
  analyticsId?: string;
}

function extractImageSource(image: unknown): {
  src: string | null;
  alt?: string;
} {
  if (!image) {
    return { src: null };
  }

  if (typeof image === 'string') {
    const sanitized = validateImageUrl(image);
    return { src: sanitized || null };
  }

  if (typeof image === 'object') {
    const img = image as Record<string, any>;
    const candidateStrings: Array<string | undefined> = [
      typeof img.src === 'string' ? img.src : undefined,
      // Handle nested media object: image.src = { src: "url", mediaId, ... }
      typeof img?.src?.src === 'string' ? img.src.src : undefined,
      typeof img.originalUrl === 'string' ? img.originalUrl : undefined,
      typeof img.url === 'string' ? img.url : undefined,
      typeof img?.src?.originalUrl === 'string' ? img.src.originalUrl : undefined,
      typeof img?.src?.url === 'string' ? img.src.url : undefined,
    ];

    const rawSource = candidateStrings.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );

    const sanitized = rawSource ? validateImageUrl(rawSource) : '';
    const altText = typeof img.alt === 'string' && img.alt.trim().length > 0
      ? img.alt
      : undefined;

    return {
      src: sanitized && sanitized.trim().length > 0 ? sanitized : null,
      alt: altText,
    };
  }

  return { src: null };
}

function normalizeCta(button: HeroCarouselSlideCta | null | undefined): NormalizedCta | null {
  if (!button || typeof button !== 'object') {
    return null;
  }

  const href =
    (typeof button.href === 'string' && button.href.trim().length > 0
      ? button.href
      : undefined);

  if (!href) {
    return null;
  }

  const rawLabel =
    (typeof button.label === 'string' && button.label.trim().length > 0
      ? button.label
      : undefined);

  const label = rawLabel ?? 'Learn more';
  const variantKey = button.variant ?? 'primary';
  const variant =
    CTA_VARIANT_MAP[variantKey] ?? CTA_VARIANT_MAP.primary;

  const icon = typeof button.icon === 'string' ? button.icon : undefined;

  return {
    href,
    label,
    variant,
    icon,
  };
}

function normalizeSlides(
  rawSlides: HeroCarouselSlide[] | undefined,
  fallbackTheme: ComponentTheme,
  fallbackAlignment: 'left' | 'center' | 'right',
): NormalizedSlide[] {
  if (!Array.isArray(rawSlides)) {
    return [];
  }

  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
  const structuralKeys = new Set([
    'content',
    'id',
    'type',
    'componentType',
    'componentId',
    'component_id',
  ]);

  return rawSlides
    .map((rawSlide, index) => {
      if (!rawSlide || typeof rawSlide !== 'object') {
        return null;
      }

      const base = rawSlide as HeroCarouselSlide & Record<string, unknown>;
      const contentRecord =
        base.content && typeof base.content === 'object'
          ? (base.content as Record<string, unknown>)
          : {};

      const baseRecord = base as Record<string, unknown>;
      const source = Object.entries(baseRecord).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          if (structuralKeys.has(key)) {
            return acc;
          }
          acc[key] = value;
          return acc;
        },
        { ...contentRecord },
      );

      const rawId = base.id;
      const id = isNonEmptyString(rawId)
        ? rawId
        : `hero-carousel-slide-${index + 1}`;

      const getString = (value: unknown): string | undefined =>
        isNonEmptyString(value) ? value : undefined;

      const heading =
        getString(source['heading']) ??
        getString(source['title']);
      const subheading = getString(source['subheading']);
      const body =
        getString(source['body']) ??
        getString(source['summary']) ??
        getString(source['description']);
      const eyebrow =
        getString(source['eyebrow']) ??
        getString(source['kicker']);

      const alignment =
        (source['alignment'] as NormalizedSlide['alignment']) ?? fallbackAlignment;
      const slideTheme =
        (source['theme'] as NormalizedSlide['theme']) ?? fallbackTheme;
      const resolvedSlideTheme: ComponentTheme =
        slideTheme && slideTheme !== 'auto'
          ? slideTheme
          : fallbackTheme;
      const { src, alt } = extractImageSource(source['image']);
      const rawCtas = Array.isArray(source['ctaButtons'])
        ? (source['ctaButtons'] as Array<HeroCarouselSlideCta | null | undefined>)
        : [];
      const normalizedCtas = rawCtas
        .map(normalizeCta)
        .filter((cta): cta is NormalizedCta => Boolean(cta));

      const overlaySource = source['overlay'];
      const overlay =
        overlaySource && typeof overlaySource === 'object'
          ? {
              color:
                getString(
                  (overlaySource as Record<string, unknown>).color,
                ),
              opacity:
                typeof (overlaySource as Record<string, unknown>).opacity === 'number'
                  ? Math.min(
                      Math.max(
                        (overlaySource as Record<string, unknown>).opacity as number,
                        0,
                      ),
                      1,
                    )
                  : undefined,
              gradient:
                getString(
                  (overlaySource as Record<string, unknown>).gradient,
                ),
            }
          : undefined;

      const backgroundColor = getString(source['backgroundColor']);
      const analyticsIdFromSource = getString(source['analyticsId']);
      const analyticsId =
        analyticsIdFromSource ??
        (isNonEmptyString(base.analyticsId) ? base.analyticsId : undefined);

      const normalized: NormalizedSlide = {
        id,
        theme: resolvedSlideTheme,
        alignment: alignment ?? fallbackAlignment,
        ctaButtons: normalizedCtas,
      };

      if (heading) {
        normalized.heading = heading;
      }

      if (subheading) {
        normalized.subheading = subheading;
      }

      if (body) {
        normalized.body = body;
      }

      if (eyebrow) {
        normalized.eyebrow = eyebrow;
      }

      if (backgroundColor) {
        normalized.backgroundColor = backgroundColor;
      }

      if (src) {
        normalized.backgroundImage = src;
      }

      if (alt) {
        normalized.backgroundAlt = alt;
      } else if (heading || subheading || body) {
        normalized.backgroundAlt = heading ?? subheading ?? body;
      }

      if (
        overlay &&
        (overlay.color || overlay.opacity !== undefined || overlay.gradient)
      ) {
        normalized.overlay = overlay;
      } else if (src) {
        // P0 Fix: Add default overlay for text readability when background image exists
        normalized.overlay = {
          color: 'rgba(0, 0, 0, 0.50)',
          opacity: 1,
        };
      }

      if (analyticsId) {
        normalized.analyticsId = analyticsId;
      }

      return normalized;
    })
    .filter((slide): slide is NormalizedSlide => Boolean(slide));
}

const HeroCarouselComponent: React.FC<HeroCarouselProps> = ({
  id,
  type,
  content,
  className,
  style,
  theme = 'dark',
  variant = 'default',
  analyticsId,
  onLoad,
  onInteraction,
}) => {
  const {
    slides: rawSlides,
    autoPlay = true,
    autoPlayInterval,
    pauseOnHover = true,
    showIndicators = true,
    showControls = false,
    loop = true,
    height = 'full',
    alignment: defaultAlignment = 'center',
    indicatorStyle = 'dots',
    transitionStyle = 'fade',
    theme: contentTheme,
  } = content ?? {};

  const rawContainerTheme = (contentTheme ?? theme ?? 'dark') as ComponentTheme;
  const resolvedTheme: ComponentTheme =
    rawContainerTheme && rawContainerTheme !== 'auto'
      ? rawContainerTheme
      : 'dark';

  const slides = React.useMemo(
    () => normalizeSlides(rawSlides, resolvedTheme, defaultAlignment),
    [rawSlides, resolvedTheme, defaultAlignment],
  );

  const totalSlides = slides.length;
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isHovering, setIsHovering] = React.useState(false);
  const [manualPause, setManualPause] = React.useState(false);

  const pauseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const shouldPause = (pauseOnHover && isHovering) || manualPause;

  const updateIndex = React.useCallback(
    (source: InteractionSource, resolver: (previous: number) => number) => {
      if (totalSlides === 0) {
        return;
      }

      setCurrentIndex((previous) => {
        const rawNext = resolver(previous);
        const bounded = loop
          ? ((rawNext % totalSlides) + totalSlides) % totalSlides
          : Math.min(Math.max(rawNext, 0), totalSlides - 1);

        if (bounded === previous) {
          return previous;
        }

        onInteraction?.('hero-carousel-slide-change', {
          componentId: id,
          analyticsId,
          previousIndex: previous,
          nextIndex: bounded,
          totalSlides,
          source,
        });

        return bounded;
      });
    },
    [analyticsId, id, loop, onInteraction, totalSlides],
  );

  const goToNext = React.useCallback(
    (source: InteractionSource) => {
      updateIndex(source, (prev) => prev + 1);
    },
    [updateIndex],
  );

  const goToPrevious = React.useCallback(
    (source: InteractionSource) => {
      updateIndex(source, (prev) => prev - 1);
    },
    [updateIndex],
  );

  const goToSlide = React.useCallback(
    (index: number) => {
      updateIndex('dot', () => index);
    },
    [updateIndex],
  );

  const temporarilyPause = React.useCallback(() => {
    setManualPause(true);
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = setTimeout(() => {
      setManualPause(false);
      pauseTimeoutRef.current = null;
    }, MANUAL_PAUSE_DURATION);
  }, []);

  React.useEffect(() => {
    if (totalSlides > 0) {
      onLoad?.();
    }
  }, [totalSlides, onLoad]);

  React.useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalSlides]);

  React.useEffect(() => {
    if (!autoPlay || totalSlides <= 1 || shouldPause) {
      return;
    }

    if (!loop && currentIndex >= totalSlides - 1) {
      return;
    }

    const parsedInterval = Number(autoPlayInterval);
    const intervalDuration = Number.isFinite(parsedInterval) && parsedInterval > 0
      ? Math.max(parsedInterval, AUTOPLAY_MIN_INTERVAL)
      : AUTOPLAY_DEFAULT_INTERVAL;

    const timer = setInterval(() => {
      goToNext('autoplay');
    }, intervalDuration);

    return () => {
      clearInterval(timer);
    };
  }, [
    autoPlay,
    autoPlayInterval,
    currentIndex,
    goToNext,
    loop,
    shouldPause,
    totalSlides,
  ]);

  React.useEffect(
    () => () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    },
    [],
  );

  const handleMouseEnter = React.useCallback(() => {
    if (!pauseOnHover) {
      return;
    }
    setIsHovering(true);
  }, [pauseOnHover]);

  const handleMouseLeave = React.useCallback(() => {
    if (!pauseOnHover) {
      return;
    }
    setIsHovering(false);
  }, [pauseOnHover]);

  if (totalSlides === 0) {
    return (
      <CmsSection
        size="md"
        data-component-id={id}
        data-component-type={type}
        theme={resolvedTheme}
        variant={variant}
        className={buildCmsClassName({
          base: 'cms-hero-carousel cms-carousel-empty',
          className,
        })}
        containerClassName="rounded-xl border border-dashed border-border/50 bg-muted/40 p-6 text-sm text-muted-foreground backdrop-blur-sm"
        style={style}
      >
        No hero slides are available for this carousel.
      </CmsSection>
    );
  }

  const PrevIcon = resolveCmsIcon('ChevronLeft', {
    className: 'h-5 w-5',
    fallback: '←',
  });
  const NextIcon = resolveCmsIcon('ChevronRight', {
    className: 'h-5 w-5',
    fallback: '→',
  });

  const sectionClassName = buildCmsClassName({
    base: cn(
      'cms-hero-carousel relative isolate flex w-full overflow-hidden',
      heightClasses[height],
    ),
    theme: resolvedTheme,
    variant,
    className,
    includeVariant: true,
  });

  // Use explicit responsive classes instead of interpolation (Tailwind JIT requires full class names)
  const containerPadding = 'px-4 sm:px-6 lg:px-8';

  const slideContainerClass = cn(
    'mx-auto flex w-full flex-1 max-w-7xl',
    containerPadding,
    'py-6 md:py-12',
  );

  return (
    <CmsSection
      container={false}
      data-component-id={id}
      data-component-type={type}
      className={sectionClassName}
      theme={resolvedTheme}
      variant={variant}
      size="none"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-roledescription="carousel"
      aria-live="polite"
    >
      <div className="absolute inset-0">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const transitionClass =
            transitionStyle === 'slide'
              ? 'translate-x-0 opacity-100'
              : 'opacity-100';

          // Fallback background color when no image or explicit color
          const fallbackBg = slide.backgroundColor || (slide.backgroundImage ? undefined : 'hsl(var(--muted))');
          const overlayOpacity = slide.overlay?.opacity ?? 0.6;

          return (
            <article
              key={slide.id}
              className={cn(
                'cms-hero-carousel-slide absolute inset-0 flex h-full w-full flex-col',
                transitionStyle === 'slide'
                  ? 'transform-gpu transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]'
                  : 'transition-opacity duration-700 ease-out',
                isActive
                  ? transitionClass
                  : transitionStyle === 'slide'
                    ? 'pointer-events-none translate-x-full opacity-0'
                    : 'pointer-events-none opacity-0',
                !slide.backgroundImage && !slide.backgroundColor && 'bg-muted',
              )}
              data-active={isActive}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${totalSlides}`}
              aria-hidden={isActive ? undefined : true}
              style={{
                backgroundColor: fallbackBg,
              }}
            >
              {slide.backgroundImage && (
                <div className="absolute inset-0">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${slide.backgroundImage}")`,
                    }}
                    aria-hidden="true"
                  />
                  <img
                    src={slide.backgroundImage}
                    alt={slide.backgroundAlt ?? ''}
                    className="sr-only"
                    loading="eager"
                  />
                </div>
              )}

              {slide.overlay && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: slide.overlay.color,
                    opacity: overlayOpacity,
                    background: slide.overlay.gradient ?? undefined,
                  }}
                  aria-hidden="true"
                />
              )}

              {/* pt-16 accounts for fixed navbar height in transparent mode */}
              <div className="relative z-10 flex h-full w-full items-center pt-16">
                <div className={slideContainerClass}>
                  {/* Left-aligned card overlay using design system tokens */}
                  <div
                    className={cn(
                      'flex w-full max-w-xl flex-col justify-center relative',
                      'bg-primary rounded-2xl p-8',
                      dsSpacing.gap('md'),
                      'items-start text-left',
                    )}
                  >
                    {slide.eyebrow ? (
                      <p
                        className="text-sm uppercase tracking-[0.2em] text-primary-foreground/80 font-bold"
                      >
                        {slide.eyebrow}
                      </p>
                    ) : null}

                    {slide.heading ? (
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground leading-tight text-balance">
                        {slide.heading}
                      </h1>
                    ) : null}

                    {slide.subheading ? (
                      <p className="text-base sm:text-lg text-primary-foreground/90 font-light leading-relaxed">
                        {slide.subheading}
                      </p>
                    ) : null}

                    {slide.body ? (
                      <p className="text-sm sm:text-base text-primary-foreground/90 max-w-xl">
                        {slide.body}
                      </p>
                    ) : null}

                    {slide.ctaButtons.length > 0 ? (
                      <div
                        className={cn(
                          'flex flex-wrap',
                          dsSpacing.gap('sm'),
                          dsSpacing.mt('sm'),
                        )}
                      >
                        {slide.ctaButtons.map((cta, ctaIndex) => (
                          <Button
                            key={`${cta.href}-${ctaIndex}`}
                            asChild
                            variant="secondary"
                            size="lg"
                            className="shadow-md transition-shadow hover:shadow-lg font-semibold"
                            onClick={() => {
                              onInteraction?.('hero-carousel-cta', {
                                componentId: id,
                                analyticsId: analyticsId ?? slide.analyticsId,
                                slideIndex: index,
                                label: cta.label,
                                href: cta.href,
                              });
                            }}
                          >
                            <a href={cta.href}>
                              {cta.icon ? (
                                <span className={cn(dsSpacing.mr('xs'))} aria-hidden="true">
                                  {cta.icon}
                                </span>
                              ) : null}
                              <span>{cta.label}</span>
                            </a>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {false && showControls && totalSlides > 1 ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 z-30 flex w-full items-center justify-between',
            containerPadding,
          )}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="pointer-events-auto h-12 w-12 rounded-full bg-background/70 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90 hover:shadow-xl transition-[background-color,box-shadow]"
            aria-label="Previous slide"
            onClick={() => {
              temporarilyPause();
              goToPrevious('previous');
            }}
          >
            {PrevIcon}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="pointer-events-auto h-12 w-12 rounded-full bg-background/70 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-background/90 hover:shadow-xl transition-[background-color,box-shadow]"
            aria-label="Next slide"
            onClick={() => {
              temporarilyPause();
              goToNext('next');
            }}
          >
            {NextIcon}
          </Button>
        </div>
      ) : null}

      {showIndicators && totalSlides > 1 ? (
        <div
          className={cn(
            'pointer-events-none absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2',
            dsSpacing.gap('sm'),
          )}
        >
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            const baseClasses =
              indicatorStyle === 'bars'
                ? 'h-2 w-10 rounded-full'
                : 'h-3 w-3 rounded-full';
            return (
              <button
                key={slide.id}
                type="button"
                className={cn(
                  'pointer-events-auto transition-colors duration-200',
                  baseClasses,
                  isActive
                    ? 'bg-white'
                    : 'bg-white/50 hover:bg-white/75',
                )}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => {
                  temporarilyPause();
                  goToSlide(index);
                }}
              />
            );
          })}
        </div>
      ) : null}
    </CmsSection>
  );
};

export const HeroCarousel = withPerformanceTracking(
  HeroCarouselComponent,
  ComponentType.HeroCarousel,
);

export default HeroCarousel;
export type {
  HeroCarouselProps,
  HeroCarouselContent,
  HeroCarouselSlide,
} from './hero-carousel.types';
