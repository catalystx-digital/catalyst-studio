'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { isHomeLike, isHomeNode } from '@/lib/studio/utils/home-page-utils'
import { useAutoSave } from '@/lib/studio/hooks/use-auto-save'
import { useUndoRedoShortcuts } from '@/lib/studio/hooks/use-undo-redo-shortcuts'
import { useImportHydration } from '@/lib/studio/hooks/use-import-hydration'
import { useGreenfieldHydration } from '@/lib/studio/hooks/use-greenfield-hydration'
import { useViewportSync } from '@/lib/studio/hooks/use-viewport-sync'
import { SaveStatusIndicator } from '@/lib/studio/components/site-builder/save-status-indicator'
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './site-builder-print.css'

import { professionalNodeTypes, ProfessionalNodeData } from '@/lib/studio/components/site-builder/professional-nodes'
import type { PageContextMenuAction } from '@/lib/studio/components/site-builder/page-context-menu'
import { buildPlaceholderGraph, toReactFlowPlaceholders } from '@/lib/studio/components/site-builder/utils/placeholder-graph'
import type { ComponentData } from '@/lib/studio/components/site-builder/types'
import { ComponentInstance, resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'
import { KeyboardShortcutsHelp } from '@/lib/studio/components/site-builder/keyboard-shortcuts-help'
import { TutorialOverlay } from '@/lib/studio/components/site-builder/tutorial-overlay'
import { useFirstVisit } from '@/lib/studio/hooks/use-first-visit'
import { CommentsSystem } from '@/lib/studio/components/site-builder/comments-system'
import { VersionHistory } from '@/lib/studio/components/site-builder/version-history'
import { AISuggestionsEnhanced } from '@/lib/studio/components/site-builder/ai-suggestions-enhanced'
import { GlobalSectionsLibrary } from '@/lib/studio/components/site-builder/global-sections-library'
import { VirtualCanvas } from '@/lib/studio/components/site-builder/virtual-canvas'
import { PerformanceStatsPanel } from '@/lib/studio/components/site-builder/performance-stats-panel'
import { ResponsiveWrapper } from '@/lib/studio/components/site-builder/responsive-wrapper'
import { SectionPicker } from '@/lib/studio/components/site-builder/section-picker'
import { AssistantSurface, type AssistantScope } from '@/lib/studio/components/site-builder/assistant-surface'
import { PropertyEditorPanel } from '@/lib/studio/components/site-builder/property-editor/PropertyEditorPanel'
import { ComponentPropertiesPanel } from '@/lib/studio/components/site-builder/ComponentPropertiesPanel'
import { AddPagePanel } from '@/lib/studio/components/site-builder/add-page-panel'
import { useSiteBuilderPerformance } from '@/lib/studio/hooks/use-site-builder-performance'
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'
import { ErrorBoundary } from '@/components/error-boundary'
import { KeyboardNavigation } from '@/lib/studio/components/site-builder/keyboard-navigation'
import { DeleteConfirmationDialog } from '@/lib/studio/components/site-builder/dialogs/DeleteConfirmationDialog'
import { AIImprovementDialog } from '@/lib/studio/components/site-builder/dialogs/AIImprovementDialog'
import { MultiSelectControls } from '@/lib/studio/components/site-builder/controls/MultiSelectControls'
import { applyAutoLayout, isLargeSite } from '@/lib/studio/components/site-builder/auto-layout'
import { LAYOUT } from '@/lib/studio/constants/layout-constants'
import { DesignSystemCanvasInjector } from '@/lib/studio/components/site-builder/design-system-canvas-injector'
import { ProposalExportDialog } from '@/lib/studio/components/site-builder/proposal-export/proposal-export-dialog'
import { SearchOverlay } from '@/lib/studio/components/site-builder/search/search-overlay'
import { useSearchKeyboardShortcuts } from '@/lib/studio/hooks/use-search-keyboard-shortcuts'
import { useJumpToNode } from '@/lib/studio/hooks/use-jump-to-node'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import {
  CheckCircle2,
  Copy,
  Edit2,
  ChevronDown,
  Move,
  Search,
  Link2,
  Layers,
  FolderPlus,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react'

import { saveManager } from '@/lib/studio/components/site-builder/save-manager'
import { ReImportDialog } from '@/lib/studio/components/site-builder/reimport-dialog'

type NodeMetadataShape = NonNullable<ProfessionalNodeData['metadata']>
type NodeMetadataStatus = NodeMetadataShape['status']
type NodeImportStatus = NodeMetadataShape['importStatus']
type MutableMetadata = NodeMetadataShape & Record<string, any>

interface SitemapMetadataSnapshot extends Record<string, unknown> {
  ordered?: string[]
  completed?: string[]
  processing?: string[]
  pending?: string[]
}

const ensureComponentInstances = (components: ProfessionalNodeData['components']): ComponentInstance[] => {
  if (!Array.isArray(components)) {
    return []
  }
  if (components.every((item) => typeof (item as ComponentInstance).id === 'string')) {
    return components as ComponentInstance[]
  }

  return (components as ComponentData[]).map((component, index) => {
    const fallbackId = component.id ?? `component-${index}-${Date.now()}`
    const fallbackType = component.type ?? 'unknown'
    const parentId = component.parentId ?? null
    const position = component.position ?? index
    const props = component.props ?? {}
    const content = (component as { content?: unknown }).content ?? (props as { content?: unknown }).content ?? {}
    const styles = (component as { styles?: unknown }).styles ?? (props as { styles?: unknown }).styles ?? {}
    const metadata = (component as { metadata?: unknown }).metadata ?? (props as { metadata?: unknown }).metadata ?? {}

    return {
      id: fallbackId,
      type: fallbackType,
      parentId,
      position,
      props,
      content: typeof content === 'object' && content !== null ? (content as Record<string, unknown>) : {},
      styles: typeof styles === 'object' && styles !== null ? (styles as Record<string, unknown>) : {},
      metadata: typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>) : {},
      globalComponentId: resolveSharedComponentReference(component as ComponentInstance) ?? undefined,
    }
  })
}

interface AdvancedFiltersState {
  seoScoreMin: number
  seoScoreMax: number
  pageType: string
  dateRange: string
  author: string
  hasComments: boolean
  hasComponents: boolean
}


const slugifyTitle = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page'
}

const createUniqueSlug = (title: string, existingSlugs: Set<string>): string => {
  const base = slugifyTitle(title)
  if (!existingSlugs.has(base)) {
    return base
  }

  let counter = 2
  let candidate = `${base}-${counter}`
  while (existingSlugs.has(candidate)) {
    counter += 1
    candidate = `${base}-${counter}`
  }

  return candidate
}

const PLACEHOLDER_EDGE_STYLE = {
  stroke: 'rgba(148, 163, 184, 0.6)',
  strokeDasharray: '4 4',
} as const

const PLACEHOLDER_EDGE_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 16,
  height: 16,
  color: 'rgba(148, 163, 184, 0.8)',
} as const

// Demo data removed - will load from store
// const initialNodes: Node<ProfessionalNodeData>[] = [...]
// const initialEdges: Edge[] = [...]

/**
 * SearchOverlayWithShortcuts
 * Wrapper component that integrates search overlay with keyboard shortcuts
 * Must be used inside ReactFlowProvider
 */
const SearchOverlayWithShortcuts: React.FC = () => {
  const { jumpToHome } = useJumpToNode()

  // Enable keyboard shortcuts for search (Ctrl+K to open, Ctrl+H to jump to home)
  useSearchKeyboardShortcuts({
    enabled: true,
    onJumpToHome: jumpToHome,
  })

  return <SearchOverlay />
}

interface SitemapFlowProps {
  componentPanelOpen: boolean
  setComponentPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SitemapFlow: React.FC<SitemapFlowProps> = ({
  componentPanelOpen,
  setComponentPanelOpen,
}) => {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    fitView,
    zoomTo,
    getZoom,
    setCenter,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getViewport,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getNodes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setNodes: rfSetNodes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setEdges: rfSetEdges
  } = useReactFlow()

  // Jump to node hook for focus-node event
  const { jumpToNode } = useJumpToNode()

  // Get websiteId from URL params, default
  const websiteId = searchParams.get('websiteId')
  const conceptId = searchParams.get('conceptId') ?? undefined
  
  const importJobIdParam = searchParams.get('importJobId')
  const importJobs = useImportTrackerStore((state) => state.jobs)
  const currentImportJob = useMemo(() => {
    if (!websiteId) return undefined
    if (importJobIdParam) {
      return importJobs.find((job) => job.id === importJobIdParam)
    }
    return importJobs.find((job) => job.websiteId === websiteId)
  }, [importJobs, importJobIdParam, websiteId])
  const [lastImportSync, setLastImportSync] = useState<{ jobId: string; status: string; progress: number; processedCount?: number } | null>(null)

  useEffect(() => {
    setLastImportSync(null)
  }, [websiteId])


  // Helper to dispatch zoom change event to sync bottom bar
  const dispatchZoomChange = useCallback((zoom: number) => {
    window.dispatchEvent(new CustomEvent('sitebuilder:zoom-change', {
      detail: { zoom },
    }));
  }, []);

  useEffect(() => {
    const handleFitViewRequest = () => {
      fitView({ padding: 0.2 });
      // Dispatch zoom change after fit view completes
      setTimeout(() => dispatchZoomChange(getZoom()), 100);
    };

    const handleZoomIn = () => {
      const currentZoom = getZoom();
      const newZoom = Math.min(currentZoom * 1.2, 4);
      zoomTo(newZoom);
      dispatchZoomChange(newZoom);
    };

    const handleZoomOut = () => {
      const currentZoom = getZoom();
      const newZoom = Math.max(currentZoom * 0.8, 0.1);
      zoomTo(newZoom);
      dispatchZoomChange(newZoom);
    };

    const handleZoomTo = (event: CustomEvent<{ zoom: number }>) => {
      zoomTo(event.detail.zoom);
      dispatchZoomChange(event.detail.zoom);
    };

    window.addEventListener('sitebuilder:fit-view', handleFitViewRequest);
    window.addEventListener('sitebuilder:zoom-in', handleZoomIn);
    window.addEventListener('sitebuilder:zoom-out', handleZoomOut);
    window.addEventListener('sitebuilder:zoom-to', handleZoomTo as EventListener);

    return () => {
      window.removeEventListener('sitebuilder:fit-view', handleFitViewRequest);
      window.removeEventListener('sitebuilder:zoom-in', handleZoomIn);
      window.removeEventListener('sitebuilder:zoom-out', handleZoomOut);
      window.removeEventListener('sitebuilder:zoom-to', handleZoomTo as EventListener);
    };
  }, [fitView, getZoom, zoomTo, dispatchZoomChange]);
  // Use database-connected store instead of local state
  const {
    nodes: storeNodes,
    edges: storeEdges,
    isLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    saveStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    errorState,
    loadStructure,
    addNode: storeAddNode,
    updateNode: storeUpdateNode,
    deleteNodes: storeDeleteNodes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    moveNode: storeMoveNode,
    undo: storeUndo,
    redo: storeRedo,
    canUndo,
    canRedo,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSaveStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onNodesChange: storeOnNodesChange,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onEdgesChange: storeOnEdgesChange,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onConnect: storeOnConnect,
    propertyPanelState,
    openPropertyPanel,
    closePropertyPanel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPropertyPanelTab,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPropertyPanelScrollPosition,
    setSelectedComponentId,
    pageTypes,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pageTypesLoaded,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pageTypesLoading,
    viewportSyncEnabled,
    updateComponentInNode,
  } = useSiteBuilderStore()

  // Enable auto-save
  useAutoSave()

  // Enable keyboard shortcuts for undo/redo
  useUndoRedoShortcuts()

  // Viewport sync for large sites
  const viewportSyncConditions = {
    hasWebsiteId: !!websiteId,
    notLoading: !isLoading,
    viewportSyncEnabled,
    finalEnabled: !!websiteId && !isLoading && viewportSyncEnabled,
  }
  console.log('[SiteBuilder] Viewport sync conditions:', viewportSyncConditions)

  const {
    isLoading: isViewportLoading,
    loadingRegion,
    stats: viewportStats,
    clearCache: clearViewportCache,
  } = useViewportSync({
    websiteId: websiteId || '',
    debounceMs: 150,
    bufferPx: 250,
    enabled: viewportSyncConditions.finalEnabled,
  })
  
