'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react'
import type { SidebarNavProps, SidebarNavItem, SidebarNavStyleProps } from './sidebar-nav.types'
import { resolveSmartLinkHref } from '../../_utils/smart-link'

/**
 * Sidebar Navigation Component (Client)
 *
 * Interactive version with collapsible sections and keyboard navigation.
 */

interface NavItemProps {
  item: SidebarNavItem
  currentPath?: string
  depth: number
  maxDepth?: number
  showExpandIcons?: boolean
  onToggle?: (href: string) => void
  expandedItems: Set<string>
}

function resolveNavHref(raw: unknown): string | undefined {
  const direct = resolveSmartLinkHref(raw)
  if (direct) return direct

  if (raw && typeof raw === 'object') {
    return resolveSmartLinkHref((raw as Record<string, unknown>).href)
  }

  return undefined
}

function NavItem({
  item,
  currentPath,
  depth,
  maxDepth,
  showExpandIcons = true,
  onToggle,
  expandedItems
}: NavItemProps) {
  const href = resolveNavHref(item.href)
  if (!href) {
    return null
  }

  const isActive = currentPath === href
  const hasChildren = item.children && item.children.length > 0
  const shouldShowChildren = hasChildren && (maxDepth === undefined || depth < maxDepth)
  const isExpanded = expandedItems.has(href)

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      if (hasChildren && onToggle) {
        e.preventDefault()
        onToggle(href)
      }
    },
    [hasChildren, onToggle, href]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (hasChildren && onToggle && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onToggle(href)
      }
    },
    [hasChildren, onToggle, href]
  )

  return (
    <li className="relative">
      <a
        href={href}
        onClick={hasChildren ? handleToggle : undefined}
        onKeyDown={hasChildren ? handleKeyDown : undefined}
        className={cn(
          'relative flex items-center gap-2 py-2 px-3 text-sm rounded-md transition-colors duration-200',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive
            ? 'bg-primary/10 text-primary font-medium before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary before:rounded-r'
            : 'text-muted-foreground',
          depth > 0 && 'pl-6'
        )}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {/* Icon for expandable items */}
        {showExpandIcons && hasChildren && (
          <span
            className="flex-shrink-0 w-4 h-4 cursor-pointer"
            onClick={handleToggle}
            role="button"
            tabIndex={0}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 transition-transform" />
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

      {/* Children with collapse animation */}
      {shouldShowChildren && (
        <div
          className={cn(
            'overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out',
            isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <ul className="mt-1 ml-4 border-l border-border pl-2 space-y-1">
            {item.children!.map((child, index) => (
              <NavItem
                key={`${resolveNavHref(child.href) ?? child.label}-${index}`}
                item={child}
                currentPath={currentPath}
                depth={depth + 1}
                maxDepth={maxDepth}
                showExpandIcons={showExpandIcons}
                onToggle={onToggle}
                expandedItems={expandedItems}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

/**
 * Recursively collects all expandable item hrefs
 */
function collectExpandableItems(items: SidebarNavItem[]): string[] {
  const result: string[] = []
  for (const item of items) {
    const href = resolveNavHref(item.href)
    if (item.children && item.children.length > 0) {
      if (href) {
        result.push(href)
      }
      result.push(...collectExpandableItems(item.children))
    }
  }
  return result
}

export function SidebarNavClient({
  content,
  className,
  variant = 'default',
  sticky = false,
  stickyOffset = '0px'
}: SidebarNavProps & SidebarNavStyleProps) {
  const {
    title,
    items,
    currentPath,
    showExpandIcons = true,
    maxDepth,
    showBackLink,
    backLink,
    defaultCollapsed = false
  } = content

  // Initialize expanded state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    if (defaultCollapsed) {
      return new Set<string>()
    }
    // Default to all items expanded
    return new Set(collectExpandableItems(items))
  })

  // Auto-expand parent items when currentPath changes
  useEffect(() => {
    if (currentPath) {
      // Find and expand all parent items of the current path
      const findParents = (
        searchItems: SidebarNavItem[],
        target: string,
        parents: string[] = []
      ): string[] | null => {
        for (const item of searchItems) {
          const href = resolveNavHref(item.href)
          if (href === target) {
            return parents
          }
          if (item.children) {
            const found = findParents(item.children, target, href ? [...parents, href] : parents)
            if (found) {
              return found
            }
          }
        }
        return null
      }

      const parents = findParents(items, currentPath)
      if (parents && parents.length > 0) {
        setExpandedItems((prev) => {
          const next = new Set(prev)
          parents.forEach((p) => next.add(p))
          return next
        })
      }
    }
  }, [currentPath, items])

  const handleToggle = useCallback((href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(href)) {
        next.delete(href)
      } else {
        next.add(href)
      }
      return next
    })
  }, [])

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
      {title && <h3 className="text-sm font-semibold text-foreground mb-3 px-3">{title}</h3>}

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
            onToggle={handleToggle}
            expandedItems={expandedItems}
          />
        ))}
      </ul>
    </nav>
  )
}

export default SidebarNavClient
