'use client';

import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CmsBadge,
  CmsButtonGroup,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentCategory, ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import type {
  TestimonialSliderProps,
  Testimonial,
} from './testimonial-slider.types';

const ALLOWED_TAGS: string[] = ['b', 'i', 'em', 'strong', 'br'];
const AUTOPLAY_MIN_INTERVAL = 2000;
const MANUAL_PAUSE_DURATION = 2000;

type InteractionSource = 'next' | 'previous' | 'dot' | 'keyboard' | 'autoplay';

function sanitizeQuote(quote: Testimonial['quote']): string {
  const value = typeof quote === 'string' ? quote : String(quote ?? '');
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

function getInitials(name?: string): string {
  if (!name) {
    return '';
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export const TestimonialSlider: React.FC<TestimonialSliderProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analytics,
  onInteraction,
}) => {
  const {
    testimonials = [],
    autoPlayInterval = 5000,
    showNavigation = true,
    showDots = true,
    pauseOnHover = true,
  } = content ?? {};

  const analyticsId = analytics?.trackingId;

  const slides = React.useMemo(
    () => (Array.isArray(testimonials) ? testimonials.filter(Boolean) : []),
    [testimonials],
  );
  const totalSlides = slides.length;

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef =
    React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPauseTimeout = React.useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  }, []);

  const temporarilyPause = React.useCallback(() => {
    setIsPaused(true);
    clearPauseTimeout();
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
      pauseTimeoutRef.current = null;
    }, MANUAL_PAUSE_DURATION);
  }, [clearPauseTimeout]);

  const updateIndex = React.useCallback(
    (source: InteractionSource, resolver: (prev: number) => number) => {
      if (totalSlides <= 0) {
        return;
      }

      setCurrentIndex((prev) => {
        const rawNext = resolver(prev);
        const normalized =
          ((rawNext % totalSlides) + totalSlides) % (totalSlides || 1);

        if (normalized === prev) {
          return prev;
        }

        if (source !== 'autoplay') {
          onInteraction?.('testimonial-slide-change', {
            componentId: id,
            analyticsId,
            previousIndex: prev,
            nextIndex: normalized,
            totalSlides,
            source,
          });
        }

        return normalized;
      });
    },
    [analyticsId, id, onInteraction, totalSlides],
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
    (index: number, source: InteractionSource) => {
      updateIndex(source, () => index);
    },
    [updateIndex],
  );

  React.useEffect(() => {
    if (currentIndex >= totalSlides && totalSlides > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, totalSlides]);

  React.useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (totalSlides <= 1) {
      return;
    }

    const parsedInterval = Number(autoPlayInterval);
    const intervalMs = Number.isFinite(parsedInterval)
      ? Math.max(parsedInterval, AUTOPLAY_MIN_INTERVAL)
      : 0;

    if (!intervalMs || isPaused) {
      return;
    }

    intervalRef.current = setInterval(() => {
      goToNext('autoplay');
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoPlayInterval, goToNext, isPaused, totalSlides]);

  React.useEffect(
    () => () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearPauseTimeout();
    },
    [clearPauseTimeout],
  );

  const handleMouseEnter = React.useCallback(() => {
    if (pauseOnHover && totalSlides > 1) {
      setIsPaused(true);
    }
  }, [pauseOnHover, totalSlides]);

  const handleMouseLeave = React.useCallback(() => {
    if (pauseOnHover && totalSlides > 1) {
      setIsPaused(false);
    }
  }, [pauseOnHover, totalSlides]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (totalSlides <= 1) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        temporarilyPause();
        goToPrevious('keyboard');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        temporarilyPause();
        goToNext('keyboard');
      }
    },
    [goToNext, goToPrevious, temporarilyPause, totalSlides],
  );

  if (totalSlides === 0) {
    return null;
  }

  const currentTestimonial =
    slides[Math.min(currentIndex, totalSlides - 1)] ?? slides[0];
  if (!currentTestimonial) {
    return null;
  }

  const sanitizedQuote = sanitizeQuote(currentTestimonial.quote);
  const companyMeta = [currentTestimonial.role, currentTestimonial.company]
    .filter(Boolean)
    .join(', ');
  const avatarUrl = validateImageUrl(currentTestimonial.avatar);
  const initials = getInitials(currentTestimonial.author);
  const ratingValue = Number(currentTestimonial.rating);
  const hasRating = Number.isFinite(ratingValue);
  const QuoteIcon = resolveCmsIcon('Quote', {
    className: 'h-6 w-6 text-primary',
    fallback: '“',
  });
  const PrevIcon = resolveCmsIcon('ChevronLeft', {
    className: 'h-5 w-5',
    fallback: '←',
  });
  const NextIcon = resolveCmsIcon('ChevronRight', {
    className: 'h-5 w-5',
    fallback: '→',
  });

  const sectionClassName = cn(
    'cms-testimonial-slider relative w-full focus:outline-none',
    className,
  );

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      style={style}
      data-component-type={ComponentType.Testimonials}
      data-category={ComponentCategory.SocialProof}
      data-analytics-id={analyticsId}
      data-component-id={id}
      role="region"
      aria-label="Customer testimonials"
      aria-live="polite"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-total-slides={totalSlides}
    >
      <div className="relative mx-auto w-full max-w-4xl">
        <Card
          className={cn(CARD_TONES['minimal'], themeClass(theme), 'relative overflow-hidden shadow-sm')}
        >
          <CardContent
            className={cn(
              'flex flex-col items-center gap-2 p-[var(--component-padding)] text-center',
              dsSpacing.gap('lg'),
              dsSpacing.px('lg'),
              dsSpacing.py('2xl'),
              `sm:${dsSpacing.px('xl')}`,
              `sm:${dsSpacing.py('3xl')}`,
            )}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5"
              aria-hidden="true"
            >
              {QuoteIcon}
            </span>

            <blockquote className="w-full">
              <SafeHtml html={sanitizedQuote} className={cmsBody(
                  'lg',
                  theme,
                  'mx-auto max-w-2xl text-balance text-muted-foreground leading-relaxed',
                )} />
            </blockquote>

            <footer
              className={cn('flex flex-col items-center', dsSpacing.gap('xs'))}
            >
              <div className={cn('flex items-center rounded-xl bg-card/50 backdrop-blur-sm', dsSpacing.gap('sm'), dsSpacing.padding('md'))}>
                <Avatar className="h-12 w-12 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                  {avatarUrl ? (
                    <AvatarImage
                      src={avatarUrl}
                      alt={`${currentTestimonial.author} avatar`}
                    />
                  ) : null}
                  <AvatarFallback>
                    {initials || resolveCmsIcon('User', { fallback: '👤' })}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col items-start text-left max-w-[12rem]">
                  <span
                    className={cmsHeading(
                      5,
                      theme,
                      'text-foreground tracking-tight truncate w-full',
                    )}
                  >
                    {currentTestimonial.author}
                  </span>
                  {companyMeta ? (
                    <span
                      className={cmsBody(
                        'sm',
                        theme,
                        'text-muted-foreground transition-opacity truncate w-full',
                      )}
                    >
                      {companyMeta}
                    </span>
                  ) : null}
                </div>
              </div>

              {hasRating ? (
                <CmsBadge
                  theme={theme}
                  variant="accent"
                  className={cn(
                    'flex items-center text-sm',
                    dsSpacing.gap('xs'),
                  )}
                  aria-label={`Rated ${ratingValue.toFixed(1)} out of 5`}
                >
                  {resolveCmsIcon('Star', {
                    className: 'h-4 w-4',
                    fallback: '★',
                  })}
                  {ratingValue.toFixed(1)}
                </CmsBadge>
              ) : null}
            </footer>
          </CardContent>
        </Card>

        {showNavigation && totalSlides > 1 ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 flex w-full items-center justify-between',
              dsSpacing.px('xs'),
            )}
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="pointer-events-auto h-10 w-10 rounded-full bg-card/80 text-foreground shadow-sm transition-shadow hover:bg-card hover:shadow-md"
              aria-label="Previous testimonial"
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
              className="pointer-events-auto h-10 w-10 rounded-full bg-card/80 text-foreground shadow-sm transition-shadow hover:bg-card hover:shadow-md"
              aria-label="Next testimonial"
              onClick={() => {
                temporarilyPause();
                goToNext('next');
              }}
            >
              {NextIcon}
            </Button>
          </div>
        ) : null}
      </div>

      {showDots && totalSlides > 1 ? (
        <CmsButtonGroup
          theme={theme}
          variant={variant}
          align="center"
          responsive="sm"
          className={cn(
            'items-center justify-center',
            dsSpacing.mt('lg'),
          )}
          aria-label="Testimonial pagination"
          role="tablist"
        >
          {slides.map((testimonial, index) => {
            const isActive = index === currentIndex;
            return (
              <Button
                key={testimonial.id ?? index}
                type="button"
                variant={isActive ? 'default' : 'secondary'}
                size="sm"
                role="tab"
                aria-label={`Go to testimonial ${index + 1}`}
                aria-pressed={isActive}
                data-active={isActive ? 'true' : 'false'}
                className={cn(
                  'h-9 min-w-[2.5rem]',
                  dsSpacing.px('sm'),
                  dsSpacing.py('xxs'),
                )}
                onClick={() => {
                  temporarilyPause();
                  goToSlide(index, 'dot');
                }}
              >
                <span
                  className={cn(
                    'flex items-center text-xs font-medium',
                    dsSpacing.gap('xs'),
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
              </Button>
            );
          })}
        </CmsButtonGroup>
      ) : null}
    </CmsSection>
  );
};

const MemoizedTestimonialSlider = React.memo(TestimonialSlider);

export default withPerformanceTracking(
  MemoizedTestimonialSlider,
  ComponentType.Testimonials,
);
