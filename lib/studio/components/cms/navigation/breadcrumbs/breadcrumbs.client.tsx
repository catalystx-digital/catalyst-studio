'use client';

import React from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { cmsBody } from '../../_ui/typography';
import { BreadcrumbsProps } from './breadcrumbs.types';

type NormalizedItem = { label: string; href: string };
type DisplayEntry =
  | { kind: 'item'; item: NormalizedItem; index: number }
  | { kind: 'ellipsis'; key: string };

function normalizeItems(
  items: BreadcrumbsProps['content']['items'],
): NormalizedItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      item =>
        item &&
        typeof item === 'object' &&
        typeof item.label === 'string',
    )
    .map(item => ({
      label: item.label.trim(),
      href:
        typeof item.href === 'string' && item.href.trim().length > 0
          ? item.href.trim()
          : '#',
    }));
}

export function BreadcrumbsClient({
  id,
  content,
  theme,
  variant,
  onInteraction,
}: BreadcrumbsProps) {
  const normalizedItems = React.useMemo(
    () => normalizeItems(content.items),
    [content.items],
  );

  const allItems = React.useMemo(() => {
    const showHome = content.showHome !== false;
    const homeLabel =
      typeof content.homeLabel === 'string' &&
      content.homeLabel.trim().length > 0
        ? content.homeLabel.trim()
        : 'Home';

    if (showHome) {
      return [
        { label: homeLabel, href: '/' },
        ...normalizedItems,
      ];
    }

    return normalizedItems;
  }, [content.homeLabel, content.showHome, normalizedItems]);

  const shouldCollapse = allItems.length > 3;

  const [isCollapsed, setIsCollapsed] = React.useState(shouldCollapse);

  React.useEffect(() => {
    if (!shouldCollapse) {
      setIsCollapsed(false);
      return;
    }

    setIsCollapsed(true);
  }, [shouldCollapse]);

  const separatorContent = React.useMemo(() => {
    if (
      typeof content.separator === 'string' &&
      content.separator.trim().length > 0
    ) {
      return content.separator.trim();
    }
    return undefined;
  }, [content.separator]);

  const displayedItems = React.useMemo<DisplayEntry[]>(() => {
    if (!shouldCollapse || !isCollapsed) {
      return allItems.map((item, index) => ({
        kind: 'item',
        item,
        index,
      }));
    }

    if (allItems.length === 0) {
      return [];
    }

    const first = allItems[0];
    const last = allItems[allItems.length - 1];

    if (allItems.length === 1) {
      return [{ kind: 'item', item: first, index: 0 }];
    }

    return [
      { kind: 'item', item: first, index: 0 },
      { kind: 'ellipsis', key: 'ellipsis' },
      {
        kind: 'item',
        item: last,
        index: allItems.length - 1,
      },
    ];
  }, [allItems, isCollapsed, shouldCollapse]);

  const listId = React.useMemo(
    () => `${id || 'breadcrumbs'}-mobile-list`,
    [id],
  );

  const emitInteraction = React.useCallback(
    (event: 'breadcrumbs-collapse' | 'breadcrumbs-expand', collapsed: boolean) => {
      onInteraction?.(event, {
        collapsed,
        itemCount: allItems.length,
        surface: 'mobile',
      });
    },
    [allItems.length, onInteraction],
  );

  const handleToggle = React.useCallback(() => {
    if (!shouldCollapse) {
      return;
    }

    setIsCollapsed(previous => {
      const next = !previous;
      emitInteraction(
        next ? 'breadcrumbs-collapse' : 'breadcrumbs-expand',
        next,
      );
      return next;
    });
  }, [emitInteraction, shouldCollapse]);

  const ariaLabel = isCollapsed
    ? 'Expand breadcrumbs'
    : 'Collapse breadcrumbs';
  const buttonLabel = isCollapsed ? 'Show full path' : 'Collapse';

  const renderListItem = (item: NormalizedItem, index: number, isLast: boolean) => (
    <BreadcrumbItem
      key={`${item.label}-${index}`}
      itemProp="itemListElement"
      itemScope
      itemType="https://schema.org/ListItem"
    >
      {index > 0 && (
        <BreadcrumbSeparator aria-hidden="true">
          {separatorContent ? (
            <span
              className={cmsBody(
                'sm',
                theme,
                'text-muted-foreground',
              )}
            >
              {separatorContent}
            </span>
          ) : undefined}
        </BreadcrumbSeparator>
      )}

      {isLast ? (
        <BreadcrumbPage itemProp="name">
          {item.label}
        </BreadcrumbPage>
      ) : (
        <BreadcrumbLink asChild itemProp="item">
          <Link href={item.href}>
            <span itemProp="name">{item.label}</span>
          </Link>
        </BreadcrumbLink>
      )}

      <meta itemProp="position" content={String(index + 1)} />
    </BreadcrumbItem>
  );

  if (!shouldCollapse) {
    return (
      <Breadcrumb
        aria-label="Breadcrumb"
        className="md:hidden flex-1"
        data-surface="mobile"
      >
        <BreadcrumbList
          className="flex-wrap"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          {allItems.map((item, index) =>
            renderListItem(item, index, index === allItems.length - 1),
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <div
      className="breadcrumbs-client md:hidden flex flex-col gap-2"
      data-state={isCollapsed ? 'collapsed' : 'expanded'}
    >
      <Breadcrumb
        aria-label="Breadcrumb"
        className="flex-1"
        data-surface="mobile"
      >
        <BreadcrumbList
          id={listId}
          className="flex-wrap"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          {displayedItems.map((entry, entryIndex) => {
            const isFirst = entryIndex === 0;
            const isLastItem =
              entry.kind === 'item' &&
              entry.index === allItems.length - 1;

            let content: React.ReactNode;

            if (entry.kind === 'ellipsis') {
              content = (
                <BreadcrumbEllipsis aria-label="Collapsed breadcrumb items" />
              );
            } else if (isLastItem) {
              content = (
                <>
                  <BreadcrumbPage itemProp="name">
                    {entry.item.label}
                  </BreadcrumbPage>
                  <meta
                    itemProp="position"
                    content={String(entry.index + 1)}
                  />
                </>
              );
            } else {
              content = (
                <>
                  <BreadcrumbLink asChild itemProp="item">
                    <Link href={entry.item.href}>
                      <span itemProp="name">{entry.item.label}</span>
                    </Link>
                  </BreadcrumbLink>
                  <meta
                    itemProp="position"
                    content={String(entry.index + 1)}
                  />
                </>
              );
            }

            return (
              <BreadcrumbItem
                key={
                  entry.kind === 'item'
                    ? `${entry.item.label}-${entry.index}`
                    : entry.key
                }
                itemProp={
                  entry.kind === 'item' ? 'itemListElement' : undefined
                }
                itemScope={entry.kind === 'item' ? true : undefined}
                itemType={
                  entry.kind === 'item'
                    ? 'https://schema.org/ListItem'
                    : undefined
                }
              >
                {!isFirst && (
                  <BreadcrumbSeparator aria-hidden="true">
                    {separatorContent ? (
                      <span
                        className={cmsBody(
                          'sm',
                          theme,
                          'text-muted-foreground',
                        )}
                      >
                        {separatorContent}
                      </span>
                    ) : undefined}
                  </BreadcrumbSeparator>
                )}

                {content}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        type="button"
        size="sm"
        variant="link"
        onClick={handleToggle}
        aria-expanded={!isCollapsed}
        aria-controls={listId}
        aria-label={ariaLabel}
        className={cmsBody('xs', theme, 'px-0 h-auto self-start')}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
