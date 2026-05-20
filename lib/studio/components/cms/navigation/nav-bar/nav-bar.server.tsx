"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from '@/components/ui/navigation-menu';
import { Button } from '@/components/ui/button';
import { cmsBody, dsSpacing } from '../../_ui';
import type { ComponentTheme } from '../../_core/types';
import { NavBarProps, MenuItem, CTAButton } from './nav-bar.types';
import { normalizeCTA, normalizeMenuItems } from './nav-bar.transform';
import { buildHrefActiveChecker, buildMenuItemActiveChecker, normalizePathname } from './nav-bar.utils';
import { SearchToggle } from './search-toggle';
import { NavLogo } from './nav-logo';
import { getNavbarHeightClass } from './nav-bar.constants';

// CTA variant mappings
const CTA_VARIANT_MAP: Record<NonNullable<CTAButton['variant']>, 'default' | 'secondary' | 'outline'> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
};

function resolveCtaVariant(variant: CTAButton['variant'], theme?: ComponentTheme): 'default' | 'secondary' | 'outline' {
  const mapped = variant ? CTA_VARIANT_MAP[variant] ?? 'default' : 'default';
  if ((theme === 'dark' || theme === 'inverted') && mapped === 'secondary') {
    return 'outline';
  }
  return mapped;
}

// Shared CTA Button component
function NavCTA({
  cta,
  theme,
  onInteraction,
}: {
  cta: ReturnType<typeof normalizeCTA>;
  theme?: ComponentTheme;
  onInteraction: (event: string, payload: Record<string, unknown>) => void;
}) {
  if (!cta) return null;

  return (
    <Button
      variant={resolveCtaVariant(cta.variant, theme)}
      size="lg"
      className="font-semibold"
      asChild
    >
      <Link
        href={cta.href}
        target={cta.external ? '_blank' : undefined}
        rel={cta.external ? 'noopener noreferrer' : undefined}
        onClick={() =>
          onInteraction('cta_click', {
            label: cta.label,
            href: cta.href,
            variant: cta.variant ?? 'primary',
            external: Boolean(cta.external),
            surface: 'desktop',
          })
        }
      >
        {cta.label}
      </Link>
    </Button>
  );
}

// Dropdown link item
function DropdownLink({
  item,
  groupIndex,
  childIndex,
  depth,
  parentLabel,
  isActive,
  theme,
  onInteraction,
}: {
  item: MenuItem;
  groupIndex: number;
  childIndex: number;
  depth: number;
  parentLabel: string;
  isActive: boolean;
  theme?: ComponentTheme;
  onInteraction: (event: string, payload: Record<string, unknown>) => void;
}) {
  return (
    <NavigationMenuLink
      key={`${parentLabel}-${groupIndex}-${item.label}-${childIndex}`}
      asChild
      className="group flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/80 data-[active=true]:bg-accent/10"
      data-active={isActive ? 'true' : undefined}
    >
      <Link
        href={item.href}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        onClick={() =>
          onInteraction('nav_click', {
            label: item.label,
            href: item.href,
            index: childIndex,
            depth,
            parentLabel,
            external: Boolean(item.external),
            surface: 'desktop',
          })
        }
        aria-current={isActive ? 'page' : undefined}
        className="flex flex-col gap-1"
      >
        <span className="text-sm font-medium">
          {item.label}
          {item.external && <ExternalLink className="h-3 w-3 opacity-60" />}
          {isActive && <span className="sr-only"> (current page)</span>}
        </span>
        {item.description && (
          <span className={cmsBody('xs', theme, 'text-muted-foreground')}>{item.description}</span>
        )}
      </Link>
    </NavigationMenuLink>
  );
}

