'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as Icons from 'lucide-react';

import { cn } from '@/lib/utils';

import { TimelineProps, TimelineEvent, TimelineAction } from './timeline.types';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';
import {
  sanitizeText,
  validateUrl,
} from '@/lib/studio/components/cms/_core/security';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { normalizeCmsImage } from '@/lib/studio/components/cms/_utils/media-reference';
import { isSafeSmartLinkHref, resolveSmartLinkHref } from '@/lib/studio/components/cms/_utils/smart-link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CmsBadge,
  CmsBadgeVariant,
  CARD_TONES,
  themeClass,
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
} from '../../_ui';

type EventType = NonNullable<TimelineEvent['type']>;
type ResolvedTimelineAction = {
  text: string;
  href: string;
  variant?: TimelineAction['variant'];
};
type ResolvedTimelineLink = {
  text: string;
  href: string;
};

const BASE_INDICATOR_CLASS =
  'cms-timeline-indicator flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm';

const TIMELINE_ICON_COMPONENTS = Icons as unknown as Record<
  string,
  React.ComponentType<{ className?: string }>
>;

const EVENT_INDICATOR_ENHANCEMENTS: Record<EventType, string> = {
  milestone:
    'border-primary bg-primary/15 text-primary shadow-sm',
  achievement:
    'border-success bg-success/15 text-success shadow-sm',
  event:
    'border-blue-500 bg-blue-500/15 text-blue-500 shadow-sm',
  default: '',
};

const EVENT_BADGE_VARIANTS: Record<EventType, CmsBadgeVariant> = {
  milestone: 'accent',
  achievement: 'positive',
  event: 'neutral',
  default: 'neutral',
};

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  milestone: 'Milestone',
  achievement: 'Achievement',
  event: 'Event',
  default: 'Update',
};

function isSafeTimelineHref(href: string): boolean {
  return isSafeSmartLinkHref(href) || validateUrl(href.trim());
}

function getIndicatorClass(type?: TimelineEvent['type']): string {
  if (!type) {
    return BASE_INDICATOR_CLASS;
  }

  return cn(BASE_INDICATOR_CLASS, EVENT_INDICATOR_ENHANCEMENTS[type] ?? '');
}

function getBadgeVariant(type?: TimelineEvent['type']): CmsBadgeVariant {
  if (!type) {
    return EVENT_BADGE_VARIANTS.default;
  }

  return EVENT_BADGE_VARIANTS[type] ?? EVENT_BADGE_VARIANTS.default;
}

function getTypeLabel(type?: TimelineEvent['type']): string | null {
  if (!type) {
    return null;
  }

  return EVENT_TYPE_LABELS[type] ?? EVENT_TYPE_LABELS.default;
}

function getTimelineActionHref(action: unknown): string | undefined {
  if (!action || typeof action !== 'object') {
    return undefined;
  }

  const record = action as Record<string, unknown>;
  const href = resolveSmartLinkHref(record.href);
  if (href && isSafeTimelineHref(href)) {
    return href;
  }

  if (typeof record.url === 'string') {
    const url = record.url.trim();
    return isSafeTimelineHref(url) ? url : undefined;
  }

  const url = resolveSmartLinkHref(record.url);
  return url && isSafeTimelineHref(url) ? url : undefined;
}

function getTimelineActionText(action: unknown): string | undefined {
  if (!action || typeof action !== 'object') {
    return undefined;
  }

  const record = action as Record<string, unknown>;
  return typeof record.text === 'string'
    ? record.text
    : typeof record.label === 'string'
      ? record.label
      : undefined;
}

function resolveTimelineAction(action: unknown): ResolvedTimelineAction | null {
  const href = getTimelineActionHref(action);
  const text = getTimelineActionText(action);

  if (!href || !text) {
    return null;
  }

  const variant =
    action && typeof action === 'object'
      ? (action as { variant?: TimelineAction['variant'] }).variant
      : undefined;

  return { text, href, variant };
}

function resolveTimelineLink(link: unknown): ResolvedTimelineLink | null {
  const href = getTimelineActionHref(link);
  const text = getTimelineActionText(link);

  return href && text ? { text, href } : null;
}

