import React from 'react';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import { TabsClient } from './tabs.client';
import { TabsServerProps, TabItem } from './tabs.types';

type NormalizedTab = TabItem & { __wasActive?: boolean };

function resolveTabContentValue(source: any): string {
  if (!source || typeof source !== 'object') {
    return '';
  }

  const candidateKeys = ['content', 'body', 'description', 'text', 'html', 'markdown'];
  for (const key of candidateKeys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  const summary = source.summary;
  if (typeof summary === 'string' && summary.trim().length > 0) {
    return summary;
  }

  return '';
}

function sanitizeTabId(sourceId: unknown, label: string | undefined, index: number): string {
  if (typeof sourceId === 'string' && sourceId.trim().length > 0) {
    return sourceId.trim();
  }

  if (typeof sourceId === 'number') {
    return sourceId.toString();
  }

  if (typeof label === 'string' && label.trim().length > 0) {
    const normalized = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return `tab-${index + 1}`;
}

function normalizeTabsFromAreas(items: any[] | undefined): NormalizedTab[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((child, index) => {
    const tabContent = child?.content ?? {};
    const label = typeof tabContent.label === 'string' ? tabContent.label : tabContent.heading ?? '';

    return {
      id: sanitizeTabId(child?.id, label, index),
      label,
      content: resolveTabContentValue(tabContent),
      icon: tabContent.icon,
      disabled: tabContent.disabled,
      badge: tabContent.badge,
      description: tabContent.description,
      eyebrow: tabContent.eyebrow,
      highlights: Array.isArray(tabContent.highlights) ? tabContent.highlights : undefined,
      media: tabContent.media,
      cta: tabContent.cta,
      __wasActive: tabContent.active === true
    } as NormalizedTab;
  }).filter(tab => typeof tab.label === 'string' && tab.label.length > 0);
}

function normalizeLegacyTabs(tabs: any[] | undefined): NormalizedTab[] {
  if (!Array.isArray(tabs)) {
    return [];
  }

  return tabs.map((entry, index) => {
    const rawContent = entry?.content;
    const tabSource = rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent)
      ? rawContent
      : entry ?? {};

    const labelCandidate = typeof tabSource.label === 'string' ? tabSource.label : entry?.label;
    const label = typeof labelCandidate === 'string' ? labelCandidate : tabSource.heading ?? '';
    const contentValue = typeof rawContent === 'string'
      ? rawContent
      : resolveTabContentValue(tabSource);

    return {
      id: sanitizeTabId(entry?.id, label, index),
      label,
      content: contentValue,
      icon: tabSource.icon ?? entry?.icon,
      disabled: tabSource.disabled ?? entry?.disabled,
      badge: tabSource.badge ?? entry?.badge,
      description: tabSource.description ?? entry?.description,
      eyebrow: tabSource.eyebrow ?? entry?.eyebrow,
      highlights: Array.isArray(tabSource.highlights)
        ? tabSource.highlights
        : Array.isArray(entry?.highlights)
          ? entry?.highlights
          : undefined,
      media: tabSource.media ?? entry?.media,
      cta: tabSource.cta ?? entry?.cta,
      __wasActive: tabSource.active === true || entry?.active === true
    } as NormalizedTab;
  }).filter(tab => typeof tab.label === 'string' && tab.label.length > 0);
}

export function TabsServer({
  id,
  type,
  category,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analytics,
  animated = true,
  onTabChange,
}: TabsServerProps) {
  const slotTabs = normalizeTabsFromAreas(content.areas?.items);
  const legacyTabs = normalizeLegacyTabs(content.tabs);
  const normalizedTabs: NormalizedTab[] = slotTabs.length > 0 ? slotTabs : legacyTabs;

  const labelToId = new Map<string, string>();
  let activeTabIdFromFlag: string | undefined;

  const firstEnabledTab = normalizedTabs.find(tab => !tab.disabled);

  const sanitizedTabs: TabItem[] = normalizedTabs.map((tab, index) => {
    const labelKey = tab.label.toLowerCase();
    labelToId.set(labelKey, tab.id);

    if (tab.__wasActive && !activeTabIdFromFlag) {
      activeTabIdFromFlag = tab.id;
    }

    const { __wasActive: _ignored, id: providedId, ...rest } = tab;
    return {
      id: providedId || sanitizeTabId(undefined, rest.label, index),
      ...rest,
    };
  });

  const defaultTabId = (() => {
    if (content.defaultTab && sanitizedTabs.some(tab => tab.id === content.defaultTab)) {
      return content.defaultTab;
    }

    if (content.defaultActiveTab) {
      const lookup = labelToId.get(content.defaultActiveTab.toLowerCase());
      if (lookup) {
        return lookup;
      }
    }

    if (activeTabIdFromFlag) {
      return activeTabIdFromFlag;
    }

    return firstEnabledTab?.id ?? sanitizedTabs[0]?.id;
  })();
  const resolvedDefaultTab = (() => {
    if (!defaultTabId) {
      return undefined;
    }
    const matching = sanitizedTabs.find(tab => tab.id === defaultTabId);
    if (matching?.disabled) {
      return firstEnabledTab?.id ?? sanitizedTabs.find(tab => !tab.disabled)?.id;
    }
    return defaultTabId;
  })();

  const preparedContent = {
    ...content,
    tabs: sanitizedTabs,
    defaultTab: resolvedDefaultTab ?? content.defaultTab,
    defaultActiveTab: content.defaultActiveTab
  };

  const analyticsId =
    typeof analytics?.trackingId === 'string' && analytics.trackingId.length > 0
      ? analytics.trackingId
      : undefined;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      style={style}
      className="cms-tabs-section"
      containerClassName={cn('cms-tabs-container', dsSpacing.gap('lg'))}
      data-component-id={id}
      data-component-type={type ?? 'tabs'}
      data-variant={variant}
      data-analytics-id={analyticsId}
      data-orientation={content.orientation ?? 'horizontal'}
    >
      {(content.heading || content.subheading) && (
        <header className={cn('flex flex-col', dsSpacing.gap('sm'))}>
          {content.heading && (
            <h2 className={cmsHeading(3, theme)}>{content.heading}</h2>
          )}
          {content.subheading && (
            <p className={cmsBody('md', theme)}>{content.subheading}</p>
          )}
        </header>
      )}
      <TabsClient
        id={id}
        type={type}
        category={category}
        content={preparedContent}
        className={className}
        theme={theme}
        variant={variant}
        animated={animated}
        onTabChange={onTabChange}
      />
    </CmsSection>
  );
}