// Main menu item (with or without dropdown)
function NavMenuItem({
  item,
  index,
  isMenuItemActive,
  theme,
  onInteraction,
}: {
  item: MenuItem;
  index: number;
  isMenuItemActive: (item: MenuItem) => boolean;
  theme?: ComponentTheme;
  onInteraction: (event: string, payload: Record<string, unknown>) => void;
}) {
  const children = Array.isArray(item.children) ? item.children : [];
  const groups = Array.isArray(item.groups) ? item.groups : [];
  const combinedGroups = [
    ...groups,
    ...(children.length > 0 ? [{ title: undefined, description: undefined, items: children }] : []),
  ];
  const hasDropdown = combinedGroups.length > 0;
  const isActive = isMenuItemActive(item);

  const panelWidth =
    typeof item.panelWidth === 'number' ? `${item.panelWidth}px` : item.panelWidth ?? undefined;

  if (hasDropdown) {
    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger data-active={isActive ? 'true' : undefined}>
          {item.label}
          {isActive && <span className="sr-only"> (current page)</span>}
        </NavigationMenuTrigger>
        <NavigationMenuContent
          style={panelWidth ? { width: panelWidth } : undefined}
          className="rounded-xl border bg-popover p-4 shadow-lg"
        >
          <div className={cn('grid', dsSpacing.gap('md'), combinedGroups.length > 1 && 'sm:grid-cols-2')}>
            {combinedGroups.map((group, groupIndex) => (
              <div key={`${item.label}-group-${groupIndex}`} className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                {group?.title && (
                  <span className="text-xs font-semibold uppercase text-muted-foreground">{group.title}</span>
                )}
                {Array.isArray(group?.items) &&
                  group.items.map((child, childIndex) => (
                    <DropdownLink
                      key={`${item.label}-${groupIndex}-${child.label}`}
                      item={child}
                      groupIndex={groupIndex}
                      childIndex={childIndex}
                      depth={1}
                      parentLabel={item.label}
                      isActive={isMenuItemActive(child)}
                      theme={theme}
                      onInteraction={onInteraction}
                    />
                  ))}
              </div>
            ))}
          </div>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        className="inline-flex h-10 items-center justify-center px-4 py-2 text-base font-medium rounded-md hover:bg-muted/60 data-[active=true]:bg-accent/10 data-[active=true]:font-semibold whitespace-nowrap"
        data-active={isActive ? 'true' : undefined}
      >
        <Link
          href={item.href}
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noopener noreferrer' : undefined}
          onClick={() =>
            onInteraction('nav_click', {
              label: item.label,
              href: item.href,
              index,
              external: Boolean(item.external),
              surface: 'desktop',
            })
          }
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="flex items-center gap-1">
            {item.label}
            {item.external && <ExternalLink className="h-3 w-3 opacity-60" />}
          </span>
          {isActive && <span className="sr-only"> (current page)</span>}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

// Utility nav link (simplified)
function UtilityNavLink({
  item,
  index,
  isActive,
  onInteraction,
}: {
  item: MenuItem;
  index: number;
  isActive: boolean;
  onInteraction: (event: string, payload: Record<string, unknown>) => void;
}) {
  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        className="px-2 py-1 text-xs font-medium hover:text-foreground data-[active=true]:font-semibold"
        data-active={isActive ? 'true' : undefined}
      >
        <Link
          href={item.href}
          target={item.external ? '_blank' : undefined}
          rel={item.external ? 'noopener noreferrer' : undefined}
          onClick={() =>
            onInteraction('nav_click', {
              label: item.label,
              href: item.href,
              index,
              external: Boolean(item.external),
              surface: 'desktop',
              navType: 'utility',
            })
          }
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="flex items-center gap-1">
            {item.label}
            {item.external && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
          </span>
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

// Default fallback menu items when LLM extraction fails completely
const FALLBACK_MENU_ITEMS: MenuItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Contact', href: '/contact' },
];

export function NavBarServer({ content, className, theme, onInteraction }: NavBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  // Normalize menu items, using fallback if extraction failed completely
  const normalizedMenuItems = useMemo(() => {
    const items = normalizeMenuItems(content.menuItems);
    // Use fallback only if we got zero items after normalization
    return items.length > 0 ? items : FALLBACK_MENU_ITEMS;
  }, [content.menuItems]);
  const normalizedUtilityNav = useMemo(() => normalizeMenuItems(content.utilityNav ?? []), [content.utilityNav]);
  const normalizedCTA = useMemo(() => normalizeCTA(content.cta), [content.cta]);

  const hasUtilityNav = normalizedUtilityNav.length > 0;
  const resolvedTheme = typeof theme === 'string' ? theme : undefined;

  const pathname = usePathname();
  const currentPath = useMemo(() => normalizePathname(pathname ?? '/'), [pathname]);
  const isHrefActive = useMemo(() => buildHrefActiveChecker(currentPath), [currentPath]);
  const isMenuItemActive = useMemo(() => buildMenuItemActiveChecker(isHrefActive), [isHrefActive]);

  const emitInteraction = React.useCallback(
    (event: string, payload: Record<string, unknown>) => onInteraction?.(event, payload),
    [onInteraction],
  );

  // Sticky + transparent for modern header behavior (Easter Show style)
  // But only use transparent mode if explicitly set OR if there's a hero section
  // The page renderer sets data-has-hero attribute on the wrapper
  const sticky = content.sticky !== false; // Default true
  // transparent defaults to undefined (auto-detect from DOM), can be explicitly true/false
  const transparentProp = content.transparent;
  const { search, ariaLabel } = content;
  const navLabel = (ariaLabel ?? '').trim() || 'Primary navigation';

  // Detect if page has a hero section (for auto transparent mode)
  const [hasHero, setHasHero] = useState(false);
  useEffect(() => {
    // Check for data-has-hero attribute set by page renderer
    const wrapper = document.querySelector('[data-has-hero]');
    const heroAttr = wrapper?.getAttribute('data-has-hero');
    setHasHero(heroAttr === 'true');
  }, []);

  // Determine transparent mode: explicit prop > auto-detect from hasHero
  const transparent = transparentProp !== undefined ? transparentProp : hasHero;

  // Scroll detection for sticky header transformation
  useEffect(() => {
    if (!sticky) return;
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    handleScroll(); // Check initial state
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sticky]);

  // Determine if we should show transparent state (only when at top and transparent is enabled)
  const showTransparent = transparent && !isScrolled;

  // Filter out background/position classes from external className when sticky+transparent is enabled
  // because the component handles these dynamically based on scroll state
  const filteredClassName = (sticky && transparent && className)
    ? className.split(' ').filter(cls =>
        !cls.startsWith('bg-') &&
        !cls.startsWith('backdrop-') &&
        !cls.startsWith('border-') &&
        !cls.startsWith('shadow-') &&
        !cls.startsWith('fixed') &&
        !cls.startsWith('absolute') &&
        !cls.startsWith('relative') &&
        !cls.startsWith('sticky')
      ).join(' ')
    : className;

  // Determine positioning strategy:
  // - Non-transparent sticky: use CSS 'sticky' (stays in document flow, no spacer needed)
  // - Transparent sticky: use 'fixed' (floats over hero, needs spacer when scrolled)
  // - Non-sticky: use 'relative' (normal flow)
  const navClassName = cn(
    'nav-bar-server hidden w-full lg:block',
    // Positioning based on sticky + transparent combination
    sticky && !transparent && 'sticky top-0 z-50', // CSS sticky: stays in flow
    sticky && transparent && 'fixed top-0 left-0 right-0 z-50', // Fixed: floats over content
    !sticky && 'relative',
    // Background uses design system tokens
    'bg-background text-foreground shadow-sm border-b border-border',
    filteredClassName,
  );

  // Height class from constants (single source of truth)
  const navHeightClass = getNavbarHeightClass(hasUtilityNav);

  // Primary navigation content (shared between layouts)
  // Note: normalizedMenuItems always has items (fallback is applied in useMemo above)
  const primaryNav = (
    <div className="flex items-center gap-4">
      <NavigationMenu delayDuration={200} skipDelayDuration={100}>
        <NavigationMenuList>
          {normalizedMenuItems.map((item, index) => (
            <NavMenuItem
              key={`${item.label}-${index}`}
              item={item}
              index={index}
              isMenuItemActive={isMenuItemActive}
              theme={resolvedTheme}
              onInteraction={emitInteraction}
            />
          ))}
        </NavigationMenuList>
        <NavigationMenuIndicator />
        <NavigationMenuViewport />
      </NavigationMenu>
      {search?.enabled && <SearchToggle search={search} onInteraction={emitInteraction} />}
      <NavCTA cta={normalizedCTA} theme={resolvedTheme} onInteraction={emitInteraction} />
    </div>
  );

  // For fixed positioning (transparent + sticky), we need a spacer to prevent content overlap
  // The spacer only shows when scrolled (navbar becomes opaque)
  const needsSpacer = sticky && transparent && isScrolled;

  return (
    <>
      {/* Spacer: compensates for fixed navbar height when scrolled */}
      {needsSpacer && (
        <div
          className={cn('hidden lg:block', navHeightClass)}
          aria-hidden="true"
          data-navbar-spacer
        />
      )}
      <nav aria-label={navLabel} className={navClassName}>
        {/* Utility Navigation Row (conditional) */}
        {hasUtilityNav && (
          <div className={cn(
            'border-b transition-colors duration-300',
            'border-border bg-muted/30'
          )}>
            <div className="cms-container">
              <div className="flex h-8 items-center">
                <NavigationMenu className="flex items-center gap-1">
                  <NavigationMenuList className="flex items-center gap-1">
                    {normalizedUtilityNav.map((item, index) => (
                      <UtilityNavLink
                        key={`utility-${item.label}-${index}`}
                        item={item}
                        index={index}
                        isActive={isMenuItemActive(item)}
                        onInteraction={emitInteraction}
                      />
                    ))}
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            </div>
          </div>
        )}

        {/* Primary Navigation Row */}
        <div className="transition-colors duration-300">
          <div className="cms-container">
            <div className={cn('flex items-center justify-between', navHeightClass)}>
              <NavLogo logo={content.logo} onInteraction={emitInteraction} />
              <div className="hidden lg:flex">{primaryNav}</div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
