'use client'

import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { RefreshCw, Sparkles, Copy, Trash2, Settings } from 'lucide-react'

export type PageContextMenuAction = 'reimport' | 'improve-ai' | 'duplicate' | 'delete' | 'settings'

interface PageContextMenuProps {
  children: React.ReactNode
  nodeId: string
  onAction?: (nodeId: string, action: PageContextMenuAction) => void
}

/**
 * Context menu for page nodes in the site builder.
 * Provides quick access to common page operations via right-click.
 *
 * Actions:
 * - Re-import: Fetch fresh content from source URL
 * - Improve via AI: Use AI to enhance page content/structure
 * - Duplicate: Create a copy of the page
 * - Delete: Remove the page
 * - Settings: Open page configuration
 */
export function PageContextMenu({ children, nodeId, onAction }: PageContextMenuProps) {
  const handleAction = (action: PageContextMenuAction) => {
    if (onAction) {
      onAction(nodeId, action)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() => handleAction('reimport')}
          className="cursor-pointer"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Re-import this page
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleAction('improve-ai')}
          className="cursor-pointer"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Improve via AI
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => handleAction('duplicate')}
          className="cursor-pointer"
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate page
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => handleAction('delete')}
          className="cursor-pointer text-red-500 focus:text-red-500"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete page
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => handleAction('settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Page settings
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
