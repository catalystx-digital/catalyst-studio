import React from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react'
import type { SidebarNavProps, SidebarNavItem, SidebarNavStyleProps } from './sidebar-nav.types'
import { resolveSmartLinkHref } from '../../_utils/smart-link'

/**
 * Sidebar Navigation Component (Server)
 *
 * A hierarchical navigation component for "In this section" style navigation.
 * Commonly used on documentation pages, content hubs, and service pages.
 */

interface NavItemProps {
  item: SidebarNavItem
  currentPath?: string
  depth: number
  maxDepth?: number
  showExpandIcons?: boolean
}

function resolveNavHref(raw: unknown): string | undefined {
  const direct = resolveSmartLinkHref(raw)
  if (direct) return direct

  if (raw && typeof raw === 'object') {
    return resolveSmartLinkHref((raw as Record<string, unknown>).href)
  }

  return undefined
}

function NavItem({ item, currentPath, depth, maxDepth, showExpandIcons = true }: NavItemProps) {
  const href = resolveNavHref(item.href)
  if (!href) {
    return null
  }

  const isActive = currentPath === href
  const hasChildren = item.children && item.children.length > 0
  const shouldShowChildren = hasChildren && (maxDepth === undefined || depth < maxDepth)
  const isExpanded = item.isExpanded ?? true // Default to expanded

  return (
    <li className="relative">
      <a
        href={href}
        className={cn(
          'flex items-center gap-2 py-2 px-3 text-sm rounded-md transition-colors',
          'hover:bg-muted hover:text-foreground',
          isActive
            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-[2px] pl-[14px]'
            : 'text-muted-foreground',
          depth > 0 && 'pl-6'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Icon for expandable items */}
        {showExpandIcons && hasChildren && (
          <span className="flex-shrink-0 w-4 h-4">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}

        {/* Custom icon if provided */}
        {item.icon && !hasChildren && (
          <span className="flex-shrink-0 w-4 h-4 text-muted-foreground">
            {/* Icon would be rendered here based on item.icon */}
          </span>
        )}

        <span className="flex-1 truncate">{item.label}</span>

        {/* Badge */}
        {item.badge && (
          <span
            className={cn(
              'flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full',
              item.badgeVariant === 'secondary' && 'bg-secondary text-secondary-foreground',
              item.badgeVariant === 'destructive' && 'bg-destructive text-destructive-foreground',
              item.badgeVariant === 'outline' && 'border border-border text-muted-foreground',
              (!item.badgeVariant || item.badgeVariant === 'default') &&
                'bg-primary text-primary-foreground'
            )}
          >
            {item.badge}
          </span>
        )}
      </a>

      {/* Children */}
      {shouldShowChildren && isExpanded && (
        <ul className="mt-1 ml-4 border-l border-border pl-2 space-y-1">
          {item.children!.map((child, index) => (
            <NavItem
              key={`${resolveNavHref(child.href) ?? child.label}-${index}`}
              item={child}
              currentPath={currentPath}
              depth={depth + 1}
              maxDepth={maxDepth}
              showExpandIcons={showExpandIcons}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function SidebarNavServer({
  content,
  className,
  variant = 'default',
  sticky = false,
  stickyOffset = '0px'
}: SidebarNavProps & SidebarNavStyleProps) {
  const { title, items, currentPath, showExpandIcons = true, maxDepth, showBackLink, backLink } =
    content

  if (!items || items.length === 0) {
    return null
  }

  const backHref = showBackLink && backLink ? resolveNavHref(backLink.href) : undefined

  return (
    <nav
      className={cn(
        'w-full max-w-xs',
        variant === 'bordered' && 'border border-border rounded-lg p-4',
        variant === 'filled' && 'bg-muted/50 rounded-lg p-4',
        sticky && 'sticky',
        className
      )}
      style={sticky ? { top: stickyOffset } : undefined}
      aria-label={title || 'Section navigation'}
    >
      {/* Back link */}
      {showBackLink && backLink && backHref && (
        <a
          href={backHref}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLink.label}</span>
        </a>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-3 px-3">{title}</h3>
      )}

      {/* Navigation items */}
      <ul className="space-y-1" role="list">
        {items.map((item, index) => (
          <NavItem
            key={`${resolveNavHref(item.href) ?? item.label}-${index}`}
            item={item}
            currentPath={currentPath}
            depth={0}
            maxDepth={maxDepth}
            showExpandIcons={showExpandIcons}
          />
        ))}
      </ul>
    </nav>
  )
}

export default SidebarNavServer
