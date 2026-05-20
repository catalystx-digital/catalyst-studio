import React from 'react';

import { cn } from '@/lib/utils';

import {
  CmsBadge,
  CmsSection,
  buildCmsClassName,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
} from '../../_ui';
import { shouldShowDevEmptyStateServer } from '../../_core/env-utils';
import { ContentFeedClient } from './content-feed.client';
import { resolveContentFeed } from './content-feed.resolver';
import type { ContentFeedProps, NormalizedContentFeedItem } from './content-feed.types';

function buildHeader(
  heading?: string,
  subheading?: string,
  theme?: ReturnType<typeof resolveTheme>,
) {
  if (!heading && !subheading) {
    return null;
  }

  return (
    <header className={cn('flex flex-col', dsSpacing.gap('xs'))}>
      {heading ? <h2 className={cmsHeading(2, theme)}>{heading}</h2> : null}
      {subheading ? <p className={cmsBody('md', theme)}>{subheading}</p> : null}
    </header>
  );
}

function applyPinnedBadges(items: NormalizedContentFeedItem[]): NormalizedContentFeedItem[] {
  return items.map(item => {
    if (!item.isPinned) {
      return item;
    }
    const existingTags = item.tags ?? [];
    if (existingTags.includes('Pinned')) {
      return item;
    }
    return {
      ...item,
      tags: ['Pinned', ...existingTags],
    };
  });
}

export function ContentFeedServer(props: ContentFeedProps) {
  const {
    content,
    className,
    theme = 'auto',
    variant = 'default',
  } = props;
  const resolvedTheme = resolveTheme(theme);
  const layout = content.layout ?? 'card-grid';
  const feed = resolveContentFeed(content);
  const hasEventHandlers = typeof props.onItemClick === 'function' || typeof props.onInteraction === 'function';
  if (hasEventHandlers) {
    if (process.env.NODE_ENV === 'development') {
    console.warn('[ContentFeed] Interaction handlers are ignored on the server-rendered feed to satisfy RSC constraints');
    }
  }

  const sectionClassName = buildCmsClassName({
    base: cn('cms-content-feed', dsSpacing.spaceY('md')),
    theme: resolvedTheme,
    variant,
    className,
    includeVariant: true,
  });

  const header = buildHeader(content.heading, content.subheading, resolvedTheme);

  if (feed.error) {
    return (
      <CmsSection
        theme={theme}
        variant={variant}
        className={sectionClassName}
        size="md"
      >
        {header}
        <div
          role="alert"
          className="cms-feed-error rounded-[var(--ds-radius-lg)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {feed.error}
        </div>
      </CmsSection>
    );
  }

  if (!feed.items || feed.items.length === 0) {
    // In production/exported sites, hide empty sections entirely
    if (!shouldShowDevEmptyStateServer()) {
      return null;
    }
    return (
      <CmsSection
        theme={theme}
        variant={variant}
        className={sectionClassName}
        size="md"
      >
        {header}
        <div className="cms-feed-empty rounded-[var(--ds-radius-lg)] border border-dashed border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {content.emptyCopy ?? 'No items available.'}
        </div>
      </CmsSection>
    );
  }

  const itemsWithBadges = applyPinnedBadges(feed.items);

  return (
    <CmsSection
      theme={theme}
      variant={variant}
      className={sectionClassName}
      size="md"
    >
      {header}
      {content.source?.pathPrefix ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CmsBadge variant="outline">Auto</CmsBadge>
          <span className="leading-none">
            Showing items{content.source.pathPrefix ? ` from ${content.source.pathPrefix}` : ''}.
          </span>
        </div>
      ) : null}
      <ContentFeedClient
        items={itemsWithBadges}
        layout={layout}
        theme={resolvedTheme}
        variant={variant}
      />
    </CmsSection>
  );
}
