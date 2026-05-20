'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import {
  CmsBadge,
  CARD_TONES,
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
  type CmsCardTone,
} from '../../_ui';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { sanitizeHtml, sanitizeText } from '../../_core/security';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import type {
  AboutSectionProps,
  MilestoneItem,
  ValueItem,
} from './about-section.types';

interface NormalizedStat {
  id: string;
  displayValue: string;
  label?: string;
}

interface NormalizedValue {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  analyticsValue: string;
}

interface NormalizedMilestone {
  id: string;
  year?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface NormalizedImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
}

const VALUE_ICON_CLASS = 'h-8 w-8 text-primary';
const TIMELINE_LINE_DESKTOP =
  'absolute left-1/2 top-0 bottom-0 hidden w-px -translate-x-1/2 transform bg-border-default/60 md:block';
const TIMELINE_LINE_MOBILE =
  'absolute left-3 top-3 bottom-3 w-px bg-border-default/60 md:hidden';
const TIMELINE_DOT_DESKTOP =
  'absolute left-1/2 top-1/2 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-border/40 bg-primary shadow-sm md:flex';
const TIMELINE_DOT_MOBILE =
  'absolute left-2 top-4 flex h-3 w-3 -translate-y-1/2 rounded-full border border-border/50 bg-primary shadow-sm md:hidden';

function sanitizeNullableText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitized = sanitizeText(value);
  return sanitized ? sanitized : undefined;
}

