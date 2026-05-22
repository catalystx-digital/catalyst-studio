'use client';

/**
 * Pages Panel
 *
 * Panel content showing the page tree with search functionality.
 * Integrates with the site-builder store for page data.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  FileText,
  Home,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store';
import type { ProfessionalNodeData } from '@/lib/studio/components/site-builder/professional-nodes';

interface PagesPanelProps {
  onSelectPage?: (pageId: string) => void;
}

interface PageNode {
  id: string;
  label: string;
  slug?: string;
  status?: 'ready' | 'draft' | 'processing' | 'error';
  isHome?: boolean;
  parentId?: string | null;
  children: PageNode[];
  depth: number;
  componentsCount: number;
  weight: number;
}

function getStatusIcon(status?: string) {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case 'processing':
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    case 'error':
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function getStatusLabel(status?: string) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'processing':
      return 'Processing';
    case 'error':
      return 'Error';
    default:
      return 'Draft';
  }
}

export function PagesPanel({ onSelectPage }: PagesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes, isLoading } = useSiteBuilderStore();

  // Build hierarchical page tree from flat nodes
  const pageTree = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];

    // Map nodes to PageNode structure
    const nodeMap = new Map<string, PageNode>();
    const rootNodes: PageNode[] = [];

    // First pass: create all nodes
    nodes.forEach((node) => {
      const data = node.data as ProfessionalNodeData;
      const metadata = data?.metadata as Record<string, unknown> | undefined;

      // Determine status
      let status: PageNode['status'] = 'draft';
      const metadataStatus = metadata?.status as string | undefined;
      if (metadataStatus) {
        if (metadataStatus === 'ready' || metadataStatus === 'import-ready') {
          status = 'ready';
        } else if (metadataStatus.includes('processing')) {
          status = 'processing';
        } else if (metadataStatus.includes('error') || metadataStatus.includes('failed')) {
          status = 'error';
        }
      }

      // Check if home page
      const nodeDataRecord = data as unknown as Record<string, unknown>;
      const slug = nodeDataRecord.slug as string | undefined;
      const isHome = slug === '' || slug === '/' ||
        data?.label?.toLowerCase() === 'home' ||
        node.id === 'home';

      const pageNode: PageNode = {
        id: node.id,
        label: data?.label || 'Untitled Page',
        slug: slug || `/${node.id}`,
        status,
        isHome,
        parentId: nodeDataRecord.parentId as string | null ?? null,
        children: [],
        depth: 0,
        componentsCount: Array.isArray(data?.components) ? data.components.length : 0,
        weight: nodeDataRecord.weight as number ?? 0,
      };

      nodeMap.set(node.id, pageNode);
    });

    // Second pass: build hierarchy
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Sort: home first, then by weight, then alphabetically as fallback
    const sortNodes = (nodes: PageNode[]): PageNode[] => {
      return nodes.sort((a, b) => {
        if (a.isHome && !b.isHome) return -1;
        if (!a.isHome && b.isHome) return 1;
        // Sort by weight (lower weight = higher priority)
        if (a.weight !== b.weight) return a.weight - b.weight;
        // Fallback to alphabetical
        return a.label.localeCompare(b.label);
      }).map(node => ({
        ...node,
        children: sortNodes(node.children),
      }));
    };

    return sortNodes(rootNodes);
  }, [nodes]);

  // Filter pages based on search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return pageTree;

    const query = searchQuery.toLowerCase();

    const filterNode = (node: PageNode): PageNode | null => {
      const matchesQuery =
        node.label.toLowerCase().includes(query) ||
        node.slug?.toLowerCase().includes(query);

      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is PageNode => n !== null);

      if (matchesQuery || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    };

    return pageTree
      .map(filterNode)
      .filter((n): n is PageNode => n !== null);
  }, [pageTree, searchQuery]);

  // Expand all when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const allIds = new Set<string>();
      const collectIds = (nodes: PageNode[]) => {
        nodes.forEach(node => {
          allIds.add(node.id);
          collectIds(node.children);
        });
      };
      collectIds(filteredTree);
      setExpandedNodes(allIds);
    }
  }, [searchQuery, filteredTree]);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelectPage = useCallback((pageId: string) => {
    setSelectedNodeId(pageId);
    onSelectPage?.(pageId);

    // Dispatch event for canvas to focus on this node
    window.dispatchEvent(new CustomEvent('sitebuilder:focus-node', {
      detail: { nodeId: pageId },
    }));
  }, [onSelectPage]);

  // Handle Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.getElementById('pages-panel-search');
        searchInput?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderPageNode = (node: PageNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
            'hover:bg-accent',
            isSelected && 'bg-primary/10 text-primary'
          )}
          style={{ paddingLeft: `${8 + node.depth * 16}px` }}
          onClick={() => handleSelectPage(node.id)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <span className="w-5" />
          )}

          {/* Page Icon */}
          {node.isHome ? (
            <Home className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}

          {/* Page Label */}
          <span className="flex-1 text-sm truncate">
            {node.label}
          </span>

          {/* Status Indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-shrink-0">
                  {getStatusIcon(node.status)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{getStatusLabel(node.status)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(renderPageNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="pages-panel-search"
            type="search"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-16 h-9 text-sm"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Page Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No pages found' : 'No pages yet'}
              </p>
            </div>
          ) : (
            filteredTree.map(renderPageNode)
          )}
        </div>
      </ScrollArea>

    </div>
  );
}
