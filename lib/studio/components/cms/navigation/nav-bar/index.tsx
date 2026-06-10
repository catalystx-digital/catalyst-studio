import React from 'react';
import { cn } from '@/lib/utils';
import { NavBarProps } from './nav-bar.types';
import { NavBarServer } from './nav-bar.server';
import { NavBarClient } from './nav-bar.client';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { normalizeCTA, normalizeMenuItems } from './nav-bar.transform';

function hasMeaningfulLogo(logo: NavBarProps['content']['logo']): boolean {
  if (!logo) return false;
  const srcRecord = typeof logo.src === 'object' && logo.src !== null
    ? logo.src as { url?: string; src?: string; originalUrl?: string }
    : undefined;
  const source =
    typeof logo.src === 'string'
      ? logo.src
      : typeof srcRecord?.url === 'string'
        ? srcRecord.url
        : typeof srcRecord?.src === 'string'
          ? srcRecord.src
          : typeof srcRecord?.originalUrl === 'string'
            ? srcRecord.originalUrl
            : undefined;

  return Boolean(
    (typeof logo.text === 'string' && logo.text.trim()) ||
    (typeof logo.alt === 'string' && logo.alt.trim()) ||
    (typeof source === 'string' && source.trim())
  );
}

function hasMeaningfulNavbarContent(content: NavBarProps['content']): boolean {
  return (
    normalizeMenuItems(content.menuItems).length > 0 ||
    normalizeMenuItems(content.utilityNav ?? []).length > 0 ||
    hasMeaningfulLogo(content.logo) ||
    content.search?.enabled === true ||
    Boolean(normalizeCTA(content.cta))
  );
}

function NavBarComponent({ className, content, ...rest }: NavBarProps) {
  if (!hasMeaningfulNavbarContent(content)) {
    return null;
  }

  return (
    <header className={cn('nav-bar-container relative w-full')} data-component-type="navbar">
      <NavBarServer content={content} {...rest} className={className} />
      <NavBarClient content={content} {...rest} className={className} />
    </header>
  );
}

export const NavBar = withPerformanceTracking(NavBarComponent, ComponentType.NavBar);
export default NavBar;
