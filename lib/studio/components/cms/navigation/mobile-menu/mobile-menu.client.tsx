"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cmsBody, resolveTheme } from '../../_ui';
import { MobileMenuProps } from './mobile-menu.types';
import { MenuItem } from '../nav-bar/nav-bar.types';
import { isSafeSmartLinkHref, resolveSmartLinkHref } from '../../_utils/smart-link';

type RenderableMenuItem = Omit<MenuItem, 'href' | 'children'> & {
  href: string;
  rawHref: unknown;
  children?: RenderableMenuItem[];
};

function isSafeMenuHref(href: string): boolean {
  return isSafeSmartLinkHref(href);
}

function normalizeRenderableMenuItems(input: unknown): RenderableMenuItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry): RenderableMenuItem | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const href = resolveSmartLinkHref(record.href);

      if (!label || !href || !isSafeMenuHref(href)) {
        return null;
      }

      const children = normalizeRenderableMenuItems(record.children);
      const rawHref = record.href;
      const external =
        typeof record.external === 'boolean'
          ? record.external
          : rawHref &&
              typeof rawHref === 'object' &&
              (rawHref as Record<string, unknown>).type === 'external' &&
              (rawHref as Record<string, unknown>).openInNewTab === true;

      return {
        ...(record as MenuItem),
        label,
        href,
        rawHref,
        external,
        children: children.length > 0 ? children : undefined,
      };
    })
    .filter((item): item is RenderableMenuItem => item !== null);
}

export function MobileMenuClient({ id, type, content, className, theme, onInteraction }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { position = 'right', animation = 'slide' } = content;
  const resolvedTheme = resolveTheme(theme);
  const menuItems = useMemo(() => {
    return normalizeRenderableMenuItems(content.menuItems);
  }, [content.menuItems]);

  const handleToggle = useCallback((next: boolean) => {
    setIsOpen(next);
    onInteraction?.(next ? 'menu-open' : 'menu-close');
  }, [onInteraction]);

  const handleItemClick = useCallback((item: RenderableMenuItem, index: number, depth: number) => {
    onInteraction?.('menu-item-click', { label: item.label, href: item.rawHref, index, depth });
    setIsOpen(false);
  }, [onInteraction]);

  const renderItem = (item: RenderableMenuItem, index: number, depth = 0): React.ReactNode => {
    return (
      <div key={`${item.label}-${index}-${depth}`} className="flex flex-col border-b border-border/40 py-2">
        <SheetClose asChild>
          <Link href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined}
            className={cn('w-full px-4 py-3 text-left font-medium transition-colors', cmsBody('md', resolvedTheme, 'text-foreground'), 'hover:bg-muted/80 hover:text-secondary')}
            onClick={() => handleItemClick(item, index, depth)}>
            {item.label}
          </Link>
        </SheetClose>
        {item.children?.length ? (
          <div className="ml-4 flex flex-col border-l border-border/30 pl-2">
            {item.children.map((child, i) => renderItem(child, i, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div data-component-id={id} data-component-type={type} className={cn('cms-mobile-menu', className)}>
      <Sheet open={isOpen} onOpenChange={handleToggle}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open mobile menu">
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </SheetTrigger>
        <SheetContent side={position === 'left' ? 'left' : 'right'} hideClose aria-modal="true" className={cn('flex h-full w-72 flex-col gap-0 p-0', animation === 'fade' && 'data-[state=open]:animate-in data-[state=open]:fade-in-0')}>
          <div className="flex items-center justify-between border-b px-4 py-4">
            <SheetTitle className="text-lg font-bold">Menu</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close mobile menu">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">Mobile navigation</SheetDescription>
          <nav className="flex-1 overflow-y-auto" aria-label="Mobile menu">
            {menuItems.map((item, i) => renderItem(item, i))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
