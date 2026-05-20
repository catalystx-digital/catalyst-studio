/**
 * Sidebar Navigation Component Types
 *
 * For "In this section" style navigation commonly found on documentation
 * and content-heavy pages.
 */

import { CMSComponentProps } from '../../_core/types'
import { type Link } from '../../_core/value-objects'

/**
 * A single navigation item in the sidebar
 */
export interface SidebarNavItem {
  /** Display label for the navigation item */
  label: string
  /** Link destination */
  href: Link | string
  /** Whether this item can be expanded to show children */
  isExpandable?: boolean
  /** Whether this item is currently expanded */
  isExpanded?: boolean
  /** Child navigation items */
  children?: SidebarNavItem[]
  /** Icon name or component (optional) */
  icon?: string
  /** Whether this item is currently active/selected */
  isActive?: boolean
  /** Badge text to show next to the item (e.g., "New", "3") */
  badge?: string
  /** Badge variant for styling */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

/**
 * Content structure for the Sidebar Navigation component
 */
export interface SidebarNavContent {
  /** Optional title for the sidebar section (e.g., "In this section") */
  title?: string
  /** Navigation items */
  items: SidebarNavItem[]
  /** Current path to highlight active items */
  currentPath?: string
  /** Whether to show expand/collapse icons */
  showExpandIcons?: boolean
  /** Whether to collapse all items by default */
  defaultCollapsed?: boolean
  /** Whether to show the back/up navigation link */
  showBackLink?: boolean
  /** Back link configuration */
  backLink?: {
    label: string
    href: Link | string
  }
  /** Maximum depth to show (default: unlimited) */
  maxDepth?: number
}

/**
 * Props for the Sidebar Navigation component
 */
export interface SidebarNavProps extends CMSComponentProps {
  content: SidebarNavContent
}

/**
 * Style variants for the sidebar
 */
export type SidebarNavVariant = 'default' | 'minimal' | 'bordered' | 'filled'

/**
 * Props for styling customization
 */
export interface SidebarNavStyleProps {
  variant?: SidebarNavVariant
  /** Whether to use sticky positioning */
  sticky?: boolean
  /** Top offset for sticky positioning (e.g., "64px" for fixed header) */
  stickyOffset?: string
  /** Custom class name */
  className?: string
}
