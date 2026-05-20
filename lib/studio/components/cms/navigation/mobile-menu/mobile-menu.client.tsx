"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cmsBody, resolveTheme } from '../../_ui';
import { MobileMenuProps } from './mobile-menu.types';
import { normalizeMenuItems } from '../nav-bar/nav-bar.transform';
import { MenuItem } from '../nav-bar/nav-bar.types';

// Default fallback menu items when LLM extraction fails completely
const FALLBACK_MENU_ITEMS: MenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Contact', href: '/contact' },
];

export function MobileMenuClient({ id, type, content, className, theme, onInteraction }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { position = 'right', animation = 'slide' } = content;
  const resolvedTheme = resolveTheme(theme);
  // Normalize menu items, using fallback if extraction failed completely
  const menuItems = useMemo(() => {
    const items = normalizeMenuItems(content.menuItems);
    return items.length > 0 ? items : FALLBACK_MENU_ITEMS;
  }, [content.menuItems]);

  const handleToggle = useCallback((next: boolean) => {
    setIsOpen(next);
    onInteraction?.(next ? 'menu-open' : 'menu-close');
  }, [onInteraction]);

  const handleItemClick = useCallback((item: MenuItem, index: number, depth: number) => {
    onInteraction?.('menu-item-click', { label: item.label, href: item.href, index, depth });
    setIsOpen(false);
  }, [onInteraction]);

  const renderItem = (item: MenuItem, index: number, depth = 0): React.ReactNode => (
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

  return (
    <div data-component-id={id} data-component-type={type} className={cn('cms-mobile-menu', className)}>
      <Sheet open={isOpen} onOpenChange={handleToggle}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open mobile menu">
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </SheetTrigger>
        <SheetContent side={position === 'left' ? 'left' : 'right'} hideClose className={cn('flex h-full w-72 flex-col gap-0 p-0', animation === 'fade' && 'data-[state=open]:animate-in data-[state=open]:fade-in-0')}>
          <div className="flex items-center justify-between border-b px-4 py-4">
            <SheetTitle className="text-lg font-bold">Menu</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
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
