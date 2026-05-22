/**
 * Adapter components that wrap navigation components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { CMSComponentProps } from '../_core/types';
import { readRuntimeContent } from '../_core/utils';
import { NavBar as NavBarImpl } from './nav-bar';
import { Footer as FooterImpl } from './footer';
import { MobileMenu as MobileMenuImpl } from './mobile-menu';
import { Breadcrumbs as BreadcrumbsImpl } from './breadcrumbs';
import { SidebarNavServer as SidebarNavImpl } from './sidebar-nav';
import { NavBarContent, NavBarProps } from './nav-bar/nav-bar.types';
import { FooterContent, FooterProps } from './footer/footer.types';
import { MobileMenuContent, MobileMenuProps } from './mobile-menu/mobile-menu.types';
import { BreadcrumbsContent, BreadcrumbsProps } from './breadcrumbs/breadcrumbs.types';
import { SidebarNavContent, SidebarNavProps, SidebarNavItem, SidebarNavStyleProps } from './sidebar-nav/sidebar-nav.types';
import { MenuItem } from '../_core/value-objects';

/**
 * Type guard to check if content is BreadcrumbsContent
 */
function isBreadcrumbsContent(content: any): content is BreadcrumbsContent {
  return content && Array.isArray(content.items);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLinkValue(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.type !== 'string') {
    return false;
  }

  return ['internal', 'external', 'email', 'phone', 'anchor'].includes(value.type);
}

function canonicalMenuItems(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((item) => {
      if (typeof item.label !== 'string') {
        return null;
      }

      const groups = Array.isArray(item.groups)
        ? item.groups
            .filter(isPlainObject)
            .map((group) => ({
              ...(typeof group.title === 'string' ? { title: group.title } : {}),
              ...(typeof group.description === 'string' ? { description: group.description } : {}),
              ...(Array.isArray(group.items) ? { items: canonicalMenuItems(group.items) } : {})
            }))
        : undefined;

      const next: MenuItem = {
        label: item.label,
        ...(isLinkValue(item.href) ? { href: item.href } : {}),
        ...(typeof item.description === 'string' ? { description: item.description } : {}),
        ...(typeof item.icon === 'string' ? { icon: item.icon } : {}),
        ...(Array.isArray(item.children) ? { children: canonicalMenuItems(item.children) } : {}),
        ...(groups ? { groups } : {}),
        ...(typeof item.external === 'boolean' ? { external: item.external } : {}),
        ...(typeof item.panelOffset === 'number' ? { panelOffset: item.panelOffset } : {}),
        ...(typeof item.panelWidth === 'number' || typeof item.panelWidth === 'string' ? { panelWidth: item.panelWidth } : {}),
        ...(item.panelAlign === 'start' || item.panelAlign === 'center' || item.panelAlign === 'end' ? { panelAlign: item.panelAlign } : {})
      };

      return next;
    })
    .filter((item): item is MenuItem => item !== null);
}

function canonicalFooterColumns(value: unknown): FooterContent['columns'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter(isPlainObject)
    .map((column) => ({
      ...(typeof column.title === 'string' ? { title: column.title } : {}),
      links: canonicalMenuItems(column.links)
    }))
    .filter((column) => column.title || column.links.length > 0);
}

function canonicalSocialLinks(value: unknown): FooterContent['socialLinks'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter(isPlainObject)
    .filter((link) =>
      ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'github', 'website'].includes(link.platform) &&
      typeof link.url === 'string'
    )
    .map((link) => ({
      platform: link.platform,
      url: link.url,
      ...(typeof link.icon === 'string' ? { icon: link.icon } : {}),
      ...(typeof link.label === 'string' ? { label: link.label } : {})
    }));
}

/**
 * NavBar Adapter Component
 */
export const NavBarAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const base = asRecord(raw);

  const navBarContent: NavBarContent = {
    menuItems: canonicalMenuItems(base.menuItems),
    ...(Array.isArray(base.utilityNav) ? { utilityNav: canonicalMenuItems(base.utilityNav) } : {}),
    ...(base.logo && typeof base.logo === 'object' ? { logo: base.logo } : {}),
    ...(base.cta && typeof base.cta === 'object' ? { cta: base.cta } : {}),
    ...(base.search && typeof base.search === 'object' ? { search: base.search } : {}),
    ...(typeof base.mobileBreakpoint === 'number' ? { mobileBreakpoint: base.mobileBreakpoint } : {}),
    ...(typeof base.sticky === 'boolean' ? { sticky: base.sticky } : {}),
    ...(typeof base.transparent === 'boolean' ? { transparent: base.transparent } : {}),
    ...(typeof base.ariaLabel === 'string' ? { ariaLabel: base.ariaLabel } : {}),
    ...(base.layout === 'single-row' || base.layout === 'multi-row' ? { layout: base.layout } : {})
  };

  const navBarProps: NavBarProps = {
    ...props,
    content: navBarContent
  };

  return <NavBarImpl {...navBarProps} />;
};

