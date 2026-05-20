/**
 * Adapter components that wrap navigation components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { CMSComponentProps, ComponentType } from '../_core/types';
import { normalizeContentInput } from '../_core/utils';
import { NavBar as NavBarImpl } from './nav-bar';
import { Footer as FooterImpl } from './footer';
import { MobileMenu as MobileMenuImpl } from './mobile-menu';
import { Breadcrumbs as BreadcrumbsImpl } from './breadcrumbs';
import { SidebarNavServer as SidebarNavImpl } from './sidebar-nav';
import { NavBarContent, NavBarProps } from './nav-bar/nav-bar.types';
import { FooterContent, FooterProps, FooterSocialLink } from './footer/footer.types';
import { MobileMenuContent, MobileMenuProps } from './mobile-menu/mobile-menu.types';
import { BreadcrumbsContent, BreadcrumbsProps } from './breadcrumbs/breadcrumbs.types';
import { SidebarNavContent, SidebarNavProps, SidebarNavItem, SidebarNavStyleProps } from './sidebar-nav/sidebar-nav.types';
import { normalizeMenuItems } from './utils/menu-items';

/**
 * Type guard to check if content is BreadcrumbsContent
 */
function isBreadcrumbsContent(content: any): content is BreadcrumbsContent {
  return content && Array.isArray(content.items);
}

function isCMSComponentValue(value: unknown): value is CMSComponentProps {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as any).type === 'string' &&
    (typeof (value as any).content === 'object' || (value as any).content === undefined)
  );
}

/**
 * NavBar Adapter Component
 */
