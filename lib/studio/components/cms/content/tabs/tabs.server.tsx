import React from 'react';
import { cn } from '@/lib/utils';
import { CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import { TabsClient } from './tabs.client';
import { TabsServerProps, TabItem } from './tabs.types';

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
  const tabs = Array.isArray(content.tabs) ? content.tabs : [];

  const labelToId = new Map<string, string>();

  const sanitizedTabs: TabItem[] = tabs.map((tab, index) => {
    const labelKey = tab.label.toLowerCase();
    const id = sanitizeTabId(tab.id, tab.label, index);
    labelToId.set(labelKey, id);
    return {
      ...tab,
      id,
    };
  });
  const firstEnabledTab = sanitizedTabs.find(tab => !tab.disabled);

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