/**
 * Footer Adapter Component
 */
export const FooterAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const base = asRecord(raw);
  const columns = canonicalFooterColumns(base.columns);
  const socialLinks = canonicalSocialLinks(base.socialLinks);

  const footerContent: FooterContent = {
    ...(columns ? { columns } : {}),
    ...(typeof base.logo === 'string' ? { logo: base.logo } : {}),
    ...(typeof base.logoAlt === 'string' ? { logoAlt: base.logoAlt } : {}),
    ...(typeof base.siteName === 'string' ? { siteName: base.siteName } : {}),
    ...(typeof base.description === 'string' ? { description: base.description } : {}),
    ...(socialLinks ? { socialLinks } : {}),
    ...(Array.isArray(base.legalLinks) ? { legalLinks: canonicalMenuItems(base.legalLinks) } : {}),
    ...(typeof base.newsletter === 'object' ? { newsletter: base.newsletter } : {}),
    ...(typeof base.copyright === 'string' ? { copyright: base.copyright } : {}),
    ...(typeof base.backgroundColor === 'string' ? { backgroundColor: base.backgroundColor } : {}),
    ...(typeof base.textColor === 'string' ? { textColor: base.textColor } : {})
  };

  const footerProps: FooterProps = {
    ...props,
    content: footerContent
  };

  return <FooterImpl {...footerProps} />;
};

/**
 * MobileMenu Adapter Component
 */
export const MobileMenuAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const base = asRecord(raw);

  const mobileMenuContent: MobileMenuContent = {
    menuItems: canonicalMenuItems(base.menuItems),
    ...(base.position === 'left' || base.position === 'right' ? { position: base.position } : {}),
    ...(base.animation === 'slide' || base.animation === 'fade' ? { animation: base.animation } : {})
  };

  const mobileMenuProps: MobileMenuProps = {
    ...props,
    content: mobileMenuContent
  };

  return <MobileMenuImpl {...mobileMenuProps} />;
};

/**
 * Breadcrumbs Adapter Component
 */
export const BreadcrumbsAdapter: React.FC<CMSComponentProps> = (props) => {
  // Convert generic content to BreadcrumbsContent with defaults
  const raw = readRuntimeContent(props.content);
  const breadcrumbsContent: BreadcrumbsContent = isBreadcrumbsContent(raw)
    ? (raw as BreadcrumbsContent)
    : {
        items: [],
        separator: '/',
        showHome: true
      };

  const breadcrumbsProps: BreadcrumbsProps = {
    ...props,
    content: breadcrumbsContent
  };

  return <BreadcrumbsImpl {...breadcrumbsProps} />;
};

/**
 * Normalizes raw navigation items into SidebarNavItem format
 */
function normalizeSidebarNavItems(rawItems: unknown[]): SidebarNavItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    .map((item) => {
      const label = typeof item.label === 'string' ? item.label : '';
      const href = typeof item.href === 'string' ? item.href : '';

      const result: SidebarNavItem = {
        label,
        href,
      };

      if (typeof item.isExpandable === 'boolean') {
        result.isExpandable = item.isExpandable;
      }
      if (typeof item.isExpanded === 'boolean') {
        result.isExpanded = item.isExpanded;
      }
      if (typeof item.isActive === 'boolean') {
        result.isActive = item.isActive;
      }
      if (typeof item.icon === 'string') {
        result.icon = item.icon;
      }
      if (typeof item.badge === 'string') {
        result.badge = item.badge;
      }
      if (Array.isArray(item.children)) {
        result.children = normalizeSidebarNavItems(item.children);
      }

      return result;
    })
    .filter((item) => item.label && typeof item.href === 'string' && item.href.length > 0);
}

/**
 * SidebarNav Adapter Component
 */
export const SidebarNavAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const base = asRecord(raw);
  const items = normalizeSidebarNavItems(base.items);
  const backLink = asRecord(base.backLink);
  const hasBackLink = typeof backLink.label === 'string' && typeof backLink.href === 'string';

  const sidebarNavContent: SidebarNavContent = {
    items,
    title: typeof base.title === 'string' ? base.title : undefined,
    currentPath: typeof base.currentPath === 'string' ? base.currentPath : undefined,
    showExpandIcons: typeof base.showExpandIcons === 'boolean' ? base.showExpandIcons : undefined,
    defaultCollapsed: typeof base.defaultCollapsed === 'boolean' ? base.defaultCollapsed : undefined,
    showBackLink: typeof base.showBackLink === 'boolean' ? base.showBackLink : undefined,
    backLink: hasBackLink ? { label: backLink.label, href: backLink.href } : undefined,
    maxDepth: typeof base.maxDepth === 'number' ? base.maxDepth : undefined,
  };

  const { variant: rawVariant, ...restProps } = props;
  const typedVariant = rawVariant as SidebarNavStyleProps['variant'];

  return (
    <SidebarNavImpl
      {...restProps}
      content={sidebarNavContent}
      variant={typedVariant}
    />
  );
};
