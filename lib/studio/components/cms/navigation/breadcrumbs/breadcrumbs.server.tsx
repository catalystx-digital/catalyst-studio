import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { cmsBody } from '../../_ui/typography';
import { BreadcrumbsProps } from './breadcrumbs.types';

interface BreadcrumbItem {
  label: string;
  href: string;
}

function normalizeItems(
  items: BreadcrumbsProps['content']['items'],
): BreadcrumbItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const label =
        typeof item.label === 'string' ? item.label.trim() : '';
      const href =
        typeof item.href === 'string' ? item.href.trim() : '#';
      return { label, href };
    })
    .filter(item => item.label.length > 0);
}

export function BreadcrumbsServer({
  id,
  type,
  content,
  className,
  theme,
  variant,
}: BreadcrumbsProps) {
  const {
    items,
    separator = '/',
    showHome = true,
    homeLabel = 'Home',
  } = content;

  const normalizedItems = normalizeItems(items);

  // Check if first item is already a home-like entry to avoid duplicates
  const firstItem = normalizedItems[0];
  const firstItemIsHome =
    firstItem &&
    (firstItem.href === '/' ||
      firstItem.href === '' ||
      firstItem.label.toLowerCase() === 'home');

  // Only add Home if showHome is true AND the data doesn't already start with Home
  const allItems =
    showHome && !firstItemIsHome
      ? [{ label: homeLabel, href: '/' }, ...normalizedItems]
      : normalizedItems;
  const shouldCollapseForMobile = allItems.length > 3;

  if (allItems.length === 0) {
    return null;
  }

  const separatorContent =
    typeof separator === 'string' && separator.trim().length > 0
      ? separator.trim()
      : undefined;

  return (
    <Breadcrumb
      data-component-id={id}
      data-component-type={type}
      className={cn(
        shouldCollapseForMobile ? 'hidden md:flex' : undefined,
        className,
      )}
      aria-label="Breadcrumb"
    >
      <BreadcrumbList
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {allItems.map((item, index) => {
          const position = index + 1;
          const isLast = index === allItems.length - 1;

          return (
            <BreadcrumbItem
              key={`${item.label}-${index}`}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && (
                <BreadcrumbSeparator
                  aria-hidden="true"
                  className="text-muted-foreground/60"
                >
                  {separatorContent ? (
                    <span
                      className={cmsBody(
                        'sm',
                        theme,
                        'text-muted-foreground/60 font-light',
                      )}
                    >
                      {separatorContent}
                    </span>
                  ) : undefined}
                </BreadcrumbSeparator>
              )}

              {isLast ? (
                <BreadcrumbPage
                  itemProp="name"
                  className="font-semibold text-secondary"
                >
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  asChild
                  itemProp="item"
                  className="transition-colors duration-200 hover:text-secondary relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-secondary after:transition-[width] after:duration-200 hover:after:w-full"
                >
                  <Link href={item.href}>
                    <span itemProp="name">{item.label}</span>
                  </Link>
                </BreadcrumbLink>
              )}

              <meta itemProp="position" content={String(position)} />
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