function renderIcon(
  iconName: TimelineEvent['icon'],
  type: TimelineEvent['type'],
  showIcons: boolean,
): React.ReactNode {
  if (!showIcons) {
    return null;
  }

  if (typeof iconName === 'function') {
    const CustomIcon = iconName;
    return <CustomIcon aria-hidden="true" className="h-5 w-5" />;
  }

  if (typeof iconName === 'string' && iconName.length > 0) {
    const LucideIcon = TIMELINE_ICON_COMPONENTS[iconName];

    if (LucideIcon) {
      return <LucideIcon aria-hidden="true" className="h-5 w-5" />;
    }

    // Fallback for emoji or raw strings
    if (iconName.length <= 3) {
      return (
        <span aria-hidden="true" className="text-xl leading-none">
          {sanitizeText(iconName)}
        </span>
      );
    }
  }

  switch (type) {
    case 'milestone':
      return <Icons.Flag aria-hidden="true" className="h-5 w-5" />;
    case 'achievement':
      return <Icons.Trophy aria-hidden="true" className="h-5 w-5" />;
    case 'event':
      return <Icons.Calendar aria-hidden="true" className="h-5 w-5" />;
    default:
      return <Icons.Circle aria-hidden="true" className="h-5 w-5" />;
  }
}

const TimelineComponent: React.FC<TimelineProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const {
    title,
    subtitle,
    events = [],
    layout = 'vertical',
    showConnectors = true,
    dateFormat = 'MMM DD, YYYY',
    showIcons = true,
    animated = true,
  } = content;

  const timelineEvents = Array.isArray(events) ? events : [];
  const sectionFooterCta = resolveTimelineAction(content.footerCta);

  const [visibleEvents, setVisibleEvents] = useState<Set<string>>(new Set());
  const eventRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!animated) {
      setVisibleEvents(new Set(timelineEvents.map((event) => event.id)));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const eventId = entry.target.getAttribute('data-event-id');
            if (eventId) {
              setVisibleEvents((previous) => new Set([...previous, eventId]));
            }
          }
        });
      },
      { threshold: 0.1 },
    );

    eventRefs.current.forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => observer.disconnect();
  }, [animated, timelineEvents]);

  const formatDate = (date: Date | string): string => {
    const dateObject = typeof date === 'string' ? new Date(date) : date;

    if (Number.isNaN(dateObject.getTime())) {
      return sanitizeText(String(date));
    }

    if (dateFormat && Intl.DateTimeFormat.supportedLocalesOf(['en']).length) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      return formatter.format(dateObject);
    }

    return dateObject.toDateString();
  };

  const resolvedTheme = resolveTheme(theme);

  // Memoize theme class to avoid recalculating on every render
  const resolvedThemeClass = useMemo(() => themeClass(resolvedTheme), [resolvedTheme]);
  const sectionClassName = cn('cms-timeline', className);
  const sectionContainerClassName = cn('items-stretch', dsSpacing.gap('lg'));

  const openLink = (url: string) => {
    if (typeof window === 'undefined' || !url) {
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderEventActions = (event: TimelineEvent, className?: string) => {
    const actionButtons = Array.isArray(event.actions)
      ? event.actions
          .map(resolveTimelineAction)
          .filter((action): action is ResolvedTimelineAction => Boolean(action))
      : [];

    if (actionButtons.length > 0) {
      return (
        <div className={cn('flex flex-wrap gap-2 pt-2', className)}>
          {actionButtons.map((action, index) => (
            <Button
              key={`${event.id}-action-${index}`}
              type="button"
              variant={action.variant === 'accent' ? 'default' : action.variant === 'neutral' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => openLink(action.href)}
            >
              {sanitizeText(action.text)}
            </Button>
          ))}
        </div>
      );
    }

    const eventLink = resolveTimelineLink(event.link);

    if (eventLink) {
      return (
        <Button
          type="button"
          variant="link"
          size="sm"
          className={cn('px-0', className)}
          onClick={() => openLink(eventLink.href)}
        >
          {sanitizeText(eventLink.text)}
        </Button>
      );
    }

    return null;
  };

  const renderEventCard = (event: TimelineEvent) => {
    const badgeLabel = getTypeLabel(event.type);

    return (
      <>
        {showIcons && (
          <div
            className={cn(getIndicatorClass(event.type), 'h-16 w-16')}
            aria-hidden="true"
          >
            {renderIcon(event.icon, event.type, showIcons)}
          </div>
        )}

        <div className="flex-1 pb-8">
          <p className={cn(
            cmsBody('sm', resolvedTheme, 'mb-2 text-muted-foreground'),
            'transition-colors duration-200 group-hover:text-foreground'
          )}>
            {formatDate(event.date)}
          </p>

          {variant === 'compact' ? (
            <div className="space-y-2">
              {badgeLabel && (
                <CmsBadge
                  variant={getBadgeVariant(event.type)}
                  theme={resolvedTheme}
                  className="w-fit uppercase tracking-wide"
                >
                  {badgeLabel}
                </CmsBadge>
              )}

              <h3 className={cmsHeading(4, resolvedTheme)}>
                {sanitizeText(event.title)}
              </h3>

              {event.description && (
                <p className={cmsBody('sm', resolvedTheme)}>
                  {sanitizeText(event.description)}
                </p>
              )}
              {renderEventActions(event)}
            </div>
          ) : (
            <Card
              className={cn(
                'cms-timeline-card p-4 transition-colors duration-300',
                CARD_TONES['minimal'],
                resolvedThemeClass,
                'hover:border-border'
              )}
            >
              <div className="space-y-3">
                {badgeLabel && (
                  <CmsBadge
                    variant={getBadgeVariant(event.type)}
                    theme={resolvedTheme}
                    className="w-fit uppercase tracking-wide"
                  >
                    {badgeLabel}
                  </CmsBadge>
                )}

                <h3 className={cmsHeading(4, resolvedTheme)}>
                  {sanitizeText(event.title)}
                </h3>

                {event.description && (
                  <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
                    {sanitizeText(event.description)}
                  </p>
                )}

                {(() => {
                  const image = normalizeCmsImage(event.image, event.title);
                  return image ? (
                  // Explicit dimensions prevent layout shift (CLS). CSS handles actual sizing.
                  // object-cover maintains aspect ratio, cropping to fill container.
                  <img
                    src={image.src}
                    alt={sanitizeText(image.alt ?? event.title)}
                    width={640}
                    height={360}
                    className="w-full max-w-md rounded-lg border border-border/60 object-cover"
                    loading="lazy"
                  />
                  ) : null;
                })()}

                {renderEventActions(event)}
              </div>
            </Card>
          )}
        </div>
      </>
    );
  };

  const renderVerticalTimeline = () => (
    <div className="relative">
      {showConnectors && (
        <div
          aria-hidden="true"
          data-testid="cms-timeline-vertical-connector"
          className={cn(
            'absolute left-8 top-0 bottom-0 w-px',
            'bg-gradient-to-b from-border-default/50 via-border-default to-border-default/50'
          )}
        />
      )}
      <div className="space-y-8">
        {timelineEvents.map((event) => {
          const isVisible = visibleEvents.has(event.id);

          return (
            <div
              key={event.id}
              ref={(element) => {
                if (element) {
                  eventRefs.current.set(event.id, element);
                }
              }}
              data-event-id={event.id}
              className={cn(
                'relative flex gap-4 group',
                animated && 'transition-[transform,opacity] duration-500',
                animated && !isVisible && 'translate-x-4 opacity-0',
                animated && isVisible && 'translate-x-0 opacity-100',
              )}
            >
              {renderEventCard(event)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAlternatingTimeline = () => (
    <div className="relative">
      {showConnectors && (
        <div
          aria-hidden="true"
          data-testid="cms-timeline-alternating-connector"
          className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 transform bg-border"
        />
      )}
      <div className="space-y-12">
        {timelineEvents.map((event, index) => {
          const isLeft = index % 2 === 0;
          const isVisible = visibleEvents.has(event.id);
          const badgeLabel = getTypeLabel(event.type);

          return (
            <div
              key={event.id}
              ref={(element) => {
                if (element) {
                  eventRefs.current.set(event.id, element);
                }
              }}
              data-event-id={event.id}
              className={cn(
                'relative flex items-center',
                animated && 'transition-[transform,opacity] duration-500',
                animated && !isVisible && 'opacity-0',
                animated &&
                  !isVisible &&
                  (isLeft ? '-translate-x-8' : 'translate-x-8'),
                animated && isVisible && 'translate-x-0 opacity-100',
              )}
            >
              <div
                className={cn(
                  'w-1/2',
                  isLeft ? 'pr-8 text-right' : 'ml-auto pl-8 text-left',
                )}
              >
                <p className={cmsBody('sm', resolvedTheme, 'mb-2 text-muted-foreground')}>
                  {formatDate(event.date)}
                </p>

                <Card
                  className={cn(
                    'inline-block p-4 text-left',
                    CARD_TONES['minimal'],
                    resolvedThemeClass,
                    'hover:border-border',
                    isLeft && 'text-left',
                  )}
                >
                  <div className="space-y-3">
                    {badgeLabel && (
                      <CmsBadge
                        variant={getBadgeVariant(event.type)}
                        theme={resolvedTheme}
                        className="w-fit uppercase tracking-wide"
                      >
                        {badgeLabel}
                      </CmsBadge>
                    )}

                    <h3 className={cmsHeading(4, resolvedTheme)}>
                      {sanitizeText(event.title)}
                    </h3>

                    {event.description && (
                  <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
                    {sanitizeText(event.description)}
                  </p>
                    )}

                    {renderEventActions(event, isLeft ? 'justify-end' : 'justify-start')}
                  </div>
                </Card>
              </div>

              {showIcons && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 transform',
                    getIndicatorClass(event.type),
                    'h-12 w-12',
                  )}
                >
                  {renderIcon(event.icon, event.type, showIcons)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderHorizontalTimeline = () => (
    <div className="overflow-x-auto pb-4 md:overflow-visible">
      <div className="relative min-w-max md:min-w-0">
        {showConnectors && (
          <div
            aria-hidden="true"
            data-testid="cms-timeline-horizontal-connector"
            className="absolute left-0 right-0 top-8 h-px bg-border md:hidden"
          />
        )}
        <div className="flex gap-8 md:mx-auto md:max-w-5xl md:flex-wrap md:justify-center md:gap-10 md:px-4">
          {timelineEvents.map((event) => {
            const isVisible = visibleEvents.has(event.id);

            return (
              <div
                key={event.id}
                ref={(element) => {
                  if (element) {
                    eventRefs.current.set(event.id, element);
                  }
                }}
                data-event-id={event.id}
                className={cn(
                  'flex w-64 flex-col items-center',
                  animated && 'transition-[transform,opacity] duration-500',
                  animated && !isVisible && 'translate-y-4 opacity-0',
                  animated && isVisible && 'translate-y-0 opacity-100',
                  'md:w-[min(18rem,45%)] md:flex-1 md:items-stretch',
                )}
              >
                {showIcons && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      getIndicatorClass(event.type),
                      'mb-4 h-16 w-16 md:mx-auto',
                    )}
                  >
                    {renderIcon(event.icon, event.type, showIcons)}
                  </div>
                )}

                <p className={cmsBody('sm', resolvedTheme, 'mb-2 text-muted-foreground')}>
                  {formatDate(event.date)}
                </p>

                <Card
                  className={cn(
                    'w-full p-4 text-center md:text-left',
                    CARD_TONES['minimal'],
                    resolvedThemeClass,
                    'hover:border-border'
                  )}
                >
                  <div className="space-y-3">
                    {getTypeLabel(event.type) && (
                      <CmsBadge
                        variant={getBadgeVariant(event.type)}
                        theme={resolvedTheme}
                        className="mx-auto w-fit uppercase tracking-wide md:ml-0 md:mr-auto"
                      >
                        {getTypeLabel(event.type)}
                      </CmsBadge>
                    )}

                    <h3 className={cmsHeading(4, resolvedTheme)}>
                      {sanitizeText(event.title)}
                    </h3>

                    {event.description && (
                      <p className={cmsBody('sm', resolvedTheme)}>
                        {sanitizeText(event.description)}
                      </p>
                    )}

                    {renderEventActions(event, 'md:justify-start')}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
  const renderBalancedTimeline = () => (
    <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
      <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
        {timelineEvents.map((event) => {
          const isVisible = visibleEvents.has(event.id);

          return (
            <div
              key={event.id}
              ref={(element) => {
                if (element) {
                  eventRefs.current.set(event.id, element);
                }
              }}
              data-event-id={event.id}
              className={cn(
                'flex h-full flex-col gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm',
                animated && 'transition-[transform,opacity] duration-500',
                animated && !isVisible && 'translate-y-6 opacity-0',
                animated && isVisible && 'translate-y-0 opacity-100',
              )}
            >
              {showIcons && (
                <div
                  aria-hidden="true"
                  className={cn(
                    getIndicatorClass(event.type),
                    'h-12 w-12',
                  )}
                >
                  {renderIcon(event.icon, event.type, showIcons)}
                </div>
              )}
              <div className="space-y-2">
                <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
                  {formatDate(event.date)}
                </p>
                {getTypeLabel(event.type) ? (
                  <CmsBadge
                    variant={getBadgeVariant(event.type)}
                    theme={resolvedTheme}
                    className="w-fit uppercase tracking-wide"
                  >
                    {getTypeLabel(event.type)}
                  </CmsBadge>
                ) : null}
              </div>
              <h3 className={cmsHeading(4, resolvedTheme)}>
                {sanitizeText(event.title)}
              </h3>
              {event.description ? (
                <p className={cmsBody('sm', resolvedTheme)}>
                  {sanitizeText(event.description)}
                </p>
              ) : null}
              {renderEventActions(event)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderProgressTimeline = () => {
    if (timelineEvents.length === 0) {
      return null
    }

    return (
      <Card
        className={cn(
          'cms-timeline-progress border border-border/60 bg-card px-6 py-10 shadow-sm',
          CARD_TONES['minimal'],
          resolvedThemeClass
        )}
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-6 right-6 top-10 hidden h-0.5 bg-border/50 md:block"
          />
          <ol className="relative flex flex-col gap-8 md:flex-row md:items-stretch md:gap-6">
            {timelineEvents.map((event, index) => {
              const isVisible = visibleEvents.has(event.id)
              const badgeLabel = getTypeLabel(event.type)
              const description = event.description ? sanitizeText(event.description) : null
              const formattedDate = event.date ? formatDate(event.date) : null

              return (
                <li
                  key={event.id}
                  ref={element => {
                    if (element) {
                      eventRefs.current.set(event.id, element)
                    }
                  }}
                  data-event-id={event.id}
                  data-testid="cms-timeline-progress-step"
                  className={cn(
                    'relative flex-1 rounded-2xl border border-border/40 bg-card px-3 pb-6 pt-4 md:px-4 md:pb-4',
                    animated && 'transition-[transform,opacity] duration-500',
                    animated && !isVisible && 'translate-y-6 opacity-0',
                    animated && isVisible && 'translate-y-0 opacity-100'
                  )}
                >
                  {index < timelineEvents.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-full block h-8 w-px -translate-x-1/2 bg-border/40 md:hidden"
                    />
                  ) : null}
                  <div className="flex flex-col items-center text-center md:items-start md:text-left">
                    <div
                      aria-hidden="true"
                      className={cn(
                        getIndicatorClass(event.type),
                        'h-12 w-12 text-lg font-semibold text-foreground'
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className={cn('mt-4 space-y-2', dsSpacing.spaceY('xs'))}>
                      {badgeLabel ? (
                        <CmsBadge
                          variant={getBadgeVariant(event.type)}
                          theme={resolvedTheme}
                          className="w-fit uppercase tracking-wide"
                        >
                          {badgeLabel}
                        </CmsBadge>
                      ) : null}
                      <h3 className={cmsHeading(4, resolvedTheme)}>{sanitizeText(event.title)}</h3>
                      {formattedDate ? (
                        <p className={cmsBody('xs', resolvedTheme, 'text-muted-foreground uppercase tracking-wide')}>
                          {formattedDate}
                        </p>
                      ) : null}
                      {description ? (
                        <p className={cmsBody('sm', resolvedTheme)}>{description}</p>
                      ) : null}
                    </div>
                  </div>
                  {renderEventActions(event, 'justify-center md:justify-start')}
                </li>
              )
            })}
          </ol>
        </div>
      </Card>
    )
  }

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      containerClassName={sectionContainerClassName}
    >
      {(title || subtitle) && (
        <div
          className={cn(
            'mx-auto flex max-w-3xl flex-col text-center',
            dsSpacing.gap('sm'),
          )}
        >
          {title && (
            <h2 className={cmsHeading(2, resolvedTheme)}>
              {sanitizeText(title)}
            </h2>
          )}
          {subtitle && (
            <p className={cmsBody('lg', resolvedTheme, 'text-muted-foreground')}>
              {sanitizeText(subtitle)}
            </p>
          )}
        </div>
      )}

      <div className="w-full">
        {variant === 'progress' ? (
          renderProgressTimeline()
        ) : (
          <>
            {layout === 'vertical' && renderVerticalTimeline()}
            {layout === 'alternating' && renderAlternatingTimeline()}
            {layout === 'horizontal' && renderHorizontalTimeline()}
            {layout === 'balanced' && renderBalancedTimeline()}
          </>
        )}
      </div>
      {sectionFooterCta ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            variant={sectionFooterCta.variant === 'accent' ? 'default' : sectionFooterCta.variant === 'neutral' ? 'secondary' : 'outline'}
            onClick={() => openLink(sectionFooterCta.href)}
          >
            {sanitizeText(sectionFooterCta.text)}
          </Button>
        </div>
      ) : null}
    </CmsSection>
  );
};

const Timeline = withPerformanceTracking(
  TimelineComponent,
  ComponentType.Timeline,
);
export default Timeline;