  // Transform store nodes to match ProfessionalNodeData format
  const importStatusMap = useMemo(() => {
    const rawPages = currentImportJob?.metadata?.pages;
    if (!Array.isArray(rawPages)) {
      return new Map<string, { status: string; order?: number }>()
    }
    const pairs = rawPages
      .filter((page): page is { url: string; status?: string; order?: number } => Boolean(page && typeof page.url === 'string'))
      .map(page => {
        const rawStatus = typeof page.status === 'string' ? page.status.trim().toLowerCase() : 'pending'
        const normalizedStatus = rawStatus.startsWith('import-') ? rawStatus.replace('import-', '') : rawStatus
        return {
          url: page.url,
          status: normalizedStatus,
          order: page.order,
        }
      })
    return new Map(pairs.map(item => [item.url, { status: item.status, order: item.order }]))
  }, [currentImportJob?.metadata?.pages])

  const transformedStoreNodes = useMemo(() => {
    // Log first node's _detailLevel from storeNodes
    const firstNode = storeNodes[0];
    const firstNodeDetailLevel = (firstNode?.data as unknown as Record<string, unknown>)?._detailLevel;
    console.log('[TransformedStoreNodes] Computing, storeNodes count:', storeNodes.length, 'first node _detailLevel:', firstNodeDetailLevel);

    return storeNodes.map(node => {
      const rawMetadata = (node.data as ProfessionalNodeData).metadata as MutableMetadata | undefined
      const sourceUrl = rawMetadata && typeof rawMetadata.importSource === 'string'
        ? rawMetadata.importSource
        : rawMetadata && typeof rawMetadata.url === 'string'
          ? rawMetadata.url
          : typeof (node.data as ProfessionalNodeData).url === 'string'
            ? (node.data as ProfessionalNodeData).url
            : undefined
      let nextMetadata: MutableMetadata | undefined = rawMetadata ? { ...rawMetadata } : undefined
      if (nextMetadata && typeof nextMetadata.importStatus === 'string' && typeof nextMetadata.status !== 'string') {
        const metadataForStatus = nextMetadata as MutableMetadata;
        const importStatus = metadataForStatus.importStatus as string;
        const computedStatus = (`import-${importStatus}`) as NodeMetadataStatus;
        nextMetadata = {
          ...metadataForStatus,
          status: computedStatus,
        } as MutableMetadata;
      }
      if (sourceUrl && importStatusMap.has(sourceUrl) && currentImportJob && currentImportJob.status !== 'completed') {
        const info = importStatusMap.get(sourceUrl)!
        nextMetadata = {
          ...(nextMetadata ?? {}),
          status: ('import-' + info.status) as NodeMetadataStatus,
          importStatus: info.status as NodeImportStatus,
          isPlaceholder: false,
          importSource: sourceUrl,
          importOrder: info.order ?? (nextMetadata ? nextMetadata.importOrder : undefined),
        } as MutableMetadata
      }

      // CRITICAL: Explicitly preserve _detailLevel and _needsDetailLoad from store node
      const storeNodeData = node.data as unknown as Record<string, unknown>;
      const _detailLevel = storeNodeData?._detailLevel as 'skeleton' | 'minimal' | 'standard' | 'full' | undefined;
      const _needsDetailLoad = storeNodeData?._needsDetailLoad as boolean | undefined;

      return {
        ...node,
        data: {
          ...node.data,
          components: node.data.components || [],
          metadata: nextMetadata,
          // Explicitly preserve viewport sync fields
          _detailLevel,
          _needsDetailLoad,
        },
      }
    })
  }, [storeNodes, importStatusMap, currentImportJob?.status])

  const realNodeCount = useMemo(() => (
    transformedStoreNodes.filter((node) => {
      const data = node.data as ProfessionalNodeData
      const metadata = data?.metadata as { isPlaceholder?: boolean } | undefined
      return !(metadata?.isPlaceholder)
    }).length
  ), [transformedStoreNodes])

  const placeholderPages = useMemo(() => {
    const jobStatus = currentImportJob?.status ?? 'pending'
    if (!currentImportJob) {
      return [] as Array<{ url: string; status?: string; order?: number }>
    }

    if (jobStatus === 'completed' || jobStatus === 'failed' || jobStatus === 'cancelled') {
      return [] as Array<{ url: string; status?: string; order?: number }>
    }

    const pagesMetadata = Array.isArray(currentImportJob?.metadata?.pages)
      ? [...currentImportJob.metadata.pages]
      : [] as Array<{ url: string; status?: string; order?: number }>

    if (pagesMetadata.length > 0) {
      const pendingPages = pagesMetadata.filter((page) => {
        const normalized = typeof page.status === 'string' ? page.status.trim().toLowerCase() : 'pending'
        return normalized !== 'ready' && normalized !== 'completed' && normalized !== 'skipped'
      })

      return pendingPages
    }

    const sitemapMeta = currentImportJob?.metadata?.sitemap as SitemapMetadataSnapshot | undefined
    const sitemapOrdered = Array.isArray(sitemapMeta?.ordered) ? sitemapMeta.ordered : []
    if (sitemapOrdered.length > 0) {
      const completedSet = new Set(Array.isArray(sitemapMeta?.completed) ? sitemapMeta.completed : [])
      const processingSet = new Set(Array.isArray(sitemapMeta?.processing) ? sitemapMeta.processing : [])
      const pendingSet = new Set(Array.isArray(sitemapMeta?.pending) ? sitemapMeta.pending : [])

      return sitemapOrdered
        .map((url, index) => {
          let status: string = 'pending'
          if (completedSet.has(url)) status = 'ready'
          else if (processingSet.has(url)) status = 'processing'
          else if (pendingSet.has(url)) status = 'pending'
          return { url, order: index, status }
        })
        .filter((entry) => {
          const normalized = entry.status?.toLowerCase?.() ?? 'pending'
          return normalized !== 'ready' && normalized !== 'completed' && normalized !== 'skipped'
        })
    }

    return [] as Array<{ url: string; status?: string; order?: number }>
  }, [
    currentImportJob?.metadata?.pages,
    currentImportJob?.metadata?.sitemap,
    currentImportJob?.status,
  ])

  const existingImportSources = useMemo(() => {
    const values = new Set<string>()
    transformedStoreNodes.forEach(node => {
      const data = node.data as ProfessionalNodeData
      const metadata = (data.metadata ?? {}) as MutableMetadata
      if (typeof metadata.importSourceNormalized === 'string') values.add(metadata.importSourceNormalized)
      if (typeof metadata.importSource === 'string') values.add(metadata.importSource)
      if (typeof metadata.url === 'string') values.add(metadata.url)
      if (typeof data.url === 'string') values.add(data.url)
    })
    return values
  }, [transformedStoreNodes])

  const placeholderGraph = useMemo(() => (
    buildPlaceholderGraph(placeholderPages, { existingUrls: existingImportSources })
  ), [placeholderPages, existingImportSources])

  const placeholderFlow = useMemo(() => toReactFlowPlaceholders(placeholderGraph), [placeholderGraph])
  const placeholderNodes = placeholderFlow.nodes
  const placeholderEdges = useMemo(() => (
    placeholderFlow.edges.map(edge => ({
      ...edge,
      style: PLACEHOLDER_EDGE_STYLE,
      markerEnd: PLACEHOLDER_EDGE_MARKER,
    }))
  ), [placeholderFlow.edges])

  const prevPlaceholderCountRef = React.useRef(placeholderNodes.length)

  const [nodes, setNodes, onNodesChange] = useNodesState<ProfessionalNodeData>([])
  const nodesRef = React.useRef<Node<ProfessionalNodeData>[]>([])
  const previousRealNodeCountRef = React.useRef(0)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const edgesRef = React.useRef<Edge[]>([])
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  const isScaffoldRootNode = useCallback((node?: Node<ProfessionalNodeData> | null) => {
    if (!node) return false
    if (node.id === 'root' || node.id === 'virtual-root' || node.id === 'scaffold-root') return true
    const data = node.data as ProfessionalNodeData | undefined
    const label = typeof data?.label === 'string' ? data.label.trim().toLowerCase() : ''
    if (label === 'root' || label === 'website root' || label === 'sitemap root') return true
    const slug = (data as Record<string, unknown> | undefined)?.slug
    if (typeof slug === 'string') {
      const normalized = slug.trim().toLowerCase()
      if (normalized === '' || normalized === '/' || normalized === 'root') {
        return true
      }
    }
    return false
  }, [])

  const mergeEdges = useCallback((base: Edge[], placeholders: Edge[]) => {
    const cleanedBase = base.filter(edge => !(edge.data && (edge.data as { isPlaceholder?: boolean }).isPlaceholder))
    const map = new Map<string, Edge>()
    cleanedBase.forEach(edge => map.set(edge.id, edge))
    placeholders.forEach(edge => map.set(edge.id, edge))
    return Array.from(map.values())
  }, [])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    if (placeholderNodes.length === 0) return

    const currentNodesSnapshot = nodesRef.current
    const firstNode = currentNodesSnapshot[0]
    const hasOnlyRoot = currentNodesSnapshot.length === 0 || (currentNodesSnapshot.length === 1 && isScaffoldRootNode(firstNode))
    const placeholdersAlreadyApplied = placeholderNodes.every(node =>
      currentNodesSnapshot.some(existing => existing.id === node.id)
    )

    if (!hasOnlyRoot && placeholdersAlreadyApplied) {
      return
    }

    const baseNodes = hasOnlyRoot
      ? currentNodesSnapshot.filter(node => !isScaffoldRootNode(node))
      : currentNodesSnapshot.filter(node => !node.id.startsWith('import-placeholder-'))

    const baseEdges = hasOnlyRoot ? [] : edgesRef.current
    const combinedEdges = mergeEdges(baseEdges, placeholderEdges)

    const combined = [...baseNodes, ...placeholderNodes]
    const nextNodes = baseNodes.length === 0
      ? (applyAutoLayout(combined, combinedEdges, 'TB', 'tree', { force: true }).nodes as Node<ProfessionalNodeData>[])
      : combined

