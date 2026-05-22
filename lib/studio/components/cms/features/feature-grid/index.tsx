'use client';

import React from 'react';
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
import type { FeatureGridContent, FeatureGridProps } from './feature-grid.types';
import { resolveCmsIcon } from '../../_utils/icon-resolver';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface NormalizedFeature {
  title: string;
  description?: string;
  icon?: string | React.ReactNode;
  media?: {
    src: string;
    alt?: string;
  };
  link?: {
    url: string;
    text: string;
  };
  highlighted: boolean;
  highlightLabel?: string;
}

// No default icon fallback - only show icon if explicitly provided
// Checkmarks imply "feature included" which doesn't apply to menu items, services, etc.
const DEFAULT_ICON_FALLBACK = undefined;
const DEFAULT_HIGHLIGHT_LABEL = 'Featured';
const DEFAULT_LINK_TEXT = 'Learn more';
const CARD_TONE: CmsCardTone = 'minimal';

function extractLink(raw: unknown): NormalizedFeature['link'] {
  if (!isRecord(raw)) {
    return undefined;
  }

  if (typeof raw.url !== 'string' || raw.url.trim().length === 0) {
    return undefined;
  }

  return {
    url: raw.url.trim(),
    text:
      typeof raw.text === 'string' && raw.text.trim().length > 0
        ? raw.text.trim()
        : DEFAULT_LINK_TEXT,
  };
}

function extractIcon(raw: unknown): React.ReactNode | undefined {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  if (React.isValidElement(raw)) {
    return raw;
  }

  return undefined;
}

function extractMedia(raw: unknown, title: string): NormalizedFeature['media'] {
  if (!isRecord(raw)) {
    return undefined;
  }

  if (typeof raw.src !== 'string' || raw.src.trim().length === 0) {
    return undefined;
  }

  return {
    src: raw.src.trim(),
    alt:
      typeof raw.alt === 'string' && raw.alt.trim().length > 0
        ? raw.alt.trim()
        : title,
  };
}

function normalizeFeatures(features: unknown[]): NormalizedFeature[] {
  return features
    .map<NormalizedFeature | null>((feature) => {
      if (!isRecord(feature)) {
        return null;
      }

      const titleCandidate = typeof feature.title === 'string' ? feature.title : undefined;
      const descriptionCandidate = typeof feature.description === 'string' ? feature.description : undefined;

      const title = titleCandidate?.trim() ?? '';

      // Allow features with title OR description (image + description is a valid pattern)
      if (!title && !descriptionCandidate?.trim()) {
        return null;
      }

      const highlighted = feature.highlighted === true;
      const highlightLabelCandidate =
        typeof feature.highlightLabel === 'string' ? feature.highlightLabel : undefined;

      let icon: string | React.ReactNode | undefined;
      const iconRaw = feature.icon;

      if (React.isValidElement(iconRaw)) {
        icon = iconRaw;
      } else if (typeof iconRaw === 'string' && iconRaw.trim().length > 0) {
        icon = iconRaw.trim();
      }

      const mediaCandidate = extractMedia(feature.media, title);
      const linkCandidate = extractLink(feature.link);

      return {
        title,
        description: descriptionCandidate?.trim(),
        icon,
        media: mediaCandidate,
        link: linkCandidate,
        highlighted,
        highlightLabel: highlightLabelCandidate?.trim(),
      };
    })
    .filter((feature): feature is NormalizedFeature => Boolean(feature));
}

export type { FeatureGridContent, FeatureGridProps } from './feature-grid.types';

const GRID_TEMPLATE: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

