/**
 * Sidebar Navigation Component
 *
 * Hierarchical "In this section" navigation for documentation and content pages.
 *
 * @example
 * ```tsx
 * import { SidebarNav } from '@/lib/studio/components/cms/navigation/sidebar-nav'
 *
 * <SidebarNav
 *   content={{
 *     title: "In this section",
 *     items: [
 *       { label: "Overview", href: "/docs/overview" },
 *       {
 *         label: "Getting Started",
 *         href: "/docs/getting-started",
 *         children: [
 *           { label: "Installation", href: "/docs/getting-started/installation" },
 *           { label: "Configuration", href: "/docs/getting-started/configuration" }
 *         ]
 *       }
 *     ],
 *     currentPath: "/docs/getting-started/installation"
 *   }}
 * />
 * ```
 */

export { SidebarNavServer, SidebarNavServer as SidebarNav } from './sidebar-nav.server'
export { SidebarNavClient } from './sidebar-nav.client'
export type {
  SidebarNavProps,
  SidebarNavContent,
  SidebarNavItem,
  SidebarNavVariant,
  SidebarNavStyleProps
} from './sidebar-nav.types'

// Default export for dynamic imports
export { SidebarNavServer as default } from './sidebar-nav.server'