    setNodes(nextNodes)
    setEdges(combinedEdges)
  }, [placeholderNodes, placeholderEdges, mergeEdges, setNodes, setEdges, isScaffoldRootNode])

  useEffect(() => {
    const previousCount = prevPlaceholderCountRef.current

    if (placeholderNodes.length === 0) {
      setNodes((current) => {
        const filtered = current.filter((node) => !node.id.startsWith('import-placeholder-'))
        if (filtered.length === current.length) {
          if (filtered.length === 0 && transformedStoreNodes.length > 0) {
            return [...transformedStoreNodes]
          }
          return current
        }
        return filtered
      })

      setEdges((current) => {
        const filtered = current.filter((edge) => !(edge.data && (edge.data as { isPlaceholder?: boolean }).isPlaceholder))
        if (filtered.length === current.length) {
          if (filtered.length === 0 && storeEdges.length > 0) {
            return [...storeEdges]
          }
          return current
        }
        return filtered
      })

      if (previousCount > 0) {
        didInitialLayoutRef.current = false
        prevTopologyKeyRef.current = null
      }
    }

    prevPlaceholderCountRef.current = placeholderNodes.length
  }, [
    placeholderNodes.length,
    transformedStoreNodes,
    storeEdges,
    setNodes,
    setEdges,
  ])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // BUG-008 FIX: Add loading timeout to prevent skeleton stuck indefinitely
  useEffect(() => {
    if (isInitialLoading) {
      const loadingTimeout = setTimeout(() => {
        console.warn('[SiteBuilder] Loading timeout reached - forcing load completion')
        setIsInitialLoading(false)
        if (!loadError && nodes.length === 0) {
          setLoadError('Loading took too long. Please try refreshing the page.')
        }
      }, 30000) // 30 second timeout

      return () => clearTimeout(loadingTimeout)
    }
  }, [isInitialLoading, loadError, nodes.length])
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([])
  const [copiedNode, setCopiedNode] = useState<Node | null>(null)
  const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<Node<ProfessionalNodeData> | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [history, setHistory] = useState<{ nodes: Node[], edges: Edge[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Tutorial state
  const { isFirstVisit, isLoading: isTutorialLoading, markCompleted, reset: resetTutorial } = useFirstVisit()
  const [showTutorial, setShowTutorial] = useState(false)

  // Show tutorial on first visit
  useEffect(() => {
    if (!isTutorialLoading && isFirstVisit) {
      setShowTutorial(true)
    }
  }, [isFirstVisit, isTutorialLoading])

  const isEditableTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
      return false
    }

    const editableSelector = "input, textarea, select, [contenteditable=\"true\"], [role=\"textbox\"], .ProseMirror"
    return Boolean(target.closest(editableSelector))
  }, [])
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentNodeId, setCommentNodeId] = useState<string | null>(null)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [aiSuggestionsOpen, setAISuggestionsOpen] = useState(false)
  const [globalSectionsOpen, setGlobalSectionsOpen] = useState(false)
  // SEARCH INTEGRATION: Client-side searchQuery removed - now using server-side search via SearchOverlay (Ctrl+K)
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState | null>(null)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [colorCodingEnabled, setColorCodingEnabled] = useState(true)
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [sectionPickerNodeId, setSectionPickerNodeId] = useState<string | null>(null)
  const [sectionPickerAfterIndex, setSectionPickerAfterIndex] = useState<number | undefined>(undefined)
  const [pageCreatorOpen, setPageCreatorOpen] = useState(false)
  const [pendingAddNode, setPendingAddNode] = useState<{ parentId: string | null; anchorId: string; position: 'top' | 'bottom' | 'left' | 'right' } | null>(null)
  const [reImportDialogOpen, setReImportDialogOpen] = useState(false)
  const [reImportPages, setReImportPages] = useState<Array<{
    pageId: string
    title: string
    importSource: string
    lastReimportedAt?: string
    sourceNotFoundAt?: string
  }>>([])
  const isGreenfieldJob = importJobIdParam?.startsWith('bootstrap-') ?? false
  const shouldAutoOpenAssistant =
    (!!currentImportJob && currentImportJob.state !== 'completed') ||
    (isGreenfieldJob && !currentImportJob)  // Auto-open while waiting for greenfield hydration

  const hasHomePage = useMemo(() => {
    return nodes.some((node) => {
      if (node.id === 'home') {
        return true
      }

      const slugCandidate =
        typeof node.data?.slug === 'string'
          ? node.data.slug
          : typeof node.data?.metadata?.slug === 'string'
            ? node.data.metadata.slug
            : undefined

      return isHomeNode({
        title: node.data?.label,
        slug: slugCandidate,
        metadata: node.data?.metadata,
      })
    })
  }, [nodes])

  const effectivePageTypes = useMemo(() => pageTypes ?? [], [pageTypes])

  const homeType = useMemo(
    () => effectivePageTypes.find((type) => type.isHome) ?? null,
    [effectivePageTypes]
  )

  const requireHomeSelection = !hasHomePage

  const defaultPageTypeId = useMemo(() => {
    if (requireHomeSelection && homeType) {
      return homeType.id
    }

    const firstNonHome = effectivePageTypes.find((type) => !type.isHome)
    return (firstNonHome ?? homeType ?? effectivePageTypes[0])?.id ?? ''
  }, [requireHomeSelection, homeType, effectivePageTypes])

  // Performance optimization hook
  const {
    optimizeNodes,
    optimizeEdges,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadProgressively,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    debounce,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isLoading: perfLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loadProgress: perfProgress,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metrics
  } = useSiteBuilderPerformance({
    enableVirtualization: nodes.length > 50,
    enableCaching: true,
    enableProgressiveLoading: nodes.length > 100
  })

  // Efficient hash function for state comparison
  const computeStateHash = useCallback((nodes: Node[], edges: Edge[]) => {
    // Use a simple hash based on count and IDs for quick comparison
    const nodeHash = `n${nodes.length}-${nodes.map(n => n.id).sort().join(',')}`
    const edgeHash = `e${edges.length}-${edges.map(e => e.id).sort().join(',')}`
    return `${nodeHash}|${edgeHash}`
  }, [])

  // Enhanced Undo/Redo functionality with efficient comparison
  const saveToHistory = useCallback(() => {
    // Don't save if we're in the middle of an undo/redo operation
    if (history.length > 0 && historyIndex >= 0) {
      const currentState = history[historyIndex]
      const currentHash = computeStateHash(nodes, edges)
      const historyHash = computeStateHash(currentState.nodes, currentState.edges)
      
      if (currentHash === historyHash) {
        return // No changes to save
      }
    }
    
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ 
      nodes: JSON.parse(JSON.stringify(nodes)), 
      edges: JSON.parse(JSON.stringify(edges)) 
    })
    
    // Limit history to 50 states to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [nodes, edges, history, historyIndex, computeStateHash])

  // EC-01: Handle missing websiteId - redirect to dashboard selection
  useEffect(() => {
    if (!websiteId) {
      router.push('/dashboard?message=select-website')
    }
  }, [websiteId, router])


  // Load sitemap from database on mount
  // BUG-001 FIX: Use AbortController to prevent race conditions when navigating away and back
  useEffect(() => {
    if (!websiteId) {
      setLoadError(null)
      setIsInitialLoading(false)
      return
    }

    const abortController = new AbortController()

    const loadData = async () => {
      try {
        setLoadError(null)
        await loadStructure(websiteId, abortController.signal)
      } catch (error) {
        // Ignore AbortError - request was cancelled intentionally
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        console.error('Failed to load website structure:', error)
        setLoadError('Failed to load website data. Please try again.')
        setIsInitialLoading(false)
      }
    }

    loadData()

    // Cleanup: abort pending request on unmount or dependency change
    return () => {
      abortController.abort()
    }
  }, [loadStructure, websiteId])

  useEffect(() => {
    if (!websiteId || !currentImportJob) {
      return
    }

    const syncStructure = async () => {
      try {
        await loadStructure(websiteId)
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to refresh structure after import progress update', error)
        }
      } finally {
        const progressSummary = currentImportJob.metadata?.progressSummary as Record<string, unknown> | undefined
        const processedCount = typeof progressSummary?.processedCount === 'number' ? progressSummary.processedCount : undefined
        setLastImportSync({
          jobId: currentImportJob.id,
          status: currentImportJob.status,
          progress: currentImportJob.progress ?? 0,
          processedCount,
        })
      }
    }

    const currentProgressSummary = currentImportJob.metadata?.progressSummary as Record<string, unknown> | undefined
    const processedCount = typeof currentProgressSummary?.processedCount === 'number' ? currentProgressSummary.processedCount : 0
    const lastProcessed = lastImportSync?.processedCount ?? 0
    const alreadySynced = lastImportSync && lastImportSync.jobId === currentImportJob.id
    const statusChanged = lastImportSync?.status !== currentImportJob.status
    const progressDelta = (currentImportJob.progress ?? 0) - (lastImportSync?.progress ?? 0)

    if (processedCount > lastProcessed) {
      void syncStructure()
      return
    }

    if (currentImportJob.status === 'completed') {
      if (!alreadySynced || statusChanged) {
        void syncStructure()
      }
      return
    }

    if (currentImportJob.progress >= 90 && (!alreadySynced || progressDelta >= 5)) {
      void syncStructure()
    }
  }, [currentImportJob, lastImportSync, loadStructure, websiteId])

  // Apply layout when store nodes are loaded
  // Guard to ensure initial auto-layout runs only once (avoids clobbering manual drags)
  const didInitialLayoutRef = React.useRef(false)
  // Track topology (IDs/edges) to avoid running layout on position-only updates
  const prevTopologyKeyRef = React.useRef<string | null>(null)
  const buildTopologyKey = useCallback(() => {
    const nodeIds = (storeNodes || []).map(n => n.id).sort().join('|')
    const edgePairs = (storeEdges || []).map(e => `${e.source}->${e.target}`).sort().join('|')
    return `${nodeIds}__${edgePairs}`
  }, [storeNodes, storeEdges])
  useEffect(() => {
    // Check for error state from store
    if (errorState) {
      setLoadError(errorState.message)
      setIsInitialLoading(false)
      return
    }
    // Compute current topology key (ignores positions)
    const currentKey = buildTopologyKey()
    const isNewTopology = prevTopologyKeyRef.current !== currentKey

    // Only run auto-layout on first load or when topology changes
    if ((!didInitialLayoutRef.current || isNewTopology) && !isLoading) {
      const includePlaceholders = placeholderNodes.length > 0
      const storeNodesForLayout = includePlaceholders
        ? transformedStoreNodes.filter(node => !isScaffoldRootNode(node))
        : transformedStoreNodes

      const nodesForLayout = (() => {
        if (storeNodesForLayout.length > 0) {
          return includePlaceholders
            ? [...storeNodesForLayout, ...placeholderNodes]
            : [...storeNodesForLayout]
        }
        if (includePlaceholders) {
          return [...placeholderNodes]
        }
        return []
      })()

      if (nodesForLayout.length > 0) {
        const combinedEdgesRaw = mergeEdges(storeEdges, placeholderEdges)
        const nodeIdSet = new Set(nodesForLayout.map(node => node.id))
        const combinedEdges = combinedEdgesRaw.filter(edge => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))

        // CRITICAL: Skip auto-layout when server has provided positions (viewportSyncEnabled)
        // Server positions are single source of truth - don't recalculate with client dimensions
        const useServerPositions = viewportSyncEnabled && !includePlaceholders && storeNodesForLayout.length > 0
        const layouted = useServerPositions
          ? nodesForLayout as Node<ProfessionalNodeData>[]
          : applyAutoLayout(nodesForLayout, combinedEdges, 'TB', 'tree', { force: true }).nodes as Node<ProfessionalNodeData>[]

        setNodes(layouted)
        setEdges(combinedEdges)
        setIsInitialLoading(false)
        didInitialLayoutRef.current = true
        prevTopologyKeyRef.current = currentKey
        const fitDuration = includePlaceholders ? 600 : 800

        // For large sites with server positions, center on home instead of fitting all nodes
        console.log('[SiteBuilder] Layout decision:', { useServerPositions, viewportSyncEnabled, nodeCount: layouted.length })
        if (useServerPositions) {
          // Find home node - cast to any since skeleton data has fullPath not in ProfessionalNodeData type
          const homeNode = layouted.find(n => {
            const data = n.data as unknown as Record<string, unknown>
            return (
              data?.fullPath === '/' ||
              data?.slug === 'home' ||
              data?.slug === '' ||
              (typeof data?.label === 'string' && data.label.toLowerCase() === 'home')
            )
          }) || layouted[0]

          if (homeNode) {
            // Use shared constants for consistent viewport centering
            const centerX = homeNode.position.x + LAYOUT.NODE_WIDTH / 2
            const centerY = homeNode.position.y + LAYOUT.NODE_HEIGHT / 2
            console.log('[SiteBuilder] Centering on home node:', {
              homeId: homeNode.id,
              fullPath: (homeNode.data as unknown as Record<string, unknown>)?.fullPath,
              position: homeNode.position,
              centerX,
              centerY
            })
            // Zoom level 0.8-1.0 shows about 5-8 nodes comfortably
            setTimeout(() => setCenter(centerX, centerY, { zoom: 0.9, duration: fitDuration }), 200)
          } else {
            console.log('[SiteBuilder] No home node found, using fitView')
            setTimeout(() => fitView({ padding: 0.2, duration: fitDuration }), 200)
          }
        } else {
          setTimeout(() => fitView({ padding: 0.2, duration: fitDuration }), 200)
        }
      } else {
        const fallbackNodes = includePlaceholders ? placeholderNodes : transformedStoreNodes
        const fallbackEdges = includePlaceholders ? mergeEdges([], placeholderEdges) : storeEdges
        setNodes(fallbackNodes)
        setEdges(fallbackEdges)
        setIsInitialLoading(false)
        didInitialLayoutRef.current = true
        prevTopologyKeyRef.current = currentKey
      }
    } else if (!isLoading) {
      // Ensure loading spinner is cleared even if we skip layout
      setIsInitialLoading(false)
    }
  }, [transformedStoreNodes, placeholderNodes, placeholderEdges, storeEdges, isLoading, errorState, setNodes, setEdges, fitView, setCenter, buildTopologyKey, mergeEdges, isScaffoldRootNode, viewportSyncEnabled])

  // Keep node data (e.g., components/effective props) in sync when topology is unchanged
  useEffect(() => {
    console.log('[SyncEffect] Running, isLoading:', isLoading, 'storeNodes:', transformedStoreNodes?.length);
    if (isLoading) return;
    if (!transformedStoreNodes || transformedStoreNodes.length === 0) return;

    // Log first node's _detailLevel from store for debugging
    const firstStoreNode = transformedStoreNodes[0];
    console.log('[SyncEffect] First store node _detailLevel:', firstStoreNode?.data?._detailLevel, '_needsDetailLoad:', firstStoreNode?.data?._needsDetailLoad);

    const nextById = new Map(transformedStoreNodes.map(n => [n.id, n]));
    let updatedCount = 0;

    setNodes(current => {
      console.log('[SyncEffect] Updating nodes, current count:', current.length);

      return current.map(n => {
        const src = nextById.get(n.id);
        if (!src) return n;
        const currData = n.data as any;
        const nextData = src.data as any;

        // Check if detail level changed - this is the key for viewport sync
        const detailLevelChanged = currData._detailLevel !== nextData._detailLevel;
        const needsDetailLoadChanged = currData._needsDetailLoad !== nextData._needsDetailLoad;

        // Only update when data differs to avoid unnecessary renders
        // IMPORTANT: Include _detailLevel and _needsDetailLoad for viewport sync updates
        const dataChanged = (
          JSON.stringify(currData.components) !== JSON.stringify(nextData.components) ||
          currData.label !== nextData.label ||
          currData.slug !== nextData.slug ||
          detailLevelChanged ||
          needsDetailLoadChanged ||
          JSON.stringify(currData.metadata) !== JSON.stringify(nextData.metadata)
        );

        if (dataChanged && (detailLevelChanged || needsDetailLoadChanged)) {
          console.log('[SyncEffect] Node', n.id, 'detail level changed:', currData._detailLevel, '->', nextData._detailLevel, 'needsDetailLoad:', currData._needsDetailLoad, '->', nextData._needsDetailLoad);
          updatedCount++;
        }

        return dataChanged ? { ...n, data: { ...currData, ...nextData } } : n;
      });
    });
  }, [transformedStoreNodes, isLoading, setNodes]);
  
  // SEARCH INTEGRATION: Header search event listener removed - now using server-side search via SearchOverlay (Ctrl+K)
  // The SearchOverlay component handles its own keyboard shortcuts and jump-to-node functionality

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't select node if space is pressed (panning mode)
    if (spacePressed) return
    
    // Handle drag-to-connect mode
    if (isConnecting && connectingFrom) {
      if (connectingFrom !== node.id) {
        // Create new edge
        const newEdge: Edge = {
          id: `${connectingFrom}-${node.id}-${Date.now()}`,
          source: connectingFrom,
          target: node.id,
          type: 'smoothstep',
          style: { stroke: 'rgba(255, 255, 255, 0.2)' },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255, 255, 255, 0.2)' }
        }
        setEdges((eds) => [...eds, newEdge])
      }
      setIsConnecting(false)
      setConnectingFrom(null)
      return
    }
    
    // Handle inline editing on double click
    if (event.detail === 2 && !event.ctrlKey && !event.metaKey) {
      // Double-click handled in node component for inline editing
      return
    }
    
    // Handle multi-select with Ctrl/Cmd or Shift
    if (event.ctrlKey || event.metaKey) {
      setSelectedNodes(prev => {
        const isSelected = prev.some(n => n.id === node.id)
        if (isSelected) {
          return prev.filter(n => n.id !== node.id)
        } else {
          return [...prev, node]
        }
      })
    } else if (event.shiftKey && selectedNodes.length > 0) {
      // Shift+click for range selection
      const lastSelected = selectedNodes[selectedNodes.length - 1]
      const allNodes = nodes.filter(n => !n.hidden)
      const lastIndex = allNodes.findIndex(n => n.id === lastSelected.id)
      const currentIndex = allNodes.findIndex(n => n.id === node.id)
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const rangeNodes = allNodes.slice(start, end + 1)
        setSelectedNodes(rangeNodes)
      }
    } else {
      setSelectedNodes([node])
      // Open property panel when selecting a single node
      openPropertyPanel(node.id)
    }
  }, [isConnecting, connectingFrom, setEdges, spacePressed, openPropertyPanel, selectedNodes, nodes])
  
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Enable inline editing for the node - no modal
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        isEditing: true
      }
    }
    setNodes(nodes => nodes.map(n => 
      n.id === node.id ? updatedNode : { ...n, data: { ...n.data, isEditing: false }}
    ))
  }, [setNodes])

  // Inline editing callbacks
  const handleNodeLabelChange = useCallback((nodeId: string, newLabel: string) => {
    // Update local state for immediate UI feedback
    setNodes((nodes) => 
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
              isEditing: false
            }
          }
        }
        return node
      })
    )
    
    // Update store to trigger database save
    if (websiteId) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        storeUpdateNode(nodeId, {
          data: {
            ...node.data,
            label: newLabel
          }
        })
      }
    }
    
    saveToHistory()
  }, [setNodes, nodes, websiteId, storeUpdateNode, saveToHistory])

  const handleComponentAdd = useCallback((nodeId: string, component: string, afterIndex?: number) => {
    // Check if this is a request to open the picker modal
    if (component === '__OPEN_PICKER__') {
      setSectionPickerNodeId(nodeId)
      setSectionPickerAfterIndex(afterIndex)
      setSectionPickerOpen(true)
      return
    }
    
    // Otherwise add the component normally
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          const currentComponents = ensureComponentInstances(node.data.components || [])
          let newComponents: ComponentInstance[]
          
          // Create new ComponentInstance for the component
          const newComponentInstance: ComponentInstance = {
            id: `${component.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            type: component,
            parentId: null,
            position: currentComponents.length,
            props: {},
            content: { text: '', images: [], links: [] },
            styles: { desktop: {}, tablet: {}, mobile: {} },
            metadata: { locked: false, visible: true, aiGenerated: false }
          }
          
          if (afterIndex !== undefined) {
            if (afterIndex === -1) {
              // Insert at beginning
              newComponents = [newComponentInstance, ...currentComponents]
            } else {
              // Insert after specific index
              newComponents = [
                ...currentComponents.slice(0, afterIndex + 1),
                newComponentInstance,
                ...currentComponents.slice(afterIndex + 1)
              ]
            }
          } else {
            // Add to end
            newComponents = [...currentComponents, newComponentInstance]
          }
          
          // Update positions
          newComponents = newComponents.map((comp, index) => ({
            ...comp,
            position: index
          }))
          
          // Store will be updated after setState completes
          
          return {
            ...node,
            data: {
              ...node.data,
              components: newComponents
            }
          }
        }
        return node
      })
    )
    
    // CP-01 FIX: Use setNodes callback to get updated state for store sync
    // The previous implementation had a closure bug where deferred setTimeout read stale nodes
    if (websiteId) {
      setNodes((currentNodes) => {
        // Find the node we just updated
        const updatedNode = currentNodes.find(n => n.id === nodeId)
        if (updatedNode && updatedNode.data.components) {
          // Defer store update to next tick to avoid updating during render
          setTimeout(() => {
            storeUpdateNode(nodeId, {
              data: {
                ...updatedNode.data,
                components: updatedNode.data.components
              }
            })
          }, 0)
        }
        // Return unchanged - we're just using this to read the updated state
        return currentNodes
      })
    }

  saveToHistory()
  }, [setNodes, websiteId, storeUpdateNode, saveToHistory])

  const handleSectionSelect = useCallback((sectionName: string) => {
    const targetNodeId = sectionPickerNodeId || (selectedNodes.length > 0 ? selectedNodes[0].id : null)
    if (targetNodeId) {
      console.log('[handleSectionSelect] Adding component:', sectionName, 'to node:', targetNodeId)
      handleComponentAdd(targetNodeId, sectionName, sectionPickerAfterIndex)
    } else {
      // CP-01: Show error when no target node is available
      console.error('[handleSectionSelect] No target node available for adding component')
      toast.error('Please select a page first before adding a component')
    }
    setSectionPickerOpen(false)
    setSectionPickerNodeId(null)
    setSectionPickerAfterIndex(undefined)
  }, [sectionPickerNodeId, sectionPickerAfterIndex, handleComponentAdd, selectedNodes])

  const handleComponentRemove = useCallback((nodeId: string, componentIndex: number) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          const newComponents = [...(node.data.components || [])]
          newComponents.splice(componentIndex, 1)

          return {
            ...node,
            data: {
              ...node.data,
              components: newComponents
            }
          }
        }
        return node
      })
    )

    // CP-04 FIX: Use setNodes callback to get updated state for store sync (same fix as CP-01)
    if (websiteId) {
      setNodes((currentNodes) => {
        const updatedNode = currentNodes.find(n => n.id === nodeId)
        if (updatedNode) {
          setTimeout(() => {
            storeUpdateNode(nodeId, {
              data: {
                ...updatedNode.data,
                components: updatedNode.data.components
              }
            })
          }, 0)
        }
        return currentNodes
      })
    }

    saveToHistory()
  }, [websiteId, storeUpdateNode, setNodes, saveToHistory])

  const [selectedComponent, setSelectedComponent] = useState<ComponentInstance | null>(null)
  const [selectedComponentNodeId, setSelectedComponentNodeId] = useState<string | null>(null)

  // CP-04: State for global component delete confirmation dialog
  const [deleteComponentDialogOpen, setDeleteComponentDialogOpen] = useState(false)
  const [pendingDeleteComponent, setPendingDeleteComponent] = useState<{
    componentId: string
    nodeId: string
    componentName: string
  } | null>(null)

  // TKT-048: State for page/node delete confirmation dialog
  const [deleteNodeDialogOpen, setDeleteNodeDialogOpen] = useState(false)
  const [pendingDeleteNodeIds, setPendingDeleteNodeIds] = useState<string[]>([])

  // SB-CTX-03: State for AI improvement dialog
  const [aiImprovementDialogOpen, setAiImprovementDialogOpen] = useState(false)
  const [aiImprovementNode, setAiImprovementNode] = useState<{ id: string; label: string } | null>(null)

  // CP-04: Handler to delete component with global check
  const handleDeleteComponentWithConfirmation = useCallback((componentId: string, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !node.data.components) return

    const componentIndex = node.data.components.findIndex((c) => c.id === componentId)
    if (componentIndex === -1) return

    const component = node.data.components[componentIndex]

    // Check if component is a global/shared component
    const isGlobalComponent = !!(component as ComponentInstance & { globalComponentId?: string })?.globalComponentId ||
                              !!(component as ComponentInstance & { sharedComponentRef?: string })?.sharedComponentRef

    if (isGlobalComponent) {
      // Show confirmation dialog for global components
      setPendingDeleteComponent({
        componentId,
        nodeId,
        componentName: component.type || 'Component'
      })
      setDeleteComponentDialogOpen(true)
    } else {
      // Delete directly for non-global components
      handleComponentRemove(nodeId, componentIndex)
      toast.success('Component deleted')
    }
  }, [nodes, handleComponentRemove])

  // CP-04: Confirm global component deletion
  const confirmDeleteGlobalComponent = useCallback(() => {
    if (!pendingDeleteComponent) return

    const { componentId, nodeId } = pendingDeleteComponent
    const node = nodes.find(n => n.id === nodeId)
    if (!node || !node.data.components) return

    const componentIndex = node.data.components.findIndex((c) => c.id === componentId)
    if (componentIndex !== -1) {
      handleComponentRemove(nodeId, componentIndex)
      toast.success('Global component deleted')
    }

    setPendingDeleteComponent(null)
    setDeleteComponentDialogOpen(false)
  }, [pendingDeleteComponent, nodes, handleComponentRemove])

  const handleComponentClick = useCallback((component: ComponentInstance) => {
    console.log('[Site Builder] Component clicked:', component.id, component.type)
    console.log('[Site Builder] Component structure:', JSON.stringify(component, null, 2))
    
    // Set the selected component ID in the store
    setSelectedComponentId(component.id)
    
    // Set the component for the new panel
    setSelectedComponent(component)
    
    // Find the node that contains this component
    const containingNode = nodes.find(node => {
      const components = ensureComponentInstances(node.data.components || [])
      return components.some((c) => c.id === component.id)
    })
    setSelectedComponentNodeId(containingNode?.id || null)
    
    // Open the component properties panel
    setComponentPanelOpen(true)
  }, [setSelectedComponentId, nodes, setComponentPanelOpen, setSelectedComponent, setSelectedComponentNodeId])

  const handleComponentsReorder = useCallback((nodeId: string, newComponents: ComponentInstance[]) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              components: newComponents
            }
          }
        }
        return node
      })
    )
    
    // Defer store update to avoid updating during render
    if (websiteId) {
      setTimeout(() => {
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          storeUpdateNode(nodeId, {
            data: {
              ...node.data,
              components: newComponents
            }
          })
        }
      }, 0)
    }
    
    saveToHistory()
  }, [websiteId, storeUpdateNode, nodes, setNodes, saveToHistory])
  
  const focusAssistantScope = useCallback((scope: AssistantScope) => {
    if (scope.type === 'site') {
      setSelectedNodes([])
      closePropertyPanel()
      setComponentPanelOpen(false)
      setSelectedComponent(null)
      setSelectedComponentNodeId(null)
      setSelectedComponentId(null)
      fitView({ padding: 0.2, duration: 600 })
      return
    }

    if (scope.type === 'node') {
      const target = nodes.find(node => node.id === scope.nodeId)
      if (!target) {
        return
      }

      setSelectedNodes([target])
      fitView({ nodes: [{ id: target.id }], padding: 0.3, duration: 600 })
      openPropertyPanel(target.id)
      setComponentPanelOpen(false)
      setSelectedComponent(null)
      setSelectedComponentNodeId(null)
      setSelectedComponentId(null)
      return
    }

    const scopedNodes = nodes.filter(node => scope.nodeIds.includes(node.id))
    if (scopedNodes.length === 0) {
      fitView({ padding: 0.2, duration: 600 })
      return
    }

    setSelectedNodes(scopedNodes)
    closePropertyPanel()
    setComponentPanelOpen(false)
    setSelectedComponent(null)
    setSelectedComponentNodeId(null)
    setSelectedComponentId(null)
    fitView({
      nodes: scopedNodes.map(node => ({ id: node.id })),
      padding: 0.3,
      duration: 600
    })
  }, [closePropertyPanel, fitView, nodes, openPropertyPanel, setComponentPanelOpen, setSelectedComponent, setSelectedComponentId, setSelectedComponentNodeId, setSelectedNodes])

  // Drag and drop handlers with visual feedback
  const onNodeDragStart = useCallback((_event: React.MouseEvent, _node: Node) => {
    setIsDragging(true)
    // Node drag started
    // Save to history before drag
    saveToHistory()
  }, [saveToHistory])
  
  const onNodeDrag = useCallback((_event: React.MouseEvent, _node: Node, dragEvent: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Visual feedback during drag - highlight potential drop zones
    if (dragEvent && dragEvent.target) {
      const targetElement = dragEvent.target as HTMLElement
      targetElement.style.cursor = 'grabbing'
    }
  }, [])
  
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    setIsDragging(false)
    // Node drag stopped
    
    // Update store with new position to trigger database save
    if (websiteId) {
      storeUpdateNode(node.id, {
        position: node.position
      })
    }
  }, [websiteId, storeUpdateNode])

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      // Context menu for node
      if (!selectedNodes.some(n => n.id === node.id)) {
        setSelectedNodes([node])
      }
    },
    [selectedNodes]
  )
  
  // Toggle node collapse/expand with recursive hiding
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const node = nds.find(n => n.id === nodeId)
      if (!node) return nds
      
      const collapsed = !node.data.collapsed
      
      // Get all descendant nodes recursively
      const getDescendants = (parentId: string): string[] => {
        const descendants: string[] = []
        const childEdges = edges.filter(e => e.source === parentId)
        childEdges.forEach(edge => {
          descendants.push(edge.target)
          descendants.push(...getDescendants(edge.target))
        })
        return descendants
      }
      
      const descendantIds = getDescendants(nodeId)
      
      // Update nodes with collapse state and visibility
      return nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, collapsed } }
        }
        if (descendantIds.includes(n.id)) {
          return { ...n, hidden: collapsed }
        }
        return n
      })
    })
    
    // Also hide/show edges connected to hidden nodes
    setEdges((eds) => eds.map(e => {
      const node = nodes.find(n => n.id === e.target || n.id === e.source)
      return { ...e, hidden: node?.hidden }
    }))
  }, [edges, nodes, setEdges, setNodes])

  const handleAutoLayout = useCallback(() => {
    // Use the auto-layout function which has built-in large site protection
    const result = applyAutoLayout(nodes, edges)

    // Handle skipped case (large site protection)
    if (result.skipped) {
      toast.warning(result.reason || 'Auto Layout skipped for large site.', {
        duration: 5000,
      })
      return
    }

    const layoutedNodes = result.nodes

    // Center on home node
    const homeNode = layoutedNodes.find(n => n.id === 'home' || n.data?.label?.toLowerCase() === 'home')
    if (homeNode) {
      const viewportWidth = window.innerWidth || 1500
      const centerX = viewportWidth / 2
      const homeOffsetX = centerX - homeNode.position.x - LAYOUT.NODE_WIDTH / 2

      const centeredNodes = layoutedNodes.map(node => ({
        ...node,
        position: {
          ...node.position,
          x: node.position.x + homeOffsetX
        }
      }))
      setNodes(centeredNodes)
    } else {
      setNodes(layoutedNodes)
    }

    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }, [nodes, edges, setNodes, fitView])

  // Open re-import dialog for selected pages
  const handleOpenReImportDialog = useCallback((nodesToReimport?: Node[]) => {
    const targetNodes = nodesToReimport || selectedNodes

    // Filter pages that have an import source
    const reimportablePages = targetNodes
      .filter(node => {
        const metadata = node.data?.metadata as Record<string, unknown> | undefined
        return metadata?.importSource && typeof metadata.importSource === 'string'
      })
      .map(node => {
        const metadata = node.data?.metadata as Record<string, unknown>
        return {
          pageId: node.id,
          title: node.data?.label || 'Untitled',
          importSource: metadata.importSource as string,
          lastReimportedAt: metadata.lastReimportedAt as string | undefined,
          sourceNotFoundAt: metadata.sourceNotFoundAt as string | undefined
        }
      })

    if (reimportablePages.length === 0) {
      toast.warning('No selected pages have an import source. Only imported pages can be re-imported.')
      return
    }

    setReImportPages(reimportablePages)
    setReImportDialogOpen(true)
  }, [selectedNodes])

  // Handle re-import completion
  const handleReImportComplete = useCallback((result: { success: boolean; summary: { updated: number; created: number; unchanged: number; sourceNotFound: number; failed: number } }) => {
    if (result.success) {
      const { summary } = result
      const successCount = summary.updated + summary.created
      if (successCount > 0) {
        toast.success(`Re-import complete: ${successCount} page${successCount === 1 ? '' : 's'} updated`)
      } else if (summary.unchanged > 0) {
        toast.info('No changes detected in source pages')
      }

      // Refresh the store to get updated page content
      if (websiteId) {
        // Trigger a refresh - the hydration hook will pick up the changes
        window.location.reload()
      }
    }
  }, [websiteId])

  useEffect(() => {
    if (!currentImportJob) {
      previousRealNodeCountRef.current = realNodeCount
      return
    }

    if (currentImportJob.status === 'queued') {
      previousRealNodeCountRef.current = 0
      return
    }

    const previous = previousRealNodeCountRef.current
    if (realNodeCount > previous && realNodeCount > 0) {
      previousRealNodeCountRef.current = realNodeCount
      handleAutoLayout()
    }
  }, [currentImportJob?.id, currentImportJob?.status, realNodeCount, handleAutoLayout])

  const handleAddPageAtPosition = useCallback((nodeId: string, position: 'top' | 'bottom' | 'left' | 'right') => {
    const sourceNode = nodes.find(n => n.id === nodeId)
    if (!sourceNode) return

    let parentId: string | null = null

    switch (position) {
      case 'top':
      case 'bottom':
        parentId = nodeId
        break
      case 'left':
      case 'right': {
        const parentEdge = edges.find(e => e.target === nodeId)
        parentId = parentEdge?.source || null
        break
      }
      default:
        parentId = nodeId
    }

    setPendingAddNode({
      anchorId: nodeId,
      parentId,
      position,
    })
    closePropertyPanel()
    setPageCreatorOpen(true)
  }, [nodes, edges, closePropertyPanel])

  const handleConfirmAddPage = useCallback((config: { contentTypeId?: string; pageTypeName: string; title: string; isHome?: boolean }) => {
    if (!pendingAddNode) {
      return
    }

    const isHomeSelection =
      typeof config.isHome === 'boolean'
        ? config.isHome
        : isHomeLike(config.pageTypeName)

    if (isHomeSelection && hasHomePage) {
      toast.error('A Home page already exists. Update the existing Home or change the page type.')
      return
    }

    if (!hasHomePage && !isHomeSelection) {
      toast.warning('Create the Home page before adding additional page types.')
      return
    }

    const existingSlugs = new Set<string>()
    nodes.forEach((node) => {
      const candidateSlug =
        typeof node.data?.slug === 'string'
          ? node.data.slug
          : typeof node.data?.metadata?.slug === 'string'
            ? node.data.metadata.slug
            : undefined

      const normalizedSlug = typeof candidateSlug === 'string' ? candidateSlug.trim() : undefined
      if (normalizedSlug && normalizedSlug.length > 0) {
        existingSlugs.add(normalizedSlug.toLowerCase())
      }

      if (isHomeNode({
        title: node.data?.label,
        slug: normalizedSlug,
        metadata: node.data?.metadata,
      })) {
        existingSlugs.add('home')
        existingSlugs.add('')
        existingSlugs.add('/')
        existingSlugs.add('index')
      }
    })

    const rawTitle = (config.title || config.pageTypeName).trim()
    const resolvedTitle =
      rawTitle.length > 0
        ? rawTitle
        : isHomeSelection
          ? 'Home'
          : config.pageTypeName
    const baseSlug = isHomeSelection ? 'home' : resolvedTitle
    const slug = createUniqueSlug(baseSlug, existingSlugs)

    // TKT-001: Pass position info for correct sibling placement
    storeAddNode(pendingAddNode.parentId, {
      title: resolvedTitle,
      slug,
      ...(config.contentTypeId ? { contentTypeId: config.contentTypeId } : {}),
      metadata: {
        pageType: config.pageTypeName,
      },
    }, {
      anchorId: pendingAddNode.anchorId,
      position: pendingAddNode.position,
    })

    setPageCreatorOpen(false)
    setPendingAddNode(null)
  }, [pendingAddNode, hasHomePage, nodes, storeAddNode])

  const handleDuplicateNode = useCallback((nodeId?: string, includeChildren: boolean = false) => {
    const node = nodeId ? nodes.find(n => n.id === nodeId) : selectedNodes[0]
    if (!node) return
    
    saveToHistory() // Save state before duplication
    
    const timestamp = Date.now()
    const nodeMap = new Map<string, string>() // Old ID -> New ID mapping
    
    // Duplicate the main node
    const newNodeId = `${node.id}-copy-${timestamp}`
    nodeMap.set(node.id, newNodeId)
    
    const newNode: Node = {
      ...node,
      id: newNodeId,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      data: {
        ...node.data,
        label: `${node.data.label} (Copy)`,
        metadata: {
          ...node.data.metadata,
          status: 'draft'
        },
        children: includeChildren && node.data.children 
          ? node.data.children.map((childId: string) => `${childId}-copy-${timestamp}`)
          : []
      }
    }
    
    const newNodes = [newNode]
    const newEdges: Edge[] = []
    
    // If including children, duplicate all descendants
    if (includeChildren && node.data.children) {
      const duplicateDescendants = (parentId: string, parentNewId: string) => {
        const children = nodes.filter(n => 
          edges.some(e => e.source === parentId && e.target === n.id)
        )
        
        children.forEach(child => {
          const childNewId = `${child.id}-copy-${timestamp}`
          nodeMap.set(child.id, childNewId)
          
          newNodes.push({
            ...child,
            id: childNewId,
            position: {
              x: child.position.x + 50,
              y: child.position.y + 50
            },
            data: {
              ...child.data,
              label: `${child.data.label} (Copy)`,
              metadata: {
                ...child.data.metadata,
                status: 'draft'
              }
            }
          })
          
          // Add edge from parent to child
          newEdges.push({
            id: `${parentNewId}-${childNewId}`,
            source: parentNewId,
            target: childNewId,
            type: 'smoothstep',
            style: { stroke: 'rgba(255, 255, 255, 0.2)' }
          })
          
          // Recursively duplicate children
          duplicateDescendants(child.id, childNewId)
        })
      }
      
      duplicateDescendants(node.id, newNodeId)
    }
    
    setNodes((nds) => [...nds, ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
  }, [nodes, edges, selectedNodes, setNodes, setEdges, saveToHistory])

  // TKT-048: Show confirmation dialog before deleting nodes
  const handleDeleteNode = useCallback((nodeId?: string) => {
    const nodesToDelete = nodeId ? [nodeId] : selectedNodes.map(n => n.id)
    if (nodesToDelete.length === 0) return

    // Show confirmation dialog instead of deleting directly
    setPendingDeleteNodeIds(nodesToDelete)
    setDeleteNodeDialogOpen(true)
  }, [selectedNodes])

  // TKT-048: Confirm handler for node deletion
  const confirmDeleteNodes = useCallback(() => {
    if (pendingDeleteNodeIds.length === 0) return

    // Use store's delete with database persistence
    storeDeleteNodes(pendingDeleteNodeIds)
    setSelectedNodes([])

    // Close dialog and clear pending state
    setDeleteNodeDialogOpen(false)
    setPendingDeleteNodeIds([])
  }, [pendingDeleteNodeIds, storeDeleteNodes])
  

  const handleCutNode = useCallback((nodeId?: string) => {
    const node = nodeId ? nodes.find(n => n.id === nodeId) : selectedNodes[0]
    if (node) {
      setCopiedNode(node)
      handleDeleteNode(nodeId)
    }
  }, [nodes, selectedNodes, handleDeleteNode])

  const handlePasteNode = useCallback(() => {
    if (!copiedNode) return
    
    const newNode: Node = {
      ...copiedNode,
      id: `${copiedNode.id}-paste-${Date.now()}`,
      position: {
        x: copiedNode.position.x + 100,
        y: copiedNode.position.y + 100
      }
    }
    setNodes((nds) => [...nds, newNode])
  }, [copiedNode, setNodes])

  const handleExportBranch = useCallback((nodeId: string) => {
    const getDescendants = (id: string): string[] => {
      const descendants: string[] = [id]
      const children = edges.filter(e => e.source === id).map(e => e.target)
      children.forEach(childId => {
        descendants.push(...getDescendants(childId))
      })
      return descendants
    }
    
    const branchNodeIds = getDescendants(nodeId)
    const branchNodes = nodes.filter(n => branchNodeIds.includes(n.id))
    const branchEdges = edges.filter(e => 
      branchNodeIds.includes(e.source) && branchNodeIds.includes(e.target)
    )
    
    const data = { nodes: branchNodes, edges: branchEdges }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `branch-${nodeId}.json`
    a.click()
  }, [nodes, edges])

  const handleZoomChange = useCallback((value: string) => {
    const zoom = parseFloat(value) / 100
    zoomTo(zoom, { duration: 300 })
  }, [zoomTo])

  // Color coding by page type
  const getNodeColor = useCallback((node: Node<ProfessionalNodeData>) => {
    if (!colorCodingEnabled) return undefined
    
    const pageType = node.data.metadata?.pageType
    switch(pageType) {
      case 'Landing': return '#FF5500'
      case 'Product': return '#3B82F6'
      case 'Blog': return '#10B981'
      case 'Legal': return '#EF4444'
      case 'Support': return '#8B5CF6'
      default: return '#6B7280'
    }
  }, [colorCodingEnabled])

  // Fullscreen mode toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Printing removed for this page (unused)

  // Bridge header dropdown actions to internal handlers (after callbacks are defined)
  useEffect(() => {
    const runAutoLayout = () => handleAutoLayout()
    const openAISuggestions = () => setAISuggestionsOpen(true)
    const openVersionHistory = () => setVersionHistoryOpen(true)
    const openHelp = () => setShowKeyboardHelp(true)
    const openGlobalSections = () => setGlobalSectionsOpen(true)

    // SB-PAGES-06: Handle focus-node event from pages panel
    const handleFocusNode = (event: CustomEvent<{ nodeId: string }>) => {
      if (event.detail?.nodeId) {
        jumpToNode(event.detail.nodeId)
      }
    }

    // SB-CANVAS-06: Handle auto-layout toggle from bottom bar
    const handleAutoLayoutToggle = () => {
      handleAutoLayout()
    }

    window.addEventListener('run-auto-layout', runAutoLayout as EventListener)
    window.addEventListener('open-ai-suggestions', openAISuggestions as EventListener)
    window.addEventListener('open-version-history', openVersionHistory as EventListener)
    window.addEventListener('open-help', openHelp as EventListener)
    window.addEventListener('open-global-sections', openGlobalSections as EventListener)
    // SB-PAGES-06: Focus node event listener
    window.addEventListener('sitebuilder:focus-node', handleFocusNode as EventListener)
    // SB-CANVAS-06: Auto-layout toggle event listener
    window.addEventListener('sitebuilder:auto-layout-toggle', handleAutoLayoutToggle as EventListener)
    // SB-BTM-02: Also listen for sitebuilder:open-history (dispatched by layout)
    window.addEventListener('sitebuilder:open-history', openVersionHistory as EventListener)

    return () => {
      window.removeEventListener('run-auto-layout', runAutoLayout as EventListener)
      window.removeEventListener('open-ai-suggestions', openAISuggestions as EventListener)
      window.removeEventListener('open-version-history', openVersionHistory as EventListener)
      window.removeEventListener('open-help', openHelp as EventListener)
      window.removeEventListener('open-global-sections', openGlobalSections as EventListener)
      window.removeEventListener('sitebuilder:focus-node', handleFocusNode as EventListener)
      window.removeEventListener('sitebuilder:auto-layout-toggle', handleAutoLayoutToggle as EventListener)
      window.removeEventListener('sitebuilder:open-history', openVersionHistory as EventListener)
    }
  }, [handleAutoLayout, setAISuggestionsOpen, setVersionHistoryOpen, setShowKeyboardHelp, setGlobalSectionsOpen, jumpToNode])
  
  // Sync React Flow changes to store
  // Store manages its own state, no manual sync needed
  
  // Filter nodes based on status and advanced filters
  // SEARCH INTEGRATION: Client-side search filter removed - now using server-side search via SearchOverlay (Ctrl+K)
  const filteredNodes = useMemo(() => {
    let filtered = nodes

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(node =>
        node.data.metadata?.status === filterStatus
      )
    }

    // Advanced filters
    if (advancedFilters) {
      // SEO Score filter
      if (advancedFilters.seoScoreMin > 0 || advancedFilters.seoScoreMax < 100) {
        filtered = filtered.filter(node => {
          const score = node.data.metadata?.seoScore || 0
          return score >= advancedFilters.seoScoreMin && score <= advancedFilters.seoScoreMax
        })
      }

      // Page type filter
      if (advancedFilters.pageType !== 'all') {
        filtered = filtered.filter(node =>
          node.data.metadata?.pageType?.toLowerCase() === advancedFilters.pageType
        )
      }

      // Has components filter
      if (advancedFilters.hasComponents) {
        filtered = filtered.filter(node =>
          node.data.components && node.data.components.length > 0
        )
      }
    }

    return filtered
  }, [nodes, filterStatus, advancedFilters])
  
  // Calculate active filters count
  useEffect(() => {
    let count = 0
    if (advancedFilters) {
      if (advancedFilters.seoScoreMin > 0 || advancedFilters.seoScoreMax < 100) count++
      if (advancedFilters.pageType !== 'all') count++
      if (advancedFilters.dateRange !== 'all') count++
      if (advancedFilters.author !== 'all') count++
      if (advancedFilters.hasComments) count++
      if (advancedFilters.hasComponents) count++
    }
    setActiveFiltersCount(count)
  }, [advancedFilters])
  
  const handleUndo = useCallback(() => {
    if (canUndo) {
      storeUndo()
    }
  }, [canUndo, storeUndo])
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      storeRedo()
    }
  }, [canRedo, storeRedo])
  
  // Show all nodes
  const handleShowAll = useCallback(() => {
    setNodes((nds) => nds.map(n => ({
      ...n,
      hidden: false
    })))
    setTimeout(() => fitView({ padding: 0.2 }), 100)
  }, [setNodes, fitView])

  // Handle spacebar for panning mode
  useEffect(() => {
    const handleSpaceDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        return
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setSpacePressed(true)
        document.body.style.cursor = 'grab'
      }
    }
    
    const handleSpaceUp = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        setSpacePressed(false)
        document.body.style.cursor = 'default'
      }
    }
    
    window.addEventListener('keydown', handleSpaceDown)
    window.addEventListener('keyup', handleSpaceUp)
    
    return () => {
      window.removeEventListener('keydown', handleSpaceDown)
      window.removeEventListener('keyup', handleSpaceUp)
      document.body.style.cursor = 'default'
    }
  }, [isEditableTarget])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) {
        return
      }

      // Delete key - CP-04: Handle component deletion when component panel is open
      if (e.key === 'Delete') {
        // If component properties panel is open, delete the component (with global check)
        if (componentPanelOpen && selectedComponent && selectedComponentNodeId) {
          e.preventDefault()
          handleDeleteComponentWithConfirmation(selectedComponent.id, selectedComponentNodeId)
          // Close panel after initiating delete (dialog will handle confirmation for global)
          setComponentPanelOpen(false)
          setSelectedComponent(null)
          setSelectedComponentNodeId(null)
          setSelectedComponentId(null)
          return
        }
        // Otherwise, delete selected nodes
        if (selectedNodes.length > 0) {
          e.preventDefault()
          handleDeleteNode()
        }
      }
      
      
      // Ctrl/Cmd + D for duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedNodes.length > 0) {
        e.preventDefault()
        handleDuplicateNode()
      }
      
      // Ctrl/Cmd + C for copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedNodes.length > 0) {
        e.preventDefault()
        const nodesToCopy = selectedNodes
        const edgesToCopy = edges.filter(e => 
          nodesToCopy.some(n => n.id === e.source) &&
          nodesToCopy.some(n => n.id === e.target)
        )
        setClipboard({ nodes: nodesToCopy, edges: edgesToCopy })
      }
      
      // Ctrl/Cmd + X for cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedNodes.length > 0) {
        e.preventDefault()
        handleCutNode()
      }
      
      // Ctrl/Cmd + V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault()
        const idMap = new Map<string, string>()
        const newNodes = clipboard.nodes.map(node => {
          const newId = `${node.id}-paste-${Date.now()}`
          idMap.set(node.id, newId)
          return {
            ...node,
            id: newId,
            position: {
              x: node.position.x + 100,
              y: node.position.y + 100
            }
          }
        })
        const newEdges = clipboard.edges.map(edge => ({
          ...edge,
          id: `${edge.id}-paste-${Date.now()}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target
        }))
        setNodes((nds) => [...nds, ...newNodes])
        setEdges((eds) => [...eds, ...newEdges])
      }
      
      // Ctrl/Cmd + A for select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault()
        setSelectedNodes(nodes)
      }
      
      // Ctrl/Cmd + Shift + A for auto-layout
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault()
        handleAutoLayout()
      }
      
      // Escape to deselect and close panels
      if (e.key === 'Escape') {
        setSelectedNodes([])
        closePropertyPanel()
        setComponentPanelOpen(false)
      }
      
      // Undo/Redo now handled by useUndoRedoShortcuts hook
      
      
      // F for fit view
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        fitView({ padding: 0.2, duration: 800 })
      }
      
      // Plus/Minus for zoom
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        const currentZoom = getZoom()
        zoomTo(Math.min(currentZoom * 1.2, 4))
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        const currentZoom = getZoom()
        zoomTo(Math.max(currentZoom * 0.8, 0.1))
      }
      
      // Arrow keys for fine positioning (when node selected)
      if (selectedNodes.length > 0 && !e.ctrlKey && !e.metaKey) {
        const moveDistance = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setNodes((nds) => nds.map(n => 
            selectedNodes.some(sn => sn.id === n.id) 
              ? { ...n, position: { ...n.position, y: n.position.y - moveDistance } }
              : n
          ))
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setNodes((nds) => nds.map(n => 
            selectedNodes.some(sn => sn.id === n.id) 
              ? { ...n, position: { ...n.position, y: n.position.y + moveDistance } }
              : n
          ))
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setNodes((nds) => nds.map(n => 
            selectedNodes.some(sn => sn.id === n.id) 
              ? { ...n, position: { ...n.position, x: n.position.x - moveDistance } }
              : n
          ))
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setNodes((nds) => nds.map(n => 
            selectedNodes.some(sn => sn.id === n.id) 
              ? { ...n, position: { ...n.position, x: n.position.x + moveDistance } }
              : n
          ))
        }
      }
      
      // ? for keyboard shortcuts help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowKeyboardHelp(true)
      }
      
      // L for auto-layout
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        handleAutoLayout()
      }
          
      // S for AI suggestions
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setAISuggestionsOpen(true)
      }
      
      // Number keys for zoom presets
      if (e.key === '1' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        handleZoomChange('21')
      }
      if (e.key === '2' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        handleZoomChange('50')
      }
      if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        handleZoomChange('100')
      }
      if (e.key === '4' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        handleZoomChange('200')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodes, clipboard, nodes, edges, handleDeleteNode, handleDuplicateNode, handleAutoLayout, handleUndo, handleRedo, handleCutNode, handleZoomChange, setNodes, setEdges, fitView, getZoom, zoomTo, closePropertyPanel, setComponentPanelOpen, isEditableTarget, componentPanelOpen, selectedComponent, selectedComponentNodeId, handleDeleteComponentWithConfirmation, setSelectedComponent, setSelectedComponentNodeId, setSelectedComponentId])

  // Handle context menu actions for page nodes
  const handleContextMenuAction = useCallback((nodeId: string, action: PageContextMenuAction) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    switch (action) {
      case 'reimport':
        handleOpenReImportDialog([node])
        break
      case 'improve-ai':
        // SB-CTX-03: Open AI improvement dialog
        setAiImprovementNode({
          id: nodeId,
          label: node.data?.label || 'Page'
        })
        setAiImprovementDialogOpen(true)
        break
      case 'duplicate':
        handleDuplicateNode(nodeId)
        break
      case 'delete':
        handleDeleteNode(nodeId)
        break
      case 'settings':
        // Select the node and open property panel
        setSelectedNodes([node])
        openPropertyPanel(nodeId)
        break
    }
  }, [nodes, handleOpenReImportDialog, handleDuplicateNode, handleDeleteNode, setSelectedNodes, openPropertyPanel, setAiImprovementNode, setAiImprovementDialogOpen])

  // Add onToggleCollapse and onComponentsReorder to node data and optimize for large node counts
  const nodesWithHandlers = useMemo(() => {
    // Performance optimization: if too many nodes, enable virtualization hint
    const nodeCount = filteredNodes.length
    const enableOptimizations = nodeCount > 100
    
    return filteredNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onToggleCollapse: handleToggleCollapse,
        onComponentsReorder: handleComponentsReorder,
        onLabelChange: handleNodeLabelChange,
        onComponentAdd: handleComponentAdd,
        onComponentRemove: handleComponentRemove,
        onComponentClick: handleComponentClick,
        onAddPage: handleAddPageAtPosition,
        onContextMenuAction: handleContextMenuAction,
        // Add performance hints for large graphs
        ...(enableOptimizations && {
          className: 'will-change-transform'
        })
      }
    }))
  }, [filteredNodes, handleToggleCollapse, handleComponentsReorder, handleNodeLabelChange, handleComponentAdd, handleComponentRemove, handleComponentClick, handleAddPageAtPosition, handleContextMenuAction])

  // Ensure ReactFlow receives only filtered nodes while preserving handlers
  const filteredNodesWithHandlers = useMemo(() => {
    const map = new Map(nodesWithHandlers.map(n => [n.id, n]))
    return filteredNodes.map(n => map.get(n.id) ?? n)
  }, [filteredNodes, nodesWithHandlers])

  // Create wrapped node types with context menu - keep this stable
  const wrappedNodeTypes = useMemo(() => {
    const wrapped: Record<string, React.ComponentType<any>> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
    
    Object.keys(professionalNodeTypes).forEach((type) => {
      wrapped[type] = professionalNodeTypes[type as keyof typeof professionalNodeTypes]
    })
    
    return wrapped
  }, [])

  // Optimize nodes and edges for performance
  const optimizedNodes = useMemo(() => 
    filteredNodes.length > 50 ? optimizeNodes(filteredNodes) : filteredNodes,
    [filteredNodes, optimizeNodes]
  )
  
  const visibleNodeIds = useMemo(() => 
    new Set(optimizedNodes.filter(n => !n.hidden).map(n => n.id)),
    [optimizedNodes]
  )
  
  const optimizedEdges = useMemo(() => 
    filteredNodes.length > 50 ? optimizeEdges(edges, visibleNodeIds) : edges,
    [edges, visibleNodeIds, filteredNodes.length, optimizeEdges]
  )

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col">
      {/* Header skeleton */}
      <div className="glass-panel p-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      
      {/* Main canvas area skeleton */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 glass-panel p-0">
          <div className="grid grid-cols-3 gap-8 h-full">
            {/* Node skeletons */}
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-4 pt-8">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
        
        {/* Controls skeleton */}
        <div className="absolute bottom-4 right-4 space-y-2">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-10 w-10 rounded" />
        </div>
      </div>
    </div>
  )

  // EC-01: Enhanced error state component with navigation buttons
  const ErrorState = () => {
    const isNotFoundError = loadError?.toLowerCase().includes('not found')
    const isAuthError = loadError?.toLowerCase().includes('unauthorized') || loadError?.toLowerCase().includes('access denied')

    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="glass-panel rounded-lg p-8 max-w-md text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {isNotFoundError ? 'Website Not Found' : isAuthError ? 'Access Denied' : 'Unable to Load Site Builder'}
          </h2>
          <p className="text-gray-400 mb-6">{loadError || 'An unexpected error occurred while loading your website data.'}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="bg-white/5 border-white/20 hover:bg-white/10 text-white"
            >
              Go to Dashboard
            </Button>
            {isNotFoundError && (
              <Button
                variant="default"
                onClick={() => router.push('/dashboard')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Select Website
              </Button>
            )}
            {!isNotFoundError && !isAuthError && (
              <Button
                onClick={() => {
                  setLoadError(null)
                  setIsInitialLoading(true)
                  const websiteId = searchParams.get('websiteId')
                  if (websiteId) {
                    loadStructure(websiteId)
                  } else {
                    setIsInitialLoading(false)
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white"
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Conditional rendering based on loading/error state
  console.log('[SiteBuilder] Render check:', {
    isInitialLoading,
    isLoading,
    nodeCount: nodes.length,
    storeNodeCount: storeNodes.length,
    viewportSyncEnabled,
    sampleNodeDetailLevel: nodes[0]?.data?._detailLevel,
  })

  if (isInitialLoading) {
    return <LoadingSkeleton />
  }

  if (loadError) {
    return <ErrorState />
  }

  return (
    <>
      {/* Toast notifications */}
      <Toaster position="bottom-center" richColors />
      
      {/* Keyboard Navigation Handler */}
      <KeyboardNavigation
        onOpenSectionPicker={() => {
          // Default to currently selected node when opening picker globally
          setSectionPickerNodeId(selectedNodes[0]?.id ?? null)
          setSectionPickerAfterIndex(undefined)
          setSectionPickerOpen(true)
        }}
        onOpenKeyboardHelp={() => setShowKeyboardHelp(true)}
      />

      {/* Search Overlay for Jump-to-Node functionality */}
      <SearchOverlayWithShortcuts />

      {/* Multi-Select Controls Toolbar */}
      {selectedNodes.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
          <MultiSelectControls
            onSelectionChange={(selectedIds) => {
              const currentIds = selectedNodes.map((node) => node.id)
              const sameSize = currentIds.length === selectedIds.length
              if (sameSize) {
                const currentSet = new Set(currentIds)
                const unchanged = selectedIds.every((id) => currentSet.has(id))
                if (unchanged) {
                  return
                }
              }

              const nextSet = new Set(selectedIds)
              const nextNodes = nodes.filter((node) => nextSet.has(node.id))
              setSelectedNodes(nextNodes)
            }}
          />
        </div>
      )}
      
      {/* Floating Add Component Button removed (unused) */}
      
      {/* Virtual Canvas for performance metrics */}
      {nodes.length > 50 && (
        <VirtualCanvas
          nodes={optimizedNodes}
          edges={optimizedEdges}
          onNodesChange={setNodes}
        />
      )}
      
      {/* Show loading progress for large sitemaps */}
      {perfLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 rounded-lg p-3 shadow-lg">
          <div className="text-sm text-white mb-2">Loading sitemap...</div>
          <Progress value={perfProgress} className="w-48" />
        </div>
      )}

      {/* Viewport sync loading indicator */}
      {isViewportLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border border-gray-700">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span className="text-sm text-gray-300">Loading nodes...</span>
          </div>
        </div>
      )}

      {/* Performance stats panel (merged visible nodes + viewport sync) */}
      <PerformanceStatsPanel
        totalNodes={storeNodes.length}
        visibleNodes={nodes.filter(n => !n.hidden).length}
        viewportSyncEnabled={viewportSyncEnabled}
        viewportStats={viewportStats}
        isViewportLoading={isViewportLoading}
      />

      {/* SEARCH INTEGRATION: Client-side empty state removed - SearchOverlay handles its own empty state */}

        <div style={{ width: '100%', height: '100vh' }}>
        <ReactFlow
        nodes={filteredNodesWithHandlers.map(node => ({
          ...node,
          style: {
            ...node.style,
            borderColor: getNodeColor(node),
            borderWidth: colorCodingEnabled ? 2 : 1,
          }
        }))}
        edges={optimizedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={wrappedNodeTypes}
        nodesDraggable={!spacePressed}
        nodeDragThreshold={3}
        fitView={false}
        className={`bg-gradient-to-br from-gray-900 via-gray-800 to-black w-full h-full site-builder-canvas ${spacePressed ? 'pan-mode' : ''}`}
        panOnDrag={spacePressed ? true : [1, 2]}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        preventScrolling={false}
        elementsSelectable={!spacePressed}
        selectionKeyCode="Shift"
        minZoom={0.08}
        proOptions={{ hideAttribution: true }}
        snapToGrid={true}
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { 
            stroke: 'rgba(255, 255, 255, 0.2)', 
            strokeWidth: 2,
            strokeDasharray: isDragging ? '5 5' : '0',
          },
          animated: isDragging,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255, 255, 255, 0.2)' }
        }}
        multiSelectionKeyCode={null}
        deleteKeyCode="Delete"
      >
        <Background 
          gap={20} 
          size={1.5} 
          color="rgba(255, 255, 255, 0.03)" 
          className="animate-pulse-slow"
        />
        
        <Panel position="top-left" className="flex flex-col gap-2 z-10 mt-12">
          {/* Main Toolbar (conditional) */}
          {(spacePressed || selectedNodes.length > 1 || isConnecting) && (
          <div className="flex items-center gap-2 glass-panel rounded-lg p-2 pointer-events-auto shadow-lg">
          {/* Import Status */}

          {/* Pan Mode Indicator */}
          {spacePressed && (
            <Badge className="bg-orange-500/30 text-orange-400 border-orange-500/50 animate-pulse">
              <Move className="h-3 w-3 mr-1" />
              Pan Mode (Space)
            </Badge>
          )}
          
          {/* Pan instructions removed per request */}
          
          {/* Main toolbar actions moved to top-right icon nav */}
                    
          {/* Show All button - REMOVED: Not applicable in this context */}

          {/* Single Page Actions - REMOVED: Redundant with context menu */}
          {/* Users can right-click on any page for actions (Duplicate, Delete, Re-import, etc.) */}

          {/* Multi-Select Operations */}
          {selectedNodes.length > 1 && (
            <>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                {selectedNodes.length} selected
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Bulk Actions
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                {/* UX-005 FIX: Enhanced menu item visual feedback */}
                <DropdownMenuContent className="bg-gray-900/95 backdrop-blur-md border-gray-700 shadow-xl">
                  <DropdownMenuItem
                    onClick={() => {
                      selectedNodes.forEach(node => handleDuplicateNode(node.id))
                    }}
                    className="text-gray-300 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate All
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      saveToHistory()
                      const nodeIds = selectedNodes.map(n => n.id)
                      setNodes((nds) => nds.filter(n => !nodeIds.includes(n.id)))
                      setEdges((eds) => eds.filter(e =>
                        !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
                      ))
                      setSelectedNodes([])
                    }}
                    className="text-red-300 hover:text-red-200 hover:bg-red-500/20 focus:bg-red-500/20 focus:text-red-200 active:bg-red-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem
                    onClick={() => {
                      saveToHistory()
                      const nodeIds = selectedNodes.map(n => n.id)
                      setNodes((nds) => nds.map(n =>
                        nodeIds.includes(n.id)
                          ? { ...n, data: { ...n.data, metadata: { ...n.data.metadata, status: 'published' } } }
                          : n
                      ))
                    }}
                    className="text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 focus:bg-emerald-500/20 focus:text-emerald-200 active:bg-emerald-500/30 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Set as Published
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      saveToHistory()
                      const nodeIds = selectedNodes.map(n => n.id)
                      setNodes((nds) => nds.map(n =>
                        nodeIds.includes(n.id)
                          ? { ...n, data: { ...n.data, metadata: { ...n.data.metadata, status: 'draft' } } }
                          : n
                      ))
                    }}
                    className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 focus:bg-amber-500/20 focus:text-amber-200 active:bg-amber-500/30 transition-colors cursor-pointer"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Set as Draft
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem
                    onClick={() => handleOpenReImportDialog()}
                    className="text-gray-300 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-import from Source
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem
                    onClick={() => {
                      const nodeIds = selectedNodes.map(n => n.id)
                      const selectedData = { nodes: selectedNodes, edges: edges.filter(e =>
                        nodeIds.includes(e.source) || nodeIds.includes(e.target)
                      )}
                      navigator.clipboard.writeText(JSON.stringify(selectedData, null, 2))
                    }}
                    className="text-gray-300 hover:text-white hover:bg-white/10 focus:bg-white/10 focus:text-white active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Group selected nodes
                      saveToHistory()
                      const groupId = `group-${Date.now()}`
                      const centerX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length
                      const centerY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

                      const groupNode: Node = {
                        id: groupId,
                        type: 'folder',
                        position: { x: centerX, y: centerY - 100 },
                        data: {
                          label: 'New Group',
                          color: '#8B5CF6',
                          children: selectedNodes.map(n => n.id)
                        }
                      }

                      const groupEdges = selectedNodes.map(n => ({
                        id: `${groupId}-${n.id}`,
                        source: groupId,
                        target: n.id,
                        type: 'smoothstep',
                        style: { stroke: 'rgba(255, 255, 255, 0.2)' }
                      }))

                      setNodes((nds) => [...nds, groupNode])
                      setEdges((eds) => [...eds, ...groupEdges])
                    }}
                    className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/20 focus:bg-purple-500/20 focus:text-purple-200 active:bg-purple-500/30 transition-colors cursor-pointer"
                  >
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Group Selected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          {/* Connect Mode Button */}
          {isConnecting && (
            <Button
              onClick={() => {
                setIsConnecting(false)
                setConnectingFrom(null)
              }}
              size="sm"
              variant="outline"
              className="bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30 text-white animate-pulse"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Click a page to connect from {nodes.find(n => n.id === connectingFrom)?.data.label}
            </Button>
          )}
          
          {/* Continue Button */}
          
          </div>
          )}
        </Panel>
        
        <Controls 
          className="bg-white/10 border-white/20"
          showZoom={false}
          showFitView={false}
          showInteractive={false}
        />
      </ReactFlow>
      </div>    
      
      {pageCreatorOpen ? (
        <AddPagePanel
          open={pageCreatorOpen}
          onClose={() => {
            setPageCreatorOpen(false)
            setPendingAddNode(null)
          }}
          pageTypes={effectivePageTypes}
          defaultSelectionId={defaultPageTypeId}
          forceHomeSelection={requireHomeSelection}
          onConfirm={handleConfirmAddPage}
        />
      ) : null}

      {/* Section Picker Modal */}
      <SectionPicker
        isOpen={sectionPickerOpen}
        onClose={() => {
          setSectionPickerOpen(false)
          setSectionPickerNodeId(null)
        }}
        onSelectSection={handleSectionSelect}
        nodeId={sectionPickerNodeId || undefined}
        websiteId={websiteId ?? undefined}
      />
      
      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        onRestartTutorial={() => {
          setShowKeyboardHelp(false)
          setShowTutorial(true)
        }}
      />

      {/* Tutorial Overlay */}
      <TutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={() => {
          markCompleted()
          setShowTutorial(false)
        }}
      />
      
      {/* Templates Modal */}
      {/* Comments System */}
      {commentsOpen && commentNodeId && (
        <CommentsSystem
          nodeId={commentNodeId}
          isOpen={commentsOpen}
          onClose={() => {
            setCommentsOpen(false)
            setCommentNodeId(null)
          }}
        />
      )}
      
      {/* Version History */}
      <VersionHistory
        isOpen={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        currentNodes={nodes}
        currentEdges={edges}
        onRestore={(version) => {
          setNodes(version.nodes)
          setEdges(version.edges)
          saveToHistory()
        }}
      />

      
      {/* AI Suggestions */}
      <AISuggestionsEnhanced
        isOpen={aiSuggestionsOpen}
        onClose={() => setAISuggestionsOpen(false)}
        nodes={nodes}
        edges={edges}
        onAddNode={(node) => {
          setNodes((nds) => [...nds, node])
          saveToHistory()
        }}
        onAddSection={(nodeId, section) => {
          handleComponentAdd(nodeId, section)
        }}
        onOptimize={(suggestion) => {
          console.log('Optimize:', suggestion)
          // Implement optimization logic
        }}
      />
      
      {/* Global Components Library */}
      <GlobalSectionsLibrary
        data-tutorial-id="component-library"
        isOpen={globalSectionsOpen}
        onClose={() => setGlobalSectionsOpen(false)}
        onAddSection={(section) => {
          // Add section to selected node or create new node
          if (selectedNodes.length > 0) {
            const nodeId = selectedNodes[0].id
            handleComponentAdd(nodeId, section.name)
          }
        }}
        currentSections={selectedNodes[0]?.data.components || []}
        websiteId={websiteId ?? undefined}
      />
      
      {/* Property Editor Panel - for page nodes */}
      <ErrorBoundary
        componentName="PropertyEditorPanel"
        resetOnPropsChange
        fallback={
          <div className="fixed right-0 top-0 h-full w-96 bg-background border-l p-4">
            <p className="text-sm text-muted-foreground">
              Property editor encountered an error. Please try closing and reopening the panel.
            </p>
          </div>
        }
      >
        <div data-tutorial-id="properties-panel">
        <PropertyEditorPanel
          isOpen={propertyPanelState.isOpen && !componentPanelOpen}
          componentId={propertyPanelState.selectedComponentId}
          onClose={closePropertyPanel}
          onPropertyChange={(propertyName, value) => {
            if (!propertyPanelState.selectedComponentId) {
              return
            }

            const currentNode = nodes.find(n => n.id === propertyPanelState.selectedComponentId)
            if (!currentNode) {
              return
            }

            const segments = propertyName.split('.')
            const dataRecord = currentNode.data as unknown as Record<string, unknown>
            const existingValue = segments.reduce<unknown>((acc, segment) => {
              if (acc == null) return undefined
              if (typeof acc !== 'object') return undefined
              return (acc as Record<string, unknown>)[segment]
            }, dataRecord)

            if (Object.is(existingValue, value)) {
              return
            }

            const nextData = { ...dataRecord }
            let cursor: Record<string, unknown> = nextData
            segments.forEach((segment, index) => {
              if (index === segments.length - 1) {
                cursor[segment] = value
                return
              }

              const existing = cursor[segment]
              if (Array.isArray(existing)) {
                cursor[segment] = [...existing]
              } else if (typeof existing === 'object' && existing !== null) {
                cursor[segment] = { ...(existing as Record<string, unknown>) }
              } else {
                cursor[segment] = {}
              }
              cursor = cursor[segment] as Record<string, unknown>
            })

            storeUpdateNode(propertyPanelState.selectedComponentId, {
              data: nextData as unknown as ProfessionalNodeData
            })
          }}
          onValidation={(errors) => {
            if (errors.length > 0) {
              console.error('Property validation errors:', errors)
            }
          }}
          onPreview={() => {
            fitView({ padding: 0.2, duration: 800 })
          }}
        />
        </div>
      </ErrorBoundary>
      
      {/* Component Properties Panel - for component instances */}
      <ComponentPropertiesPanel
        isOpen={componentPanelOpen}
        component={selectedComponent}
        nodeId={selectedComponentNodeId}
        websiteId={websiteId || undefined}
        onClose={() => {
          setComponentPanelOpen(false)
          setSelectedComponent(null)
          setSelectedComponentNodeId(null)
          setSelectedComponentId(null)
        }}
        onPropertyChange={(componentId, propertyPath, value) => {
          if (!selectedComponentNodeId || !selectedComponent) return;

          // Update local UI state only
          const nextComponentState = { ...selectedComponent, [propertyPath]: value };
          setSelectedComponent(nextComponentState);

          // Use updateComponentInNode which handles:
          // 1. Local store state update
          // 2. Debounced save via saveManager.addComponentOperation()
          // This replaces the previous direct fetch calls that caused per-keystroke saves
          if (propertyPath === 'props') {
            updateComponentInNode(selectedComponentNodeId, componentId, {
              props: value as Record<string, any>
            });
          } else {
            updateComponentInNode(selectedComponentNodeId, componentId, {
              [propertyPath]: value
            });
          }
        }}
        onDelete={(componentId, nodeId) => {
          // CP-04: Delete component with global check (shows confirmation for global components)
          handleDeleteComponentWithConfirmation(componentId, nodeId)
          // Close the panel after initiating delete
          setComponentPanelOpen(false)
          setSelectedComponent(null)
          setSelectedComponentNodeId(null)
          setSelectedComponentId(null)
        }}
      />
      <AssistantSurface
        websiteId={websiteId ?? undefined}
        selectedNodes={selectedNodes.map(node => ({
          id: node.id,
          label: (node.data as ProfessionalNodeData)?.label
        }))}
        onFocusScope={focusAssistantScope}
        autoOpen={shouldAutoOpenAssistant}
        importJobId={importJobIdParam ?? undefined}
      />

      {/* Re-import Dialog */}
      {websiteId && (
        <ReImportDialog
          isOpen={reImportDialogOpen}
          onClose={() => setReImportDialogOpen(false)}
          websiteId={websiteId}
          pages={reImportPages}
          onComplete={handleReImportComplete}
        />
      )}

      {/* CP-04: Global Component Delete Confirmation Dialog */}
      <AlertDialog open={deleteComponentDialogOpen} onOpenChange={setDeleteComponentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Global Component?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a global component ({pendingDeleteComponent?.componentName}).
              Deleting it here will only remove it from this page.
              The shared component will still be available in other pages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingDeleteComponent(null)
              setDeleteComponentDialogOpen(false)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGlobalComponent}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete from this page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TKT-048: Page/Node Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteNodeDialogOpen}
        onClose={() => {
          setDeleteNodeDialogOpen(false)
          setPendingDeleteNodeIds([])
        }}
        nodeIds={pendingDeleteNodeIds}
        onConfirm={confirmDeleteNodes}
      />

      {/* SB-CTX-03: AI Improvement Dialog */}
      <AIImprovementDialog
        isOpen={aiImprovementDialogOpen}
        onClose={() => {
          setAiImprovementDialogOpen(false)
          setAiImprovementNode(null)
        }}
        nodeId={aiImprovementNode?.id || ''}
        nodeLabel={aiImprovementNode?.label || 'Page'}
      />
    </>
  )
}