class FeatureGridBase extends BaseComponent<FeatureGridProps> {
  protected renderComponent(): React.ReactNode {
    const { heading, subheading, features, columns = 3, background } = this.props.content;
    const normalizedFeatures = normalizeFeatures(
      Array.isArray(features) ? features : [],
    );

    // In production, return null when empty to avoid rendering empty sections
    // In development, the CmsAlert with devOnly will show a placeholder
    if (normalizedFeatures.length === 0 && !shouldShowDevEmptyState()) {
      return null;
    }

    const gridTemplate =
      GRID_TEMPLATE[columns] ?? GRID_TEMPLATE[Math.min(Math.max(columns, 2), 4)];

    return (
      <CmsSection
        size="md"
        theme={this.props.theme}
        variant={this.props.variant}
        background={background}
        className={cn('cms-feature-grid', this.props.className)}
        containerClassName={dsSpacing.gap('2xl')}
        style={this.props.style}
        data-component-type={this.props.type}
        data-component-id={this.props.id}
        aria-label={this.props.ariaLabel || 'Features section'}
      >
        {(heading || subheading) && (
          <div className={cn('flex flex-col items-center text-center', dsSpacing.gap('md'))}>
            {heading && (
              <h2 className={cmsHeading(2, this.props.theme, 'max-w-3xl text-foreground font-bold')}>
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

        <div
          data-testid="feature-grid-items"
          className={cn('grid gap-8', gridTemplate)}
        >
            {normalizedFeatures.length === 0 ? (
              <CmsAlert
                variant="default"
                theme={this.props.theme}
                className="col-span-full"
                devOnly
              >
                <CmsAlertDescription>
                  Feature content will appear here once configured.
                </CmsAlertDescription>
              </CmsAlert>
            ) : (
              normalizedFeatures.map((feature, index) => {
                const iconElement = resolveCmsIcon(feature.icon, {
                  className: 'size-5',
                  fallback: DEFAULT_ICON_FALLBACK,
                });

                return (
                  <Card
                    key={`${this.props.id}-feature-${index}`}
                    className={cn(
                      CARD_TONES[CARD_TONE],
                      themeClass(this.props.theme),
                      'group flex h-full flex-col overflow-hidden shadow-sm',
                      dsSpacing.gap('lg')
                    )}
                  >
                    {feature.media && (
                      <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-xl bg-muted">
                        <img
                          src={feature.media.src}
                          alt={feature.media.alt ?? feature.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </AspectRatio>
                    )}

                    <CardHeader
                      className={cn(
                        'flex flex-col gap-2 p-[var(--component-padding)]',
                        themeClass(this.props.theme),
                        dsSpacing.gap('md'),
                        dsSpacing.px('lg'),
                        dsSpacing.pt('lg'),
                        'pb-0',
                        feature.media ? 'mt-0' : '',
                      )}
                    >
                      <div className={cn('flex items-start justify-between', dsSpacing.gap('sm'))}>
                        <div className={cn('flex items-center', dsSpacing.gap('sm'))}>
                          {iconElement && (
                            <span
                              aria-hidden="true"
                              className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
                            >
                              {iconElement}
                            </span>
                          )}

                          <CardTitle className="text-left line-clamp-2">
                            {feature.title}
                          </CardTitle>
                        </div>

                        {feature.highlighted && (
                          <CmsBadge
                            variant="accent"
                            theme={this.props.theme}
                            className="shrink-0"
                          >
                            {feature.highlightLabel ?? DEFAULT_HIGHLIGHT_LABEL}
                          </CmsBadge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent
                      className={cn(
                        'p-[var(--component-padding)] pt-0',
                        themeClass(this.props.theme),
                        'flex flex-1 flex-col',
                        dsSpacing.gap('md'),
                        dsSpacing.px('lg'),
                        'pb-0',
                      )}
                    >
                      {feature.description && (
                        <p
                          className={cmsBody(
                            'sm',
                            this.props.theme,
                            'text-muted-foreground line-clamp-3',
                          )}
                        >
                          {feature.description}
                        </p>
                      )}
                    </CardContent>

                    <CardFooter
                      className={cn(
                        'flex items-center gap-3 p-[var(--component-padding)] pt-0',
                        themeClass(this.props.theme),
                        'mt-auto flex w-full items-center justify-start',
                        dsSpacing.px('lg'),
                        dsSpacing.pb('lg'),
                      )}
                    >
                      {feature.link && (
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className={cn(
                            'inline-flex items-center px-0 font-medium text-primary hover:text-primary/80',
                            dsSpacing.gap('xxs'),
                          )}
                          onClick={() =>
                            this.handleInteraction(
                              'feature-link-click',
                              feature.link?.url,
                            )
                          }
                        >
                          <Link href={feature.link.url}>
                            <span>{feature.link.text ?? DEFAULT_LINK_TEXT}</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
      </CmsSection>
    );
  }
}

const FeatureGridMemo = React.memo(FeatureGridBase);
export const FeatureGrid = withPerformanceTracking(
  FeatureGridMemo,
  ComponentType.FeatureGrid,
);
export default FeatureGrid;
