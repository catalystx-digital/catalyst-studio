'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BaseComponent } from '../../_core/base-component';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsBadge,
  CmsCardTone,
  CmsSection,
  CARD_TONES,
  themeClass,
  dsSpacing,
  cmsBody,
  cmsHeading,
  shouldShowDevEmptyState,
} from '../../_ui';
import type { FeatureShowcaseProps, FeatureShowcaseContent } from './feature-showcase.types';
import { resolveCmsIcon } from '../../_utils/icon-resolver';

export type { FeatureShowcaseProps, FeatureShowcaseContent } from './feature-showcase.types';

interface NormalizedShowcaseFeature {
  text: string;
  icon: string | React.ReactNode;
  highlighted: boolean;
  highlightLabel?: string;
}

interface NormalizedShowcaseSection {
  title: string;
  description?: string;
  image?: {
    src: string;
    alt: string;
  };
  features: NormalizedShowcaseFeature[];
  cta?: {
    text: string;
    url: string;
  };
  badge?: string;
  imagePosition: 'left' | 'right';
}

const DEFAULT_ICON = '✓';
const DEFAULT_BADGE = 'Highlighted';
const CARD_TONE: CmsCardTone = 'minimal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeFeature(item: unknown): NormalizedShowcaseFeature | null {
  if (!isRecord(item)) {
    return null;
  }

  const textCandidate = typeof item.text === 'string' ? item.text : undefined;

  if (!textCandidate) {
    return null;
  }

  let icon: string | React.ReactNode | undefined;
  const iconRaw = item.icon;

  if (React.isValidElement(iconRaw)) {
    icon = iconRaw;
  } else if (typeof iconRaw === 'string' && iconRaw.trim().length > 0) {
    icon = iconRaw.trim();
  } else {
    icon = DEFAULT_ICON;
  }

  const highlighted = item.highlighted === true;

  const highlightLabel =
    typeof item.highlightLabel === 'string' ? item.highlightLabel : undefined;

  return {
    text: textCandidate.trim(),
    icon,
    highlighted,
    highlightLabel: highlightLabel?.trim(),
  };
}

function normalizeSection(section: unknown, index: number): NormalizedShowcaseSection | null {
  if (!isRecord(section)) {
    return null;
  }

  const title = typeof section.title === 'string' ? section.title.trim() : undefined;
  if (!title) {
    return null;
  }

  const description =
    typeof section.description === 'string'
      ? section.description.trim()
      : undefined;

  let image: NormalizedShowcaseSection['image'];
  if (isRecord(section.image)) {
    if (typeof section.image.src === 'string' && section.image.src.trim().length > 0) {
      image = {
        src: section.image.src.trim(),
        alt:
          typeof section.image.alt === 'string' && section.image.alt.trim().length > 0
            ? section.image.alt.trim()
            : title,
      };
    }
  }

  const featuresRaw = Array.isArray(section.features) ? section.features : [];
  const features = featuresRaw
    .map(normalizeFeature)
    .filter(
      (feature): feature is NormalizedShowcaseFeature =>
        Boolean(feature),
    );

  const cta =
    section.cta &&
    isRecord(section.cta) &&
    (typeof section.cta.url === 'string' && section.cta.url.trim().length > 0)
      ? {
          url: section.cta.url.trim(),
          text:
            typeof section.cta.text === 'string' && section.cta.text.trim().length > 0
              ? section.cta.text.trim()
              : 'Learn more',
        }
      : undefined;

  const badge =
    isRecord(section.badge) && typeof section.badge.text === 'string'
      ? section.badge.text
      : undefined;

  const imagePosition: 'left' | 'right' =
    section.imagePosition === 'right'
      ? 'right'
      : section.imagePosition === 'left'
        ? 'left'
        : index % 2 === 0
          ? 'left'
          : 'right';

  return {
    title,
    description,
    image,
    features,
    cta,
    badge: badge?.trim(),
    imagePosition,
  };
}

function normalizeSections(sections: unknown[]): NormalizedShowcaseSection[] {
  return sections
    .map(normalizeSection)
    .filter(
      (section): section is NormalizedShowcaseSection =>
        Boolean(section),
    );
}

