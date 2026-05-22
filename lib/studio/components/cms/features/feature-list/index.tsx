'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BaseComponent } from '../../_core/base-component';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import type { FeatureListProps, FeatureListContent } from './feature-list.types';
import { resolveCmsIcon } from '../../_utils/icon-resolver';

interface NormalizedFeatureListItem {
  title: string;
  description?: string;
  icon?: string | React.ReactNode;
  link?: {
    url: string;
    text: string;
  };
  highlighted: boolean;
  highlightLabel?: string;
}

const DEFAULT_ICON = '✓';
const DEFAULT_LINK_TEXT = 'Learn more';
const DEFAULT_HIGHLIGHT_LABEL = 'Featured';
const CARD_TONE: CmsCardTone = 'minimal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractIcon(raw: unknown): string | React.ReactNode | undefined {
  if (React.isValidElement(raw)) {
    return raw;
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return undefined;
}

function extractLink(raw: unknown): NormalizedFeatureListItem['link'] {
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

function normalizeItems(items: unknown): NormalizedFeatureListItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map<NormalizedFeatureListItem | null>((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const titleCandidate = typeof item.title === 'string' ? item.title : undefined;
      if (!titleCandidate) {
        return null;
      }

      const descriptionCandidate =
        typeof item.description === 'string' ? item.description : undefined;

      const iconCandidate = extractIcon(item.icon) ?? DEFAULT_ICON;

      const linkCandidate = extractLink(item.link);

      const highlighted = item.highlighted === true;

      const highlightLabelCandidate =
        typeof item.highlightLabel === 'string' ? item.highlightLabel : undefined;

      return {
        title: titleCandidate.trim(),
        description: descriptionCandidate?.trim(),
        icon: iconCandidate,
        link: linkCandidate,
        highlighted,
        highlightLabel: highlightLabelCandidate?.trim(),
      };
    })
    .filter((item): item is NormalizedFeatureListItem => Boolean(item));
}

export type { FeatureListProps, FeatureListContent } from './feature-list.types';

const LAYOUT_CLASS_MAP: Record<NonNullable<FeatureListContent['layout']>, string> = {
  vertical: cn('flex flex-col', dsSpacing.gap('lg')),
  horizontal: cn(
    'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    dsSpacing.gap('lg'),
  ),
};

class FeatureListBase extends BaseComponent<FeatureListProps> {
  protected renderComponent(): React.ReactNode {
    const {
      heading,
      subheading,
      layout = 'vertical',
      items,
    } = this.props.content;

    const normalizedItems = normalizeItems(items);

    // In production, return null when empty to avoid rendering empty sections
    // In development, the CmsAlert with devOnly will show a placeholder
    if (normalizedItems.length === 0 && !shouldShowDevEmptyState()) {
      return null;
    }

    const resolvedLayout = layout === 'horizontal' ? 'horizontal' : 'vertical';
    const containerClass = LAYOUT_CLASS_MAP[resolvedLayout];

    return (
      <CmsSection
        size="md"
        theme={this.props.theme}
        variant={this.props.variant}
        className={cn('cms-feature-list', this.props.className)}
        containerClassName={dsSpacing.gap('3xl')}
        style={this.props.style}
        data-component-type={this.props.type}
        data-component-id={this.props.id}
        aria-label={this.props.ariaLabel || 'Features list'}
      >
        {(heading || subheading) && (
          <div
            className={cn(
              'flex flex-col items-center text-center',
              dsSpacing.gap('lg'),
            )}
          >
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

        <div data-testid="feature-list-items" className={containerClass}>
            {normalizedItems.length === 0 ? (
              <CmsAlert
                variant="default"
                theme={this.props.theme}
                devOnly
              >
                <CmsAlertDescription>
                  Feature list items will appear here once configured.
                </CmsAlertDescription>
              </CmsAlert>
            ) : (
              normalizedItems.map((item, index) => {
                const iconElement = resolveCmsIcon(item.icon ?? DEFAULT_ICON, {
                  className: resolvedLayout === 'horizontal' ? 'size-6' : 'size-5',
                  fallback: DEFAULT_ICON,
                });

                return (
                  <Card
                    key={`${this.props.id}-item-${index}`}
                    className={cn(
                      CARD_TONES[CARD_TONE],
                      themeClass(this.props.theme),
                      'border border-border/50 shadow-sm transition-shadow',
                    )}
                  >
                    <CardContent
                      className={cn(
                        'flex gap-4 p-6',
                        resolvedLayout === 'horizontal'
                          ? 'flex-col items-center text-center'
                          : 'flex-row items-start text-left',
                      )}
                    >
                      {iconElement && (
                        <span
                          className={cn(
                            'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
                            resolvedLayout === 'horizontal' ? 'size-14' : 'size-12',
                          )}
                          aria-hidden="true"
                        >
                          {iconElement}
                        </span>
                      )}
                      <div className={cn('flex flex-1 flex-col gap-2', resolvedLayout === 'horizontal' && 'items-center')}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold leading-none tracking-tight">{item.title}</h4>
                          {item.highlighted && resolvedLayout !== 'horizontal' && (
                            <CmsBadge variant="accent" theme={this.props.theme} className="shrink-0">
                              {item.highlightLabel ?? DEFAULT_HIGHLIGHT_LABEL}
                            </CmsBadge>
                          )}
                        </div>
                        {item.highlighted && resolvedLayout === 'horizontal' && (
                          <CmsBadge variant="accent" theme={this.props.theme}>
                            {item.highlightLabel ?? DEFAULT_HIGHLIGHT_LABEL}
                          </CmsBadge>
                        )}
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        {item.link && (
                          <Button
                            asChild
                            size="sm"
                            variant="link"
                            className="inline-flex items-center gap-1 px-0 font-medium text-primary hover:text-primary/80"
                            onClick={() =>
                              this.handleInteraction('feature-list-link-click', item.link?.url)
                            }
                          >
                            <Link href={item.link.url}>
                              <span>{item.link.text ?? DEFAULT_LINK_TEXT}</span>
                              <span aria-hidden="true">→</span>
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
      </CmsSection>
    );
  }
}

const FeatureListMemo = React.memo(FeatureListBase);
export const FeatureList = withPerformanceTracking(
  FeatureListMemo,
  ComponentType.FeatureList,
);
export default FeatureList;
