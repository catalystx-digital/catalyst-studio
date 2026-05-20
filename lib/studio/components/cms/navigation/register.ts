import { CMSComponentFactory } from '../_factory/factory';
import { ComponentType } from '../_core/types';

// Import adapter components
import {
  NavBarAdapter,
  FooterAdapter,
  MobileMenuAdapter,
  BreadcrumbsAdapter,
  SidebarNavAdapter
} from './adapters';

// Import helpers and definitions
import { detectionToAIMetadata } from '../_core/component-definition';
import { NavBarDef } from './nav-bar/nav-bar.def';
import { FooterDef } from './footer/footer.def';
import { MobileMenuDef } from './mobile-menu/mobile-menu.def';
import { BreadcrumbsDef } from './breadcrumbs/breadcrumbs.def';
import { NavMenuItemDef } from './nav-menu-item/nav-menu-item.def';
import { SidebarNavDef } from './sidebar-nav/sidebar-nav.def';
import { SideMenuDef } from './sidemenu/sidemenu.def';
import Placeholder from '../_placeholder/placeholder';

/**
 * Register all navigation components with the factory
 * Uses adapter components to ensure type compatibility with CMSComponentProps
 */
export function registerNavigationComponents(): void {
  const factory = CMSComponentFactory.getInstance();

  factory.registerComponents([
    {
      type: ComponentType.NavBar,
      component: NavBarAdapter,
      metadata: detectionToAIMetadata(NavBarDef.detection!, ComponentType.NavBar),
      schema: NavBarDef.schema,
      description: NavBarDef.description
    },
    {
      type: ComponentType.Footer,
      component: FooterAdapter,
      metadata: detectionToAIMetadata(FooterDef.detection!, ComponentType.Footer),
      schema: FooterDef.schema,
      description: FooterDef.description
    },
    {
      type: ComponentType.MobileMenu,
      component: MobileMenuAdapter,
      metadata: detectionToAIMetadata(MobileMenuDef.detection!, ComponentType.MobileMenu),
      schema: MobileMenuDef.schema,
      description: MobileMenuDef.description
    },
    {
      type: ComponentType.Breadcrumbs,
      component: BreadcrumbsAdapter,
      metadata: detectionToAIMetadata(BreadcrumbsDef.detection!, ComponentType.Breadcrumbs),
      schema: BreadcrumbsDef.schema,
      description: BreadcrumbsDef.description
    },
    {
      type: ComponentType.NavMenuItem,
      component: Placeholder as any,
      metadata: detectionToAIMetadata(NavMenuItemDef.detection!, ComponentType.NavMenuItem),
      schema: NavMenuItemDef.schema,
      description: NavMenuItemDef.description,
      subOnly: true
    },
    // ColumnItem and SocialLinkItem were removed - they're defined inline in Footer schema
    // SidebarNav component (sidebar-nav type)
    {
      type: ComponentType.SidebarNav,
      component: SidebarNavAdapter,
      metadata: detectionToAIMetadata(SidebarNavDef.detection!, ComponentType.SidebarNav),
      schema: SidebarNavDef.schema,
      description: SidebarNavDef.description
    },
    // SideMenu component (sidemenu type) - uses sections-based schema
    {
      type: ComponentType.SideMenu,
      component: SidebarNavAdapter,
      metadata: detectionToAIMetadata(SideMenuDef.detection!, ComponentType.SideMenu),
      schema: SideMenuDef.schema,
      description: SideMenuDef.description
    }
  ]);

}

// Auto-register when imported
registerNavigationComponents();