export const NavBarAdapter: React.FC<CMSComponentProps> = (props) => {
  // Convert generic content to NavBarContent with defaults
  const raw = normalizeContentInput(props.content);
  const base = (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {};
  const normalizedMenu = normalizeMenuItems(base.menuItems ?? base.links ?? []);
  const normalizedUtilityNav = normalizeMenuItems(base.utilityNav ?? []);

  const navBarContent: NavBarContent = {
    menuItems: normalizedMenu,
    ...(normalizedUtilityNav.length > 0 ? { utilityNav: normalizedUtilityNav } : {}),
    ...(base.logo && typeof base.logo === 'object' ? { logo: base.logo } : {}),
    ...(base.cta && typeof base.cta === 'object' ? { cta: base.cta } : {}),
    ...(typeof base.mobileBreakpoint === 'number' ? { mobileBreakpoint: base.mobileBreakpoint } : {}),
    ...(typeof base.sticky === 'boolean' ? { sticky: base.sticky } : {}),
    ...(typeof base.transparent === 'boolean' ? { transparent: base.transparent } : {}),
    ...(base.layout === 'single-row' || base.layout === 'multi-row' ? { layout: base.layout } : {})
  };

  if (navBarContent.menuItems.length === 0) {
    navBarContent.menuItems = [];
  }
  if (!navBarContent.logo) {
    navBarContent.logo = { text: 'Logo', href: '/' };
  }

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
  // Convert generic content to FooterContent with defaults
  const raw = normalizeContentInput(props.content);
  const base = (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {};

  const columnsSource: unknown[] = Array.isArray(base.columns) ? base.columns : []

  const columns: FooterContent['columns'] = [];
  if (columnsSource.length > 0) {
    for (const rawColumn of columnsSource) {
      if (isCMSComponentValue(rawColumn) && rawColumn.type === ComponentType.ColumnItem) {
        const columnContent = normalizeContentInput(rawColumn.content) as Record<string, unknown> | undefined;
        const title =
          typeof columnContent?.title === 'string'
            ? columnContent.title
            : typeof columnContent?.heading === 'string'
              ? columnContent.heading
              : undefined;
        const links = normalizeMenuItems(columnContent?.links ?? columnContent?.items ?? []);

        if (!title && links.length === 0) {
          continue;
        }

        columns.push({
          title,
          links
        });
        continue;
      }

      const column = rawColumn as Record<string, unknown>;
      const title =
        typeof column?.title === 'string'
          ? column.title
          : typeof column?.heading === 'string'
            ? column.heading
            : undefined;
      const links = normalizeMenuItems(column?.links ?? column?.items ?? []);

      if (!title && links.length === 0) {
        continue;
      }

      columns.push({
        title,
        links
      });
    }
  }

  const legalLinks = normalizeMenuItems(base.legalLinks ?? base.legal ?? []);
  const socialLinksSource: unknown[] = Array.isArray(base.socialLinks) ? base.socialLinks : [];
  const allowedSocialPlatforms: FooterSocialLink['platform'][] = [
    'facebook',
    'twitter',
    'linkedin',
    'instagram',
    'youtube',
    'github'
  ];
  const socialLinks: FooterContent['socialLinks'] = [];
  if (socialLinksSource.length > 0) {
    for (const rawSocial of socialLinksSource) {
      if (isCMSComponentValue(rawSocial) && rawSocial.type === ComponentType.SocialLinkItem) {
        // Try to get data from content first, fall back to root level properties
        const socialContent = normalizeContentInput(rawSocial.content) as Record<string, unknown> | undefined;
        const rawObj = rawSocial as unknown as Record<string, unknown>;
        const platformRaw = (
          typeof socialContent?.platform === 'string' ? socialContent.platform :
          typeof rawObj.platform === 'string' ? rawObj.platform : undefined
        )?.toLowerCase();
        const url = (
          typeof socialContent?.url === 'string' ? socialContent.url :
          typeof rawObj.url === 'string' ? rawObj.url : undefined
        );
        if (!platformRaw || !url) {
          continue;
        }
        if (!allowedSocialPlatforms.includes(platformRaw as FooterSocialLink['platform'])) {
          continue;
        }
        const label =
          typeof socialContent?.label === 'string'
            ? socialContent.label
            : typeof rawObj.label === 'string'
              ? rawObj.label
              : undefined;
        socialLinks.push({
          platform: platformRaw as FooterSocialLink['platform'],
          url,
          label
        });
        continue;
      }

      if (rawSocial && typeof rawSocial === 'object') {
        const obj = rawSocial as Record<string, unknown>;
        const platformRaw = typeof obj.platform === 'string' ? obj.platform.toLowerCase() : undefined;
        const url = typeof obj.url === 'string' ? obj.url : undefined;
        if (!platformRaw || !url) {
          continue;
        }
        if (!allowedSocialPlatforms.includes(platformRaw as FooterSocialLink['platform'])) {
          continue;
        }
        socialLinks.push({
          platform: platformRaw as FooterSocialLink['platform'],
          url,
          label: typeof obj.label === 'string' ? obj.label : undefined
        });
      }
    }
  }

  const footerContent: FooterContent = {
    columns,
    ...(typeof base.logo === 'string' ? { logo: base.logo } : {}),
    ...(typeof base.logoAlt === 'string' ? { logoAlt: base.logoAlt } : {}),
    ...(typeof base.description === 'string' ? { description: base.description } : {}),
    ...(socialLinks.length > 0 ? { socialLinks } : {}),
    legalLinks,
    ...(typeof base.newsletter === 'object' ? { newsletter: base.newsletter } : {}),
    copyright: typeof base.copyright === 'string'
      ? base.copyright
      : `© ${new Date().getFullYear()} Company. All rights reserved.`,
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
  // Convert generic content to MobileMenuContent with defaults
  const raw = normalizeContentInput(props.content);
  const base = (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {};
  const normalizedMenu = normalizeMenuItems(base.menuItems ?? base.links ?? base.items ?? []);

  const mobileMenuContent: MobileMenuContent = {
    menuItems: normalizedMenu,
    position: base.position === 'right' ? 'right' : 'left',
    animation: base.animation === 'fade' ? 'fade' : 'slide'
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
  const raw = normalizeContentInput(props.content);
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
 * Type guard to check if content is SidebarNavContent
 */
function isSidebarNavContent(content: any): content is SidebarNavContent {
  return content && Array.isArray(content.items);
}

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
      const label = typeof item.label === 'string' ? item.label : typeof item.text === 'string' ? item.text : '';
      const href = typeof item.href === 'string' ? item.href : typeof item.url === 'string' ? item.url : '#';

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
    .filter((item) => item.label); // Filter out items without labels
}

/**
 * SidebarNav Adapter Component
 */
export const SidebarNavAdapter: React.FC<CMSComponentProps> = (props) => {
  // Convert generic content to SidebarNavContent with defaults
  const raw = normalizeContentInput(props.content);

  let sidebarNavContent: SidebarNavContent;

  if (isSidebarNavContent(raw)) {
    sidebarNavContent = raw as SidebarNavContent;
  } else {
    const base = (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {};
    const items = normalizeSidebarNavItems(base.items ?? base.links ?? base.menuItems ?? []);

    sidebarNavContent = {
      items,
      title: typeof base.title === 'string' ? base.title : undefined,
      currentPath: typeof base.currentPath === 'string' ? base.currentPath : undefined,
      showExpandIcons: typeof base.showExpandIcons === 'boolean' ? base.showExpandIcons : true,
      defaultCollapsed: typeof base.defaultCollapsed === 'boolean' ? base.defaultCollapsed : false,
      showBackLink: typeof base.showBackLink === 'boolean' ? base.showBackLink : false,
      backLink: base.backLink && typeof base.backLink === 'object' ? {
        label: typeof base.backLink.label === 'string' ? base.backLink.label : 'Back',
        href: typeof base.backLink.href === 'string' ? base.backLink.href : '/'
      } : undefined,
      maxDepth: typeof base.maxDepth === 'number' ? base.maxDepth : undefined,
    };
  }

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
