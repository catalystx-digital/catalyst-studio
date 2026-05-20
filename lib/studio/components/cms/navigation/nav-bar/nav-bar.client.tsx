'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { NavBarProps, MenuItem } from './nav-bar.types';
import { normalizeCTA, normalizeMenuItems } from './nav-bar.transform';
import { buildHrefActiveChecker, buildMenuItemActiveChecker, normalizePathname } from './nav-bar.utils';
import { SearchToggle } from './search-toggle';
import { NAVBAR_HEIGHT } from './nav-bar.constants';

export function NavBarClient({ content, className, onInteraction }: NavBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Default to sticky behavior
  const sticky = content.sticky !== false; // Default true
  const { logo, search } = content;

  const menuItems = useMemo(() => normalizeMenuItems(content.menuItems), [content.menuItems]);
  const cta = useMemo(() => normalizeCTA(content.cta), [content.cta]);

  const pathname = usePathname();
  const isMenuItemActive = useMemo(() => {
    const currentPath = normalizePathname(pathname ?? '/');
    return buildMenuItemActiveChecker(buildHrefActiveChecker(currentPath));
  }, [pathname]);


  const emit = useCallback(
    (event: string, payload?: Record<string, unknown>) => onInteraction?.(event, payload),
    [onInteraction],
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setIsOpen(next);
    emit(next ? 'menu_open' : 'menu_close', { surface: 'mobile' });
  }, [emit]);

  const renderLink = (item: MenuItem, index: number, depth = 0, parentLabel?: string) => {
    const active = isMenuItemActive(item);
    return (
      <SheetClose asChild key={`${item.label}-${index}`}>
        <Link
          href={item.href}
          className={cn(
            'block px-4 py-2 text-sm transition-colors hover:bg-muted/60 rounded-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            depth > 0 && 'pl-8',
            active ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
          onClick={() => emit('nav_click', { label: item.label, href: item.href, index, depth, parentLabel, surface: 'mobile' })}
        >
          {item.label}
        </Link>
      </SheetClose>
    );
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const children = [...(item.groups?.flatMap(g => g?.items ?? []) ?? []), ...(item.children ?? [])];
    return (
      <div key={`${item.label}-${index}`} className="border-b border-border/30">
        {renderLink(item, index)}
        {children.map((child, i) => renderLink(child, i, 1, item.label))}
      </div>
    );
  };

  return (
    <div className={cn(
      'nav-bar-client lg:hidden',
      // Use CSS sticky instead of fixed - stays in document flow, no spacer needed
      sticky && 'sticky top-0 z-50',
      'bg-background text-foreground border-b border-border shadow-sm',
      className,
    )}>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <div className={cn('flex items-center justify-between px-4', NAVBAR_HEIGHT.DEFAULT)}>
          {logo && (
            <Link href={logo.href ?? '/'} className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {/* width/height prevent CLS. CSS h-8 w-auto handles actual sizing. */}
              {logo.src ? (
                <img src={logo.src} alt={logo.alt || 'Logo'} width={150} height={32} className="h-8 w-auto object-contain" loading="eager" />
              ) : (
                (() => {
                  const label = (logo.alt || logo.text || 'Logo').trim();
                  const firstLetter = label.charAt(0).toUpperCase();
                  const restOfName = label.length > 1 ? label : null;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-base font-bold">
                        {firstLetter}
                      </span>
                      {restOfName && (
                        <span className="text-lg font-semibold tracking-tight">{restOfName}</span>
                      )}
                    </div>
                  );
                })()
              )}
            </Link>
          )}
          <div className="flex items-center gap-2">
            {search?.enabled && (
              <SearchToggle search={search} onInteraction={emit} />
            )}
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
          </div>
        </div>

        <SheetContent side="right" hideClose className="flex w-72 flex-col gap-0 p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <SheetTitle>Menu</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">Navigation menu</SheetDescription>

          <nav className="flex-1 overflow-y-auto py-2">
            {menuItems.map((item, i) => renderMenuItem(item, i))}
          </nav>

          {cta && (
            <div className="p-4 border-t">
              <SheetClose asChild>
                <Button asChild className="w-full">
                  <Link href={cta.href}>{cta.label}</Link>
                </Button>
              </SheetClose>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
