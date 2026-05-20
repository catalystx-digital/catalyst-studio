'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CmsBadge,
  cmsBody,
  dsSpacing,
} from '../../_ui';
import { sanitizeText } from '../../_core/security';
import { validateImageUrl, validateUrl } from '../../_utils/url-validation';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { TabsClientProps, TabHighlight } from './tabs.types';

const ALIGNMENT_CLASSES: Record<
  NonNullable<TabsClientProps['content']['align']>,
  string
> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  justified: 'justify-between',
};

const LIST_VARIANT_CLASSES: Record<NonNullable<TabsClientProps['variant']>, string> = {
  default: '',
  minimal: 'bg-transparent shadow-none border-none p-0',
  detailed: 'p-1.5',
  compact: 'gap-1 p-1',
  expanded: 'gap-2 p-2',
  segmented:
    'relative flex-wrap gap-2 border-b border-border/60 pb-2 data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r data-[orientation=vertical]:pr-4',
};

const TRIGGER_VARIANT_CLASSES: Record<NonNullable<TabsClientProps['variant']>, string> = {
  default: 'transition-[background-color,box-shadow] duration-200 hover:bg-muted/40 data-[state=active]:shadow-sm',
  minimal:
    'rounded-none border-b-2 border-transparent transition-[border-color,background-color] duration-200 hover:border-border/40 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  detailed: 'px-4 py-2 text-base transition-[background-color,box-shadow] duration-200 hover:bg-muted/40 data-[state=active]:shadow-md data-[state=active]:bg-card',
  compact: 'px-2 py-1 text-xs transition-[background-color] duration-200 hover:bg-muted/40',
  expanded: 'px-5 py-2.5 text-base shadow-sm transition-shadow duration-200 hover:shadow-md data-[state=inactive]:hover:bg-muted/60',
  segmented:
    'rounded-lg border border-transparent px-4 py-2 text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200 hover:border-border/80 hover:bg-muted/60 data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:shadow-md',
};

const CONTENT_VARIANT_CLASSES: Record<NonNullable<TabsClientProps['variant']>, string> = {
  default: 'transition-opacity duration-300',
  minimal: 'border-none bg-transparent p-0 shadow-none transition-opacity duration-300',
  detailed: 'p-6 transition-opacity duration-300',
  compact: 'p-3 transition-opacity duration-300',
  expanded: 'p-6 transition-opacity duration-300',
  segmented: 'mt-4 rounded-xl border border-border/40 bg-card p-6 shadow-sm transition-opacity duration-300 lg:p-8',
};

function resolveHighlightItem(item: string | TabHighlight): TabHighlight {
  if (typeof item === 'string') {
    return {
      id: item,
      text: sanitizeText(item),
    };
  }

  return {
    ...item,
    text: sanitizeText(item.text),
    label: item.label ? sanitizeText(item.label) : item.label,
    id: item.id ?? item.text,
  };
}