const FeatureShowcaseBase = class extends BaseComponent<FeatureShowcaseProps> {
  protected renderComponent(): React.ReactNode {
    const { heading, subheading, sections: contentSections } = this.props.content;

    const sectionsRaw = Array.isArray(contentSections) ? contentSections : [];
    const sections = normalizeSections(sectionsRaw);

    // In production, return null when empty to avoid rendering empty sections
    // In development, the CmsAlert with devOnly will show a placeholder
    if (sections.length === 0 && !shouldShowDevEmptyState()) {
      return null;
    }

    return (
      <CmsSection
        size="md"
        theme={this.props.theme}
        variant={this.props.variant}
        className={cn('cms-feature-showcase', this.props.className)}
        containerClassName={cn('cms-container', dsSpacing.gap('lg'))}
        style={this.props.style}
        data-component-type={this.props.type}
        data-component-id={this.props.id}
        aria-label={this.props.ariaLabel || 'Feature showcase'}
      >
          {(heading || subheading) && (
            <div className={cn('flex flex-col items-center text-center', dsSpacing.gap('md'))}>
              {heading && (
                <h2 className={cmsHeading(2, this.props.theme, 'max-w-4xl')}>
                  {heading}
                </h2>
              )}
              {subheading && (
                <p
                  className={cmsBody(
                    'lg',
                    this.props.theme,
                    'max-w-3xl text-muted-foreground',
                  )}
                >
                  {subheading}
                </p>
              )}
            </div>
          )}

          <div className={cn('flex flex-col', dsSpacing.gap('lg'))}>
            {sections.length === 0 ? (
              <CmsAlert
                variant="default"
                theme={this.props.theme}
                devOnly
              >
                <CmsAlertDescription>
                  Showcase sections will appear here once configured.
                </CmsAlertDescription>
              </CmsAlert>
            ) : (
              sections.map((section, index) => {
                const isImageLeft = section.imagePosition === 'left';

                return (
                  <Card
                    key={`${this.props.id}-section-${index}`}
                    className={cn(
                      CARD_TONES[CARD_TONE],
                      themeClass(this.props.theme),
                      'group flex flex-col overflow-hidden shadow-sm lg:flex-row',
                      dsSpacing.gap('lg'),
                      isImageLeft ? '' : 'lg:flex-row-reverse',
                    )}
                  >
                    {section.image && (
                      <div className="flex-1">
                        <AspectRatio ratio={16 / 9} className="relative h-full w-full overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={section.image.src}
                            alt={section.image.alt}
                            width={1600}
                            height={900}
                            className="h-full w-full object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            loading={this.props.loading ?? 'lazy'}
                            priority={
                              this.props.priority === 'critical' ||
                              this.props.priority === 'high'
                            }
                          />
                        </AspectRatio>
                      </div>
                    )}

                    <div
                      className={cn(
                        'flex flex-1 flex-col',
                        dsSpacing.gap('lg'),
                        dsSpacing.px('lg'),
                        dsSpacing.py('lg'),
                      )}
                    >
                      <CardHeader
                        className={cn(
                          'flex flex-col gap-2 p-[var(--component-padding)]',
                          themeClass(this.props.theme),
                          'items-start px-0 pt-0 pb-0 text-left',
                          dsSpacing.gap('sm'),
                        )}
                      >
                        <div className={cn('flex flex-wrap items-center', dsSpacing.gap('sm'))}>
                          <CardTitle className="text-left">
                            {section.title}
                          </CardTitle>
                          {section.badge && (
                            <CmsBadge
                              variant="accent"
                              theme={this.props.theme}
                            >
                              {section.badge}
                            </CmsBadge>
                          )}
                        </div>

                        {section.description && (
                          <p
                            className={cmsBody(
                              'md',
                              this.props.theme,
                              'text-muted-foreground',
                            )}
                          >
                            {section.description}
                          </p>
                        )}
                      </CardHeader>

                      {section.features.length > 0 && (
                        <CardContent
                          className={cn(
                            'p-[var(--component-padding)] pt-0',
                            themeClass(this.props.theme),
                            'px-0'
                          )}
                        >
                          <ul className={cn('flex flex-col', dsSpacing.gap('sm'))}>
                            {section.features.map((feature, featureIndex) => {
                              const iconElement = resolveCmsIcon(feature.icon ?? DEFAULT_ICON, {
                                className: 'size-4',
                                fallback: DEFAULT_ICON,
                              });

                              return (
                                <li
                                  key={`feature-${featureIndex}`}
                                  className={cn('flex flex-wrap items-center text-left', dsSpacing.gap('sm'))}
                                >
                                  {iconElement && (
                                    <span
                                      aria-hidden="true"
                                      className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm text-primary"
                                    >
                                      {iconElement}
                                    </span>
                                  )}
                                  <span
                                    className={cmsBody(
                                      'sm',
                                      this.props.theme,
                                      'text-foreground',
                                    )}
                                  >
                                    {feature.text}
                                  </span>
                                  {feature.highlighted && (
                                    <CmsBadge
                                      variant="accent"
                                      theme={this.props.theme}
                                    >
                                      {feature.highlightLabel ?? DEFAULT_BADGE}
                                    </CmsBadge>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </CardContent>
                      )}

                      <CardFooter
                        className={cn(
                          'flex items-center gap-3 p-[var(--component-padding)] pt-0',
                          themeClass(this.props.theme),
                          'mt-auto flex items-center justify-start px-0 pb-0',
                          dsSpacing.gap('sm'),
                        )}
                      >
                        {section.cta && (
                          <Button
                            asChild
                            variant="default"
                            size="lg"
                            onClick={() =>
                              this.handleInteraction(
                                'showcase-cta-click',
                                section.cta?.url,
                              )
                            }
                          >
                            <Link href={section.cta.url}>
                              <span>{section.cta.text}</span>
                              <span
                                aria-hidden="true"
                                className={dsSpacing.ml('xs')}
                              >
                                →
                              </span>
                            </Link>
                          </Button>
                        )}
                      </CardFooter>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
      </CmsSection>
    );
  }
};

const FeatureShowcaseMemo = React.memo(FeatureShowcaseBase);
export const FeatureShowcase = withPerformanceTracking(
  FeatureShowcaseMemo,
  ComponentType.FeatureShowcase,
);
export default FeatureShowcase;