function sanitizeRichText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const sanitized = sanitizeHtml(value, {
    ALLOWED_TAGS: [
      'p',
      'strong',
      'em',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'br',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  return sanitized || undefined;
}

function resolveSectionTone(): CmsCardTone {
  return 'default';
}

const AboutSectionBase: React.FC<AboutSectionProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  loading = 'eager',
  onLoad,
  onError,
  onInteraction,
}) => {
  React.useEffect(() => {
    try {
      onLoad?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onLoad, onError]);

  const headingText = useMemo(
    () => sanitizeText(content.heading),
    [content.heading],
  );
  const subheadingText = useMemo(
    () => sanitizeNullableText(content.subheading),
    [content.subheading],
  );
  const storyHtml = useMemo(
    () => sanitizeRichText(content.story),
    [content.story],
  );
  const missionHtml = useMemo(
    () => sanitizeRichText(content.mission),
    [content.mission],
  );
  const visionHtml = useMemo(
    () => sanitizeRichText(content.vision),
    [content.vision],
  );

  const stats = useMemo<NormalizedStat[]>(() => {
    if (!Array.isArray(content.stats)) {
      return [];
    }

    return content.stats
      .map((stat, index) => {
        const prefix = sanitizeNullableText(stat.prefix) ?? '';
        const value = sanitizeNullableText(stat.value);
        const suffix = sanitizeNullableText(stat.suffix) ?? '';
        const label = sanitizeNullableText(stat.label);

        if (!value) {
          return null;
        }

        const normalized: NormalizedStat = {
          id: `stat-${index}`,
          displayValue: `${prefix}${value}${suffix}`.trim(),
        };

        if (label) {
          normalized.label = label;
        }

        return normalized;
      })
      .filter((stat): stat is NormalizedStat => stat !== null);
  }, [content.stats]);

  const values = useMemo<NormalizedValue[]>(() => {
    if (!Array.isArray(content.values)) {
      return [];
    }

    return content.values
      .map((value: ValueItem, index) => {
        const title = sanitizeNullableText(value.title);
        if (!title) {
          return null;
        }

        const description = sanitizeNullableText(value.description);
        const icon = resolveCmsIcon(value.icon, {
          className: VALUE_ICON_CLASS,
        });

        const normalized: NormalizedValue = {
          id: `value-${index}`,
          title,
          analyticsValue: typeof value.title === 'string' ? value.title : title,
        };

        if (description) {
          normalized.description = description;
        }

        if (icon) {
          normalized.icon = icon;
        }

        return normalized;
      })
      .filter((value): value is NormalizedValue => value !== null);
  }, [content.values]);

  const milestones = useMemo<NormalizedMilestone[]>(() => {
    if (!Array.isArray(content.milestones)) {
      return [];
    }

    return content.milestones
      .map((milestone: MilestoneItem, index) => {
        const year = sanitizeNullableText(milestone.year);
        const title = sanitizeNullableText(milestone.title);
        const description = sanitizeNullableText(milestone.description);
        const icon = resolveCmsIcon(milestone.icon, {
          className: 'h-4 w-4 text-primary',
        });

        if (!year && !title && !description && !icon) {
          return null;
        }

        const normalized: NormalizedMilestone = {
          id: `milestone-${index}`,
        };

        if (year) {
          normalized.year = year;
        }

        if (title) {
          normalized.title = title;
        }

        if (description) {
          normalized.description = description;
        }

        if (icon) {
          normalized.icon = icon;
        }

        return normalized;
      })
      .filter((milestone): milestone is NormalizedMilestone => milestone !== null);
  }, [content.milestones]);

  const images = useMemo<NormalizedImage[]>(() => {
    if (!Array.isArray(content.imageList)) {
      return [];
    }

    return content.imageList
      .map((image, index) => {
        if (!image || typeof image.src !== 'string' || image.src.trim().length === 0) {
          return null;
        }

        const alt = sanitizeNullableText(image.alt) ?? 'About section media';
        const caption = sanitizeNullableText(image.caption);

        const normalized: NormalizedImage = {
          id: `image-${index}`,
          src: image.src,
          alt,
        };

        if (caption) {
          normalized.caption = caption;
        }

        return normalized;
      })
      .filter((image): image is NormalizedImage => image !== null);
  }, [content.imageList]);

  const hasStats = content.showStats !== false && stats.length > 0;
  const hasValues = content.showValues !== false && values.length > 0;
  const hasMilestones = content.showMilestones !== false && milestones.length > 0;
  const layout = content.layout ?? 'single-column';

  const statsSection = hasStats ? (
    <div
      data-testid="cms-about-section-stats"
      className={cn(
        'border-y border-border/40 bg-gradient-to-r from-transparent via-muted/20 to-transparent',
        dsSpacing.py('xl'),
      )}
    >
      <div
        className={cn(
          'grid grid-cols-1',
          dsSpacing.gap('lg'),
          'sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {stats.map((stat) => (
          <div
            key={stat.id}
            className={cn(
              'group flex flex-col items-center text-center transition-shadow ',
              dsSpacing.gap('sm'),
            )}
          >
            <span className={cmsHeading(3, theme, 'text-primary transition-colors duration-200 group-hover:text-primary/80')}>
              {stat.displayValue}
            </span>
            {stat.label ? (
              <span className={cmsBody('sm', theme, 'text-muted-foreground')}>
                {stat.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const valuesSection = hasValues ? (
    <div
      data-testid="cms-about-section-values"
      className={cn('flex flex-col', dsSpacing.gap('xl'))}
    >
      <h3 className={cmsHeading(4, theme, 'text-center')}>Our Values</h3>

      <div
        className={cn(
          'grid',
          dsSpacing.gap('lg'),
          'sm:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {values.map((value) => (
          <Card
            key={value.id}
            className={cn(
              CARD_TONES.minimal,
              themeClass(theme),
              'group relative h-full cursor-pointer border-border/50 hover:border-primary/20',
            )}
            role="button"
            tabIndex={0}
            onClick={() =>
              onInteraction?.('value-click', {
                value: value.analyticsValue,
              })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onInteraction?.('value-click', {
                  value: value.analyticsValue,
                });
              }
            }}
            aria-label={`Company value: ${value.title}`}
          >
            <CardContent
              className={cn(
                'flex flex-col p-[var(--component-padding)] pt-0',
                themeClass(theme),
                dsSpacing.gap('sm'),
                dsSpacing.padding('lg'),
              )}
            >
              {value.icon ? (
                <span aria-hidden className="inline-flex transition-transform duration-300">
                  {value.icon}
                </span>
              ) : null}
              <h4 className={cmsHeading(5, theme, 'text-foreground')}>
                {value.title}
              </h4>
              {value.description ? (
                <p className={cmsBody('sm', theme)}>{value.description}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  ) : null;

  const imageGallery = images.length > 0 ? (
    <div
      className={cn(
        'grid',
        dsSpacing.gap('md'),
        images.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {images.map((image) => (
        <div key={image.id} className={cn('flex flex-col', dsSpacing.gap('xs'))}>
          <AspectRatio
            ratio={16 / 9}
            className="group overflow-hidden rounded-xl border border-border/40"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover transition-transform duration-300"
              loading={loading}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </AspectRatio>
          {image.caption ? (
            <p className={cmsBody('xs', theme, 'text-center text-muted-foreground')}>
              {image.caption}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  ) : null;

  const narrativeSection = (
    <div
      data-testid="cms-about-section-narrative"
      className={cn('flex flex-col', dsSpacing.gap('2xl'))}
    >
      {layout === 'two-column' ? (
        <div className={cn('grid lg:grid-cols-2', dsSpacing.gap('2xl'))}>
          <div className={cn('flex flex-col', dsSpacing.gap('xl'))}>
            {storyHtml ? (
              <section
                className={cn('flex flex-col', dsSpacing.gap('sm'))}
              >
                <h3 className={cmsHeading(4, theme)}>Our Story</h3>
                <SafeHtml
                  html={storyHtml}
                  className={cmsBody(
                    'md',
                    theme,
                    cn(
                      'cms-about-section__story [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80 [&_strong]:text-foreground [&_em]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul,_ol]:pl-5',
                      dsSpacing.mt('sm'),
                      dsSpacing.spaceY('md'),
                    ),
                  )}
                />
              </section>
            ) : null}
            {missionHtml ? (
              <Card className={cn(CARD_TONES.muted, themeClass(theme), 'border-border/50 hover:border-primary/30')}>
                <CardContent
                  className={cn(
                    'flex flex-col p-[var(--component-padding)] pt-0',
                    themeClass(theme),
                    dsSpacing.gap('sm'),
                    dsSpacing.padding('lg'),
                  )}
                >
                  <h3 className={cmsHeading(4, theme)}>Our Mission</h3>
                  <SafeHtml
                    html={missionHtml}
                    className={cmsBody(
                      'md',
                      theme,
                      cn(
                        '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80',
                        dsSpacing.spaceY('md'),
                      ),
                    )}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>
          <div className={cn('flex flex-col', dsSpacing.gap('xl'))}>
            {visionHtml ? (
              <Card className={cn(CARD_TONES.muted, themeClass(theme), 'border-border/50 hover:border-primary/30')}>
                <CardContent
                  className={cn(
                    'flex flex-col p-[var(--component-padding)] pt-0',
                    themeClass(theme),
                    dsSpacing.gap('sm'),
                    dsSpacing.padding('lg'),
                  )}
                >
                  <h3 className={cmsHeading(4, theme)}>Our Vision</h3>
                  <SafeHtml
                    html={visionHtml}
                    className={cmsBody(
                      'md',
                      theme,
                      cn(
                        '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80',
                        dsSpacing.spaceY('md'),
                      ),
                    )}
                  />
                </CardContent>
              </Card>
            ) : null}
            {imageGallery}
          </div>
        </div>
      ) : (
        <div className={cn('flex flex-col', dsSpacing.gap('2xl'))}>
          {storyHtml ? (
            <section className={cn('flex flex-col', dsSpacing.gap('sm'))}>
              <h3 className={cmsHeading(4, theme)}>Our Story</h3>
              <SafeHtml
                html={storyHtml}
                className={cmsBody(
                  'md',
                  theme,
                  cn(
                    '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80 [&_strong]:text-foreground [&_em]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul,_ol]:pl-5',
                    dsSpacing.spaceY('md'),
                  ),
                )}
              />
            </section>
          ) : null}
          {imageGallery}
          {(missionHtml || visionHtml) ? (
            <div
              className={cn(
                'grid',
                dsSpacing.gap('lg'),
                missionHtml && visionHtml ? 'md:grid-cols-2' : 'grid-cols-1',
              )}
            >
              {missionHtml ? (
                <Card className={cn(CARD_TONES.muted, themeClass(theme), 'border-border/50 hover:border-primary/30')}>
                  <CardContent
                    className={cn(
                      'flex flex-col p-[var(--component-padding)] pt-0',
                      themeClass(theme),
                      dsSpacing.gap('sm'),
                      dsSpacing.padding('lg'),
                    )}
                  >
                    <h3 className={cmsHeading(4, theme)}>Our Mission</h3>
                    <SafeHtml
                      html={missionHtml}
                      className={cmsBody(
                        'md',
                        theme,
                        cn(
                          '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80',
                          dsSpacing.spaceY('md'),
                        ),
                      )}
                    />
                  </CardContent>
                </Card>
              ) : null}
              {visionHtml ? (
                <Card className={cn(CARD_TONES.muted, themeClass(theme), 'border-border/50 hover:border-primary/30')}>
                  <CardContent
                    className={cn(
                      'flex flex-col p-[var(--component-padding)] pt-0',
                      themeClass(theme),
                      dsSpacing.gap('sm'),
                      dsSpacing.padding('lg'),
                    )}
                  >
                    <h3 className={cmsHeading(4, theme)}>Our Vision</h3>
                    <SafeHtml
                      html={visionHtml}
                      className={cmsBody(
                        'md',
                        theme,
                        cn(
                          '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80',
                          dsSpacing.spaceY('md'),
                        ),
                      )}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const milestonesSection = hasMilestones ? (
    <div
      data-testid="cms-about-section-milestones"
      className={cn('flex flex-col', dsSpacing.gap('xl'))}
    >
      <h3 className={cmsHeading(4, theme, 'text-center')}>Our Journey</h3>
      <div className="relative">
        <span aria-hidden className={TIMELINE_LINE_DESKTOP} />
        <span aria-hidden className={TIMELINE_LINE_MOBILE} />
        <ol className={cn('flex flex-col', dsSpacing.gap('2xl'))}>
          {milestones.map((milestone, index) => {
            const alignRight = index % 2 !== 0;
            return (
              <li
                key={milestone.id}
                className={cn(
                  'relative flex flex-col md:flex-row md:items-center',
                  dsSpacing.gap('md'),
                  alignRight && 'md:flex-row-reverse',
                )}
              >
                <span aria-hidden className={TIMELINE_DOT_DESKTOP} />
                <span aria-hidden className={TIMELINE_DOT_MOBILE} />
                <div
                  className={cn(
                    'relative md:w-1/2',
                    alignRight ? 'md:pl-10 md:text-left' : 'md:pr-10 md:text-right',
                  )}
                >
                  <Card
                    className={cn(
                      CARD_TONES.minimal,
                      themeClass(theme),
                      'border-border/50 hover:border-primary/30',
                      alignRight ? 'md:ml-0' : 'md:ml-auto',
                    )}
                  >
                    <CardContent
                      className={cn(
                        'flex flex-col p-[var(--component-padding)] pt-0',
                        themeClass(theme),
                        dsSpacing.gap('sm'),
                        dsSpacing.padding('lg'),
                        alignRight ? 'text-left' : 'text-left md:text-right',
                      )}
                    >
                      {milestone.year ? (
                        <CmsBadge
                          variant="neutral"
                          className={cn(
                            'w-fit uppercase tracking-wide',
                            alignRight ? 'md:ml-0' : 'md:ml-auto',
                          )}
                        >
                          {milestone.year}
                        </CmsBadge>
                      ) : null}
                      <div
                        className={cn(
                          'flex items-center',
                          dsSpacing.gap('xs'),
                          alignRight ? 'justify-start' : 'justify-start md:justify-end',
                        )}
                      >
                        {milestone.icon ? (
                          <span aria-hidden className="inline-flex">
                            {milestone.icon}
                          </span>
                        ) : null}
                        {milestone.title ? (
                          <h4 className={cmsHeading(5, theme)}>
                            {milestone.title}
                          </h4>
                        ) : null}
                      </div>
                      {milestone.description ? (
                        <p className={cmsBody('sm', theme)}>
                          {milestone.description}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  ) : null;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      className={cn('cms-about-section', className)}
      style={style}
      aria-label="About us section"
      role="region"
      containerClassName={cn('items-center', dsSpacing.gap('2xl'))}
      data-component-type="about-section"
    >
      <Card
        className={cn(
          CARD_TONES[resolveSectionTone()],
          themeClass(theme),
          'flex w-full max-w-6xl flex-col',
          dsSpacing.gap('2xl'),
        )}
      >
        <CardHeader
          className={cn(
            'flex flex-col gap-2 p-[var(--component-padding)]',
            themeClass(theme),
            'text-center',
            dsSpacing.gap('sm'),
          )}
        >
          <h2 className={cmsHeading(2, theme, 'mx-auto max-w-3xl text-balance')}>
            {headingText}
          </h2>
          {subheadingText ? (
            <p
              className={cmsBody(
                'lg',
                theme,
                'mx-auto max-w-2xl text-balance text-muted-foreground',
              )}
            >
              {subheadingText}
            </p>
          ) : null}
        </CardHeader>

        <CardContent
          className={cn(
            'p-[var(--component-padding)] pt-0',
            themeClass(theme),
            dsSpacing.spaceY('2xl'),
          )}
        >
          {statsSection}
          {narrativeSection}
          {valuesSection}
          {milestonesSection}
        </CardContent>
      </Card>
    </CmsSection>
  );
};

const MemoizedAboutSection = React.memo(AboutSectionBase);

const AboutSection = withPerformanceTracking(
  MemoizedAboutSection,
  ComponentType.AboutSection,
);

export default AboutSection;