function renderHighlights(
  highlights: Array<string | TabHighlight> | undefined,
  theme: TabsClientProps['theme'],
): React.ReactNode {
  if (!highlights || highlights.length === 0) {
    return null;
  }

  const normalized = highlights
    .map(resolveHighlightItem)
    .filter((highlight) => highlight.text.length > 0);

  if (normalized.length === 0) {
    return null;
  }

  return (
    <ul
      className={cn(
        'flex flex-col gap-2',
        dsSpacing.pl('sm'),
        '[&>li]:flex [&>li]:items-start [&>li]:gap-3',
      )}
    >
      {normalized.map((highlight) => {
        const icon = highlight.icon
          ? resolveCmsIcon(highlight.icon, {
              className: 'mt-1 h-4 w-4 text-success',
              fallback: '•',
            })
          : resolveCmsIcon('CheckCircle', {
              className: 'mt-1 h-4 w-4 text-success',
              fallback: '•',
            });

        return (
          <li key={highlight.id}>
            <span aria-hidden className="text-success">
              {icon}
            </span>
            <span className={cmsBody('sm', undefined, 'text-muted-foreground')}>
              {highlight.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function renderMedia(
  media: TabsClientProps['content']['tabs'][number]['media'],
  theme: TabsClientProps['theme'],
): React.ReactNode {
  if (!media?.src) {
    return null;
  }

  const imageSrc = validateImageUrl(media.src);
  if (!imageSrc) {
    return null;
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/40 bg-muted/60 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <Image
        src={imageSrc}
        alt={sanitizeText(media.alt ?? '') || 'Tab preview'}
        width={960}
        height={540}
        className="h-full w-full object-cover transition-transform duration-300"
      />
    </div>
  );
}

function resolveDescription(
  tab: TabsClientProps['content']['tabs'][number],
): string | undefined {
  if (typeof tab.description === 'string' && tab.description.trim().length > 0) {
    return tab.description;
  }

  if (typeof tab.content === 'string') {
    return tab.content;
  }

  return undefined;
}

function resolveEyebrow(
  tab: TabsClientProps['content']['tabs'][number],
): string | undefined {
  if (!tab.eyebrow) return undefined;
  const sanitized = sanitizeText(tab.eyebrow);
  return sanitized.length > 0 ? sanitized : undefined;
}

export function TabsClient({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  animated = true,
  onTabChange,
}: TabsClientProps) {
  const tabs = Array.isArray(content.tabs) ? content.tabs : [];

  const firstEnabledTab = useMemo(
    () => tabs.find(tab => !tab.disabled) ?? tabs[0],
    [tabs],
  );

  if (tabs.length === 0) {
    return (
      <div
        className={cn(
          'cms-tabs-empty rounded-xl border border-dashed border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground backdrop-blur-sm',
          className,
        )}
      >
        No tabs are configured for this component.
      </div>
    );
  }

  const defaultValue = useMemo(() => {
    if (content.defaultTab && tabs.some(tab => tab.id === content.defaultTab && !tab.disabled)) {
      return content.defaultTab;
    }
    return firstEnabledTab?.id ?? tabs[0]?.id;
  }, [content.defaultTab, firstEnabledTab?.id, tabs]);

  const [activeTab, setActiveTab] = useState(
    () => defaultValue ?? firstEnabledTab?.id ?? tabs[0]?.id ?? '',
  );

  const previousDefaultRef = useRef(defaultValue);

  useEffect(() => {
    const availableIds = tabs.map(tab => tab.id);
    const preferred =
      firstEnabledTab?.id ||
      availableIds[0] ||
      '';

    const defaultChanged = defaultValue !== previousDefaultRef.current;
    previousDefaultRef.current = defaultValue;

    if (
      defaultChanged &&
      defaultValue &&
      availableIds.includes(defaultValue) &&
      activeTab !== defaultValue
    ) {
      setActiveTab(defaultValue);
      return;
    }

    if (!activeTab && (defaultValue || preferred)) {
      setActiveTab(defaultValue ?? preferred ?? '');
      return;
    }

    if (activeTab && !availableIds.includes(activeTab) && (defaultValue || preferred)) {
      const fallback = (defaultValue && availableIds.includes(defaultValue) && defaultValue) || preferred;
      if (fallback) {
        setActiveTab(fallback);
      }
    }
  }, [activeTab, defaultValue, firstEnabledTab?.id, tabs]);

  const handleValueChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      onTabChange?.(value);
    },
    [onTabChange],
  );

  const orientation = content.orientation === 'vertical' ? 'vertical' : 'horizontal';
  const align = content.align ?? 'left';

  const layoutClasses = cn(
    'cms-tabs-layout flex w-full',
    orientation === 'vertical' ? 'flex-col lg:flex-row' : 'flex-col',
    variant === 'compact'
      ? dsSpacing.gap('sm')
      : variant === 'expanded'
        ? dsSpacing.gap('xl')
        : variant === 'segmented'
          ? dsSpacing.gap('lg')
          : dsSpacing.gap('md'),
  );

  const listClasses = cn(
    'cms-tabs-list w-full',
    ALIGNMENT_CLASSES[align] ?? ALIGNMENT_CLASSES.left,
    LIST_VARIANT_CLASSES[variant],
    orientation === 'vertical'
      ? cn('flex-col items-stretch lg:w-72', dsSpacing.gap('sm'), variant === 'segmented' && 'border-b-0 border-r pr-4')
      : cn('flex-row flex-wrap', dsSpacing.gap('sm'), variant === 'segmented' && 'pb-2'),
  );

  const triggerClasses = cn(
    cmsBody('sm'),
    orientation === 'vertical' && 'w-full justify-start',
    TRIGGER_VARIANT_CLASSES[variant],
  );

  const contentClasses = cn(
    'cms-tabs-panel flex-1',
    CONTENT_VARIANT_CLASSES[variant],
    animated && 'data-[state=active]:animate-fade-in',
  );
  const resolveCtaVariant = (
    ctaVariant?: 'accent' | 'secondary' | 'outline' | 'neutral',
  ): 'default' | 'secondary' | 'outline' => {
    switch (ctaVariant) {
      case 'secondary':
        return 'secondary';
      case 'outline':
        return 'outline';
      case 'neutral':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const renderTabPanel = (
    tab: TabsClientProps['content']['tabs'][number],
  ): React.ReactNode => {
    if (React.isValidElement(tab.content)) {
      return tab.content;
    }

    const eyebrow = resolveEyebrow(tab);
    const description = resolveDescription(tab);
    const sanitizedDescription = description ? sanitizeText(description) : undefined;
    const highlightList = renderHighlights(tab.highlights, theme);
    const mediaNode = renderMedia(tab.media, theme);

    const cta = tab.cta && tab.cta.label && tab.cta.href ? tab.cta : undefined;
    const sanitizedCtaHref =
      cta && validateUrl(cta.href, { fallback: '' }) ? cta.href : undefined;

    if (
      !eyebrow &&
      !description &&
      !highlightList &&
      !mediaNode &&
      !sanitizedCtaHref
    ) {
      if (typeof tab.content === 'string') {
        return <p className={cmsBody('md')}>{tab.content}</p>;
      }

      return null;
    }

    return (
      <div
        className={cn(
          'flex flex-col',
          dsSpacing.gap('lg'),
        )}
      >
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <span className={cmsBody('xs', undefined, 'uppercase tracking-wide text-primary')}>
              {eyebrow}
            </span>
          ) : null}
          {sanitizedDescription ? (
            <p className={cmsBody('md', undefined, 'text-muted-foreground')}>
              {sanitizedDescription}
            </p>
          ) : null}
        </div>

        {highlightList}

        {mediaNode ? <div>{mediaNode}</div> : null}

        {sanitizedCtaHref ? (
          <Button
            asChild
            size="lg"
            variant={resolveCtaVariant(cta?.variant)}
            className="w-fit"
          >
            <a href={sanitizedCtaHref}>{sanitizeText(cta!.label)}</a>
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      orientation={orientation}
      className={cn('w-full', className)}
      data-active-tab={activeTab}
    >
      <div className={layoutClasses}>
        <TabsList
          className={listClasses}
          aria-label={content.heading || 'Tabbed content'}
          data-orientation={orientation}
        >
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={triggerClasses}
              disabled={tab.disabled}
            >
              <span className="flex w-full items-center gap-2">
                {tab.icon && (
                  <span aria-hidden="true" className="text-base leading-none">
                    {tab.icon}
                  </span>
                )}
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.badge !== undefined && (
                  <CmsBadge variant="outline">
                    {tab.badge}
                  </CmsBadge>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="cms-tabs-content flex-1">
          {tabs.map(tab => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className={contentClasses}
            >
              {renderTabPanel(tab)}
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}