function SitemapBuilderContent() {
  const searchParams = useSearchParams()
  const importJobId = searchParams.get('importJobId')
  const router = useRouter()
  const saveStatus = useSiteBuilderStore((state) => state.saveStatus)
  const closePropertyPanel = useSiteBuilderStore((state) => state.closePropertyPanel)
  const isDirty = saveStatus === 'saving' || saveStatus === 'error'
  const websiteId = searchParams.get('websiteId')
  const conceptId = searchParams.get('conceptId') ?? undefined
  const websiteName = searchParams.get('websiteName') ?? 'this website'
  const [componentPanelOpen, setComponentPanelOpen] = useState(false)

  // SEARCH INTEGRATION: Use server-side search via SearchOverlay (Ctrl+K)
  const openSearch = useSiteBuilderStore((state) => state.openSearch)
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  const handleNavigateDashboard = useCallback(() => {
    const currentStatus = useSiteBuilderStore.getState().saveStatus
    const hasPending = currentStatus === 'saving' || currentStatus === 'error' || saveManager.getPendingCount() > 0

    if (hasPending) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave the builder?')
      if (!shouldLeave) {
        return
      }
    }

    router.push('/')
  }, [router])

  // Greenfield job hydration - polls greenfield activity API for bootstrap- prefixed jobs
  // Both hooks hydrate into the same ImportTrackerStore, so currentImportJob will find either type
  const isGreenfieldJob = importJobId?.startsWith('bootstrap-') ?? false

  // Import hydration - only enabled for non-greenfield import jobs
  // Greenfield jobs are handled by useGreenfieldHydration below
  const isImportJob = !!importJobId && !isGreenfieldJob
  useImportHydration({ jobId: importJobId, pollInterval: 2000, idlePollInterval: 120_000, enabled: isImportJob })
  useGreenfieldHydration({
    jobId: importJobId,
    websiteId: websiteId,
    pollInterval: 2000,
    idlePollInterval: 30_000,
    enabled: isGreenfieldJob,
  })

  const [isProposalDialogOpen, setProposalDialogOpen] = useState(false)

  // BUG-004 FIX: Add proper beforeunload handler for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentStatus = useSiteBuilderStore.getState().saveStatus
      const hasPending = currentStatus === 'saving' || currentStatus === 'error' || saveManager.getPendingCount() > 0

      if (hasPending) {
        e.preventDefault()
        // Modern browsers ignore custom messages, but setting returnValue is required
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const handler = () => setProposalDialogOpen(true)
    window.addEventListener('sitebuilder:export-proposal', handler)
    return () => window.removeEventListener('sitebuilder:export-proposal', handler)
  }, [])

  // Shared canvas content
  const canvasContent = (
    <div className="h-full w-full absolute inset-0" style={{ minHeight: '600px' }}>
      <DesignSystemCanvasInjector
        websiteId={websiteId || undefined}
        canvasSelector=".react-flow__viewport"
        enablePrintStyles={true}
      >
        <ReactFlowProvider>
          <ResponsiveWrapper
            onZoomChange={(zoom) => console.log('Zoom:', zoom)}
            onViewportChange={(viewport) => console.log('Viewport:', viewport)}
          >
            <SitemapFlow
              componentPanelOpen={componentPanelOpen}
              setComponentPanelOpen={setComponentPanelOpen}
            />
          </ResponsiveWrapper>
          {/* Fixed save status indicator */}
          <SaveStatusIndicator className="right-4 top-4" />
        </ReactFlowProvider>
      </DesignSystemCanvasInjector>
    </div>
  )

  // The outer layout (app/studio/site-builder/layout.tsx) handles the navigation
  return (
    <div className="h-full w-full relative bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {canvasContent}
      <ProposalExportDialog
        open={isProposalDialogOpen}
        onOpenChange={setProposalDialogOpen}
        websiteId={websiteId}
        websiteName={websiteName}
        defaultConceptId={conceptId ?? undefined}
        importJobId={importJobId ?? undefined}
      />
    </div>
  )
}

export default function SitemapBuilderDemo() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SitemapBuilderContent />
    </Suspense>
  )
}
