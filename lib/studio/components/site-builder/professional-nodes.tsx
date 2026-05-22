import React, { memo, useState, useCallback, useMemo, Fragment } from 'react'
import { toast } from 'sonner'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  FileText, ChevronDown, ChevronUp, Globe,
  Clock, CheckCircle, AlertCircle, Home, ShoppingBag,
  Users, Mail, BookOpen, Settings, Grid, Layers,
  Layout, Type, Image, Video, MessageSquare, Star,
  Zap, Target, TrendingUp, Award, Shield, Database, Folder,
  Plus, X, GripVertical, Loader2, ExternalLink, ArrowRight, Edit2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LAYOUT } from '@/lib/studio/constants/layout-constants'
import { GlobalBadge } from './global-components/GlobalBadge'
import { MakeGlobalDialog } from './global-components/MakeGlobalDialog'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { ComponentInstance, ComponentInstanceArray, isComponentInstanceArray } from '@/lib/studio/types/site-builder/component-instance'
import type { ComponentData } from '@/lib/studio/components/site-builder/types'
import { PageContextMenu, type PageContextMenuAction } from './page-context-menu'

// Component type icons mapping
const componentIcons: Record<string, any> = {

  'Hero': Home,
  'Features': Grid,
  'Testimonials': MessageSquare,
  'CTA': Target,
  'Footer': Layers,
  'About': Users,
  'Gallery': Image,
  'Video': Video,
  'Contact': Mail,
  'Map': Globe,
  'Pricing': TrendingUp,
  'FAQ': MessageSquare,
  'Team': Users,
  'Services': ShoppingBag,
  'Blog': BookOpen,
  'Newsletter': Mail,
  'Stats': Database,
  'Awards': Award,
  'Security': Shield,
  'Integration': Zap
}

function formatComponentLabel(type: string | undefined): string {
  if (!type) {
    return 'Component'
  }
  const spaced = type
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) {
    return 'Component'
  }
  return spaced
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// UX-001 FIX: Improved function to filter out raw JSON from component descriptions
function extractSummaryField(source: unknown): string | undefined {
  if (!source) {
    return undefined
  }
  if (typeof source === 'string') {
    const trimmed = source.trim()
    if (!trimmed) {
      return undefined
    }
    // Filter out JSON-like strings (starts with { or [, or contains JSON patterns)
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed)
        // If successfully parsed, try to extract summary from the parsed object
        return extractSummaryField(parsed)
      } catch {
        // If it looks like JSON but fails to parse, filter it out
        if (trimmed.includes('":') || trimmed.includes('\\"')) {
          return undefined
        }
        // Not JSON, return as-is
        return trimmed
      }
    }
    // Filter out strings that look like escaped JSON or contain technical data
    if (trimmed.includes('\\\"') || trimmed.includes('\\":') ||
        trimmed.includes('https://') || trimmed.includes('src=')) {
      return undefined
    }
    // If it's a reasonable length and looks like human-readable text, return it
    if (trimmed.length > 200) {
      return trimmed.substring(0, 100) + '...'
    }
    return trimmed
  }
  if (typeof source !== 'object') {
    return undefined
  }
  // Try to get summary, title, or name fields from objects
  const obj = source as Record<string, unknown>
  const candidates = [obj.summary, obj.title, obj.name, obj.heading, obj.label]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const text = candidate.trim()
      // Filter out technical-looking strings
      if (!text.includes('{') && !text.includes('[') && !text.includes('\\')) {
        return text.length > 100 ? text.substring(0, 100) + '...' : text
      }
    }
  }
  return undefined
}

function hasCanonicalContent(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0
}

function getCanonicalContentWithLegacyReadFallback(component: any): Record<string, unknown> {
  if (hasCanonicalContent(component.content)) {
    return component.content
  }

  const legacyReadPropsContent = component.props?.content
  if (hasCanonicalContent(legacyReadPropsContent)) {
    return legacyReadPropsContent
  }

  return {}
}

export function getComponentSummary(component: ComponentInstance): string | undefined {
  const props = (component.props ?? {}) as Record<string, unknown>
  const sources: unknown[] = [
    props.metadata,
    (component as unknown as Record<string, unknown>).metadata,
    component.content,
    props.content,
    props.text
  ]

  for (const candidate of sources) {
    const summary = extractSummaryField(candidate)
    if (summary) {
      return summary
    }
  }

  return undefined
}
// Professional color palette
const statusColors = {
  published: {
    label: 'Published',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle
  },
  draft: {
    label: 'Draft',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock
  },
  review: {
    label: 'In Review',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: AlertCircle
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: Clock
  },
  'import-pending': {
    label: 'Waiting',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: Clock
  },
  'import-processing': {
    label: 'Importing',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    icon: Clock
  },
  'import-ready': {
    label: 'Ready',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    icon: CheckCircle
  },
  'import-error': {
    label: 'Failed',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: AlertCircle
  },
  'import-invalid': {
    label: 'Needs Fix',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    icon: AlertCircle
  },
  'import-skipped': {
    label: 'Skipped',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-300',
    icon: Clock
  }
} as const

// SEO score colors
const seoScoreColors = (score: number) => {
  if (score >= 90) return 'text-emerald-400 bg-emerald-500/10'
  if (score >= 70) return 'text-green-400 bg-green-500/10'
  if (score >= 50) return 'text-amber-400 bg-amber-500/10'
  return 'text-red-400 bg-red-500/10'
}

/**
 * Migration function to convert string arrays to ComponentInstance objects
 * This handles backward compatibility with existing data structures
 */
export const migrateComponentsToInstances = (components: any): ComponentInstanceArray => {
  if (!components) return []
  
  // If already ComponentInstance array, return as-is
  if (isComponentInstanceArray(components)) {
    if (process.env.NODE_ENV === 'development') {
    console.log('[Site Builder] Components already in new format')
    }
    return components.map((component) => ({
      ...component,
      content: getCanonicalContentWithLegacyReadFallback(component)
    })) as ComponentInstanceArray
  }
  
  // If it's an array, check what type of data we have
  if (Array.isArray(components)) {
    if (process.env.NODE_ENV === 'development') {
    console.log('[Site Builder] Checking component array type:', components)
    }
    
    // Check if ALL items are strings (legacy format)
    if (components.every(c => typeof c === 'string')) {
      if (process.env.NODE_ENV === 'development') {
      console.log('[Site Builder] Migrating string array to ComponentInstance objects')
      }
      
      return components.map((componentType: string, index: number) => ({
        id: `${componentType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
        type: componentType,
        parentId: null,
        position: index,
        props: {},
        content: {
          text: '',
          images: [],
          links: []
        },
        styles: {
          desktop: {},
          tablet: {},
          mobile: {}
        },
        metadata: {
          locked: false,
          visible: true,
          aiGenerated: false
        }
      }))
    }
    
    // Handle component objects that have at least a 'type' field
    // This covers both:
    // 1. API format (has id and type)
    // 2. Greenfield bootstrap format (has type but no id - we generate id)
    if (components.length > 0 && components[0].type) {
      if (process.env.NODE_ENV === 'development') {
      console.log('[Site Builder] Converting component objects to instances')
      }

      return components
        .filter((component: any) => component && typeof component.type === 'string')
        .map((component: any, index: number) => {
        // Generate an ID if not present (greenfield bootstrap components don't have IDs)
        const componentId = component.id ||
          `${component.type.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`

        // The API returns components with props containing text, metadata, etc.
        // Greenfield returns components with props at root level (e.g., menuItems, logo)
        // Extract known component-specific props to keep them accessible
        const knownRootProps = ['cta', 'logo', 'sticky', 'menuItems', 'heading', 'subheading',
          'items', 'image', 'images', 'text', 'description', 'title', 'buttons', 'fields',
          'eyebrow', 'primaryCta', 'secondaryCta', 'features', 'testimonials', 'gallery']
        const extractedProps: Record<string, any> = {}
        for (const prop of knownRootProps) {
          if (component[prop] !== undefined) {
            extractedProps[prop] = component[prop]
          }
        }

        return {
          id: componentId,
          type: component.type,
          parentId: component.parentId || null,
          position: component.position ?? index,
          props: { ...extractedProps, ...(component.props || {}) },
          content: getCanonicalContentWithLegacyReadFallback(component),
          styles: component.props?.styles || component.styles || {},
          metadata: component.props?.metadata || component.metadata || {},
          globalComponentId: component.globalComponentId
        }
      })
    }
  }

  if (process.env.NODE_ENV === 'development') {
  console.warn('[Site Builder] Unknown component format, returning empty array:', components)
  }
  return []
}

export interface ProfessionalNodeData {
  label: string
  url?: string
  slug?: string
  components?: ComponentInstanceArray | ComponentData[]
  description?: string
  expanded?: boolean
  collapsed?: boolean
  children?: string[]
  color?: string
  isEditing?: boolean
  websiteId?: string
  // Viewport sync properties
  _detailLevel?: 'skeleton' | 'minimal' | 'standard' | 'full'
  _needsDetailLoad?: boolean
  componentCount?: number
  // Dynamic node dimensions (from server-calculated level heights)
  _nodeWidth?: number
  _nodeHeight?: number
  metadata?: {
    status?: 'published' | 'draft' | 'review' | 'scheduled' | 'import-pending' | 'import-processing' | 'import-ready' | 'import-error' | 'import-invalid' | 'import-skipped'
    pageType?: string
    seoScore?: number
    lastModified?: string
    author?: string
    priority?: 'high' | 'medium' | 'low'
    template?: string
    importStatus?: 'pending' | 'processing' | 'ready' | 'error' | 'invalid' | 'skipped'
    isPlaceholder?: boolean
    importOrder?: number
    importSource?: string
    importSourceNormalized?: string
    importParentUrl?: string
    slug?: string
  }
  stats?: {
    views?: number
    conversions?: number
    bounceRate?: number
  }
  onToggleCollapse?: (nodeId: string) => void
  onComponentsReorder?: (nodeId: string, components: ComponentInstanceArray) => void
  onLabelChange?: (nodeId: string, newLabel: string) => void
  onComponentAdd?: (nodeId: string, component: string, afterIndex?: number) => void
  onComponentRemove?: (nodeId: string, componentIndex: number) => void
  onAddPage?: (nodeId: string, position: 'top' | 'bottom' | 'left' | 'right') => void
  onComponentMadeGlobal?: (nodeId: string, component: ComponentInstance, globalComponentId: string) => void
  onComponentClick?: (component: ComponentInstance) => void
  onNodeClick?: (nodeId: string) => void
  onContextMenuAction?: (nodeId: string, action: PageContextMenuAction) => void
}


// UX-004 FIX: Helper to compute duplicate numbering for component labels
function computeComponentLabelWithNumber(
  component: ComponentInstance,
  index: number,
  allComponents: ComponentInstance[]
): string {
  const baseLabel = formatComponentLabel(component.type)
  const sameTypeComponents = allComponents.filter(c => formatComponentLabel(c.type) === baseLabel)

  // If only one component of this type, no numbering needed
  if (sameTypeComponents.length <= 1) {
    return baseLabel
  }

  // Find the index of this component among same-type components
  const sameTypeIndex = sameTypeComponents.findIndex(c => c.id === component.id)
  return `${baseLabel} (${sameTypeIndex + 1})`
}

// Component Item with inline editing
interface ComponentItemProps {
  component: ComponentInstance
  index: number
  nodeId: string
  totalComponents: number
  websiteId?: string
  displayLabel?: string // UX-004: Optional display label with duplicate numbering
  onMoveUp?: (nodeId: string, index: number) => void
  onMoveDown?: (nodeId: string, index: number) => void
  onComponentRemove?: (nodeId: string, index: number) => void
  onComponentAdd?: (nodeId: string, component: string, afterIndex?: number) => void
  onComponentClick?: (component: ComponentInstance) => void
  onComponentMadeGlobal?: (component: ComponentInstance, globalComponentId: string) => void
  onComponentsReorder?: (nodeId: string, components: ComponentInstanceArray) => void
  allComponents?: ComponentInstanceArray
  isGlobal?: boolean
  usageCount?: number
}

const ComponentItem = memo(({ component, index, nodeId, totalComponents, onComponentAdd, onComponentClick, onMoveUp, onMoveDown, onComponentsReorder, allComponents, isGlobal, usageCount, displayLabel }: ComponentItemProps) => {
  const Icon = componentIcons[component.type] || Layers
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  
  // Check if this component is selected
  const selectedComponentId = useSiteBuilderStore(state => state.selectedComponentId)
  const getSelectedComponent = useSiteBuilderStore(state => state.getSelectedComponent)
  const selectedGlobalKey = useMemo(() => {
    const sel = getSelectedComponent?.()
    if (!sel) return null
    if ((sel as any).globalComponentId) return `id:${(sel as any).globalComponentId}`
    const t = String(sel.type || '').toLowerCase()
    if (t === 'navbar' || t === 'footer' || t === 'header') return `type:${t}`
    return null
  }, [getSelectedComponent])
  const isSelected = selectedComponentId === component.id
  
  // Check if global (prefer prop, fallback to store detection, then heuristic by type)
  const globalComponents = useSiteBuilderStore(state => state.globalComponents)
  const detectedGlobal = component.globalComponentId 
    ? globalComponents.has(component.globalComponentId) 
    : component.metadata?.isGlobal || false
  const isGlobalComponent = typeof isGlobal === 'boolean' ? isGlobal : detectedGlobal

  const ownGlobalKey = useMemo(() => {
    if ((component as any).globalComponentId) return `id:${(component as any).globalComponentId}`
    return null
  }, [component])

  const isSelectedVisually = selectedComponentId === component.id || (!!selectedGlobalKey && !!ownGlobalKey && selectedGlobalKey === ownGlobalKey)
  // UX-004: Use displayLabel with duplicate numbering if provided, otherwise fall back to base label
  const label = useMemo(() => displayLabel || formatComponentLabel(component.type), [displayLabel, component.type])
  const summary = useMemo(() => getComponentSummary(component), [component])

  // Drag handlers for component reordering
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }, [index])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setDragOverIndex(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [index])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    const dropIndex = index

    if (draggedIndex === dropIndex || !allComponents || !onComponentsReorder) {
      setDragOverIndex(null)
      return
    }

    // Reorder components array
    const newComponents = [...allComponents]
    const [draggedItem] = newComponents.splice(draggedIndex, 1)
    newComponents.splice(dropIndex, 0, draggedItem)

    // Update positions
    const reorderedComponents = newComponents.map((comp, idx) => ({
      ...comp,
      position: idx
    }))

    onComponentsReorder(nodeId, reorderedComponents)
    setDragOverIndex(null)
  }, [index, allComponents, onComponentsReorder, nodeId])

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-move',
          'border transition-all duration-150',
          isDragging && 'opacity-40 cursor-grabbing',
          dragOverIndex === index && !isDragging && 'border-t-2 border-t-[#FF5500]',
          isSelectedVisually
            ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-[0_0_8px_rgba(255,85,0,0.3)]'
            : isHovered
              ? 'border-[#FF5500]/50 bg-white/[0.04] shadow-[0_0_6px_rgba(255,85,0,0.2)]'
              : 'border-gray-200/20',
          isGlobalComponent && 'bg-blue-500/15'
        )}
        onClick={(e) => {
          e.stopPropagation()
          if (onComponentClick) {
            onComponentClick(component)
          }
        }}
        title={isHovered ? 'Click to edit properties' : label}
      >
        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 font-medium select-none truncate">
            {label}
          </p>
          {summary && (
            <p className="text-[11px] text-gray-500 select-none truncate">
              {summary}
            </p>
          )}
        </div>
        {/* No badge or extra text for global items per UX request */}

        {/* Edit icon - visible on hover */}
        {isHovered && (
          <Edit2 className="w-3.5 h-3.5 text-gray-400 hover:text-[#FF5500] shrink-0 transition-colors" />
        )}

        {/* Move up/down buttons - visible on hover */}
        {isHovered && totalComponents && totalComponents > 1 && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className={cn(
                'p-0.5 rounded transition-colors',
                index === 0
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (index > 0 && onMoveUp) {
                  onMoveUp(nodeId, index)
                }
              }}
              disabled={index === 0}
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              className={cn(
                'p-0.5 rounded transition-colors',
                index === totalComponents - 1
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (index < totalComponents - 1 && onMoveDown) {
                  onMoveDown(nodeId, index)
                }
              }}
              disabled={index === totalComponents - 1}
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* + Button above first component: keep in DOM, toggle visibility */}
      <button
        className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-200',
          isHovered && index === 0 ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onComponentAdd?.(nodeId, '__OPEN_PICKER__', -1)
        }}
      >
        <div className="flex items-center justify-center w-6 h-6 bg-[#FF5500] rounded-full shadow-lg hover:bg-[#FF6600] transition-colors">
          <Plus className="w-4 h-4 text-white" />
        </div>
      </button>
      
      {/* + Button below component: keep in DOM, toggle visibility */}
      <button
        className={cn(
          'absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-200',
          isHovered ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onComponentAdd?.(nodeId, '__OPEN_PICKER__', index)
        }}
      >
        <div className="flex items-center justify-center w-6 h-6 bg-[#FF5500] rounded-full shadow-lg hover:bg-[#FF6600] transition-colors">
          <Plus className="w-4 h-4 text-white" />
        </div>
      </button>
    </div>
  )
})
ComponentItem.displayName = 'ComponentItem'

// Predefined available component types - Complete list from screenshots
const availableComponentTypes = [
  'Navbar',
  'Footer',
  'Hero Header',
  'Header',
  'Feature Section',
  'Features List Section',
  'How It Works Section',
  'Benefits Section',
  'About Section',
  'CTA Section',
  'Contact Section',
  'Pricing Section',
  'Testimonial Section',
  'FAQ Section',
  'Logo List',
  'Gallery Section',
  'Team Section',
  'Job Listings',
  'Blog List Header',
  'Blog List Section',
  'Blog Post Header',
  'Blog Post Body',
  'Portfolio List',
  'Portfolio Item Header',
  'Portfolio Item Body',
  'Products List',
  'Product Header',
  'Announcement Banner',
  'Project Item Header Section',
  'Ecommerce Product Header Section',
  'Ecommerce Product Section',
]

// Professional Page Node Component with inline component list
export const ProfessionalPageNode = memo(({ id, data, selected }: NodeProps<ProfessionalNodeData>) => {
  const [isHovered, setIsHovered] = useState(false)
  const [components, setComponents] = useState<ComponentInstanceArray>(() =>
    migrateComponentsToInstances(data.components)
  )
  const [editingLabel, setEditingLabel] = useState(data.isEditing || false)

  // Use dynamic dimensions from server (for level-based heights) with fallback to constants
  const effectiveWidth = data._nodeWidth ?? LAYOUT.NODE_WIDTH
  const effectiveHeight = data._nodeHeight // May be undefined - use auto-height if not set
  const [labelValue, setLabelValue] = useState(data.label)
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null)
  const [hoveredPagePosition, setHoveredPagePosition] = useState<'top' | 'bottom' | 'left' | 'right' | null>(null)
  
  // Get store actions for component selection
  const setSelectedComponentId = useSiteBuilderStore(state => state.setSelectedComponentId)
  const globalComponentsMap = useSiteBuilderStore(state => state.globalComponents)
  // Note: single list rendering; no need to scan all nodes for grouping

  // Update editing state when prop changes
  React.useEffect(() => {
    if (data.isEditing) {
      setEditingLabel(true)
      setLabelValue(data.label)
    } else {
      setEditingLabel(false)
    }
  }, [data.isEditing, data.label])
  
  // Sync components with props - apply migration if needed
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    console.log('[ProfessionalPageNode] data.components received:', data.components)
    }
    const migrated = migrateComponentsToInstances(data.components)
    if (process.env.NODE_ENV === 'development') {
    console.log('[ProfessionalPageNode] migrated components:', migrated)
    }
    setComponents(migrated)
  }, [data.components])
  
  // Handle component click for selection (NEW-006 enhancement)
  // Provides clear feedback that a component was selected and editor is opening
  const handleComponentClick = useCallback((component: ComponentInstance) => {
    setSelectedComponentId(component.id)
    const globalId = (component as any).globalComponentId as string | undefined

    // Only show toast for global components (important warning about multi-page impact)
    if (globalId && globalComponentsMap.has(globalId)) {
      const usage = globalComponentsMap.get(globalId)?.usageCount
      toast.info(
        `Editing global component`,
        {
          description: `Changes may affect ${typeof usage === 'number' ? usage : 'multiple'} page(s). Editor panel opening...`,
          duration: 3000,
        }
      )
    }
    // Regular component selection: no toast needed - visual highlight is sufficient

    if (data.onComponentClick) {
      data.onComponentClick(component)
    }
  }, [setSelectedComponentId, data, globalComponentsMap])

  // No grouped rendering; keep a single list for clarity per UX
  
  // Handle component reordering with up/down buttons
  const handleMoveUp = useCallback((nodeId: string, index: number) => {
    if (index > 0) {
      const newComponents = [...components]
      const temp = newComponents[index]
      newComponents[index] = newComponents[index - 1]
      newComponents[index - 1] = temp
      setComponents(newComponents)
      
      // Call parent callback
      if (data.onComponentsReorder) {
        data.onComponentsReorder(id, newComponents)
      }
    }
  }, [components, id, data])
  
  const handleMoveDown = useCallback((nodeId: string, index: number) => {
    if (index < components.length - 1) {
      const newComponents = [...components]
      const temp = newComponents[index]
      newComponents[index] = newComponents[index + 1]
      newComponents[index + 1] = temp
      setComponents(newComponents)
      
      // Call parent callback
      if (data.onComponentsReorder) {
        data.onComponentsReorder(id, newComponents)
      }
    }
  }, [components, id, data])
  
  const status = (data.metadata?.status || 'draft') as keyof typeof statusColors
  const statusConfig = statusColors[status] ?? statusColors.draft
  const StatusIcon = statusConfig.icon
  const statusLabel = statusConfig.label
  const isImporting = status === 'import-pending' || status === 'import-processing'
  const isPlaceholder = Boolean(data.metadata?.isPlaceholder ?? (isImporting && components.length === 0))

  // Check for skeleton loading state (viewport sync)
  const isSkeletonLoading = data._detailLevel === 'skeleton' || data._needsDetailLoad === true

  // DEBUG: Log the actual values causing skeleton state
  if (isSkeletonLoading) {
    if (process.env.NODE_ENV === 'development') {
    console.log('[ProfessionalPageNode] SKELETON STATE:', {
      nodeId: id,
      _detailLevel: data._detailLevel,
      _needsDetailLoad: data._needsDetailLoad,
      label: data.label,
    })
    }
  }

  // Render skeleton placeholder for nodes that haven't loaded details yet
  if (isSkeletonLoading) {
    return (
      <div
        className={cn(
          'relative rounded-xl border-2 bg-gray-900/95 backdrop-blur-sm shadow-lg',
          'transition-all duration-200',
          selected ? 'border-blue-500 shadow-blue-500/20' : 'border-gray-700',
        )}
        style={{
          width: effectiveWidth,
          // Apply fixed height from server to prevent overlap (use overflow for content that exceeds)
          ...(effectiveHeight ? { height: effectiveHeight, overflow: 'hidden' } : {}),
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-gray-600 !border-2 !border-gray-500"
        />

        {/* Skeleton header */}
        <div className="px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-700 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-700/50 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </div>

        {/* Skeleton content */}
        <div className="px-4 py-3 space-y-2">
          <div className="h-3 bg-gray-700/30 rounded animate-pulse" />
          <div className="h-3 bg-gray-700/30 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-gray-700/30 rounded animate-pulse w-4/5" />
        </div>

        {/* Loading indicator */}
        <div className="absolute bottom-2 right-2">
          <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-gray-600 !border-2 !border-gray-500"
        />
      </div>
    )
  }

  return (
    <PageContextMenu nodeId={id} onAction={data.onContextMenuAction}>
      <div
        className={cn(
          'node-card relative',
          'bg-gray-900 rounded-xl transition-all duration-200',
          'shadow-lg',
          selected
            ? 'ring-2 ring-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.3)]'
            : isHovered
              ? 'shadow-xl border border-white/[0.1]'
              : '',
          data.collapsed && 'node-collapsed'
        )}
        style={{
          minWidth: effectiveWidth,
          maxWidth: effectiveWidth + 40, // Allow slight flexibility for content
          // TKT-001: Use minHeight instead of fixed height to prevent content clipping
          // overflow: visible allows + buttons to render outside node bounds
          ...(effectiveHeight ? { minHeight: effectiveHeight, overflow: 'visible' } : {}),
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          setHoveredPagePosition(null)
        }}
      >
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-gray-600 to-gray-700 !border-2 transition-all',
          selected || isHovered ? '!border-[#FF5500]' : '!border-gray-500'
        )}
      />
      
      {/* Header */}
      <div className="p-3 border-b border-gray-200/20">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <div className={cn(
              'p-1.5 rounded-lg',
              data.label.toLowerCase() === 'home' 
                ? 'bg-gradient-to-br from-[#FF5500]/20 to-[#FF6600]/20'
                : 'bg-white/5'
            )}>
              <FileText className={cn(
                'w-4 h-4',
                data.label.toLowerCase() === 'home' ? 'text-[#FF5500]' : 'text-gray-400'
              )} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm px-1 rounded select-none">
                {data.label}
              </h3>
              {data.url && (
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{data.url}</p>
              )}
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs',
            statusConfig.bg,
            statusConfig.border,
            statusConfig.text,
            'border'
          )}>
            <StatusIcon className="w-3 h-3" />
            <span className="capitalize">{statusLabel}</span>
          </div>
        </div>
        
        {/* Metadata */}
        {data.metadata && (
          <div className="flex items-center gap-3 text-xs">
            {data.metadata.seoScore !== undefined && (
              <div className={cn(
                'px-2 py-0.5 rounded-md font-medium',
                seoScoreColors(data.metadata.seoScore)
              )}>
                SEO: {data.metadata.seoScore}%
              </div>
            )}
            {data.metadata.pageType && (
              <span className="text-gray-500">{data.metadata.pageType}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Components Section - Always visible */}
      <div className="p-3">
        {isPlaceholder ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-1">Importing content...</p>
            <p className="text-xs text-gray-500">Status: {statusLabel}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Component List with hover insert buttons */}
            {components.length > 0 ? (
              <div
                className="space-y-1 relative"
                onMouseLeave={() => setHoveredInsertIndex(null)}
              >
                {components.map((component, index) => (
                  <ComponentItem
                    key={`${component.id}-${index}`}
                    component={component}
                    index={index}
                    nodeId={id}
                    totalComponents={components.length}
                    websiteId={data.websiteId}
                    onComponentAdd={data.onComponentAdd}
                    onComponentClick={handleComponentClick}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onComponentsReorder={data.onComponentsReorder}
                    allComponents={components}
                    // UX-004: Pass computed label with duplicate numbering
                    displayLabel={computeComponentLabelWithNumber(component, index, components)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-gray-600 mb-2">No components</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (data.onComponentAdd) {
                      data.onComponentAdd(id, '__OPEN_PICKER__')
                    }
                  }}
                  className="px-3 py-1.5 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-lg text-xs text-gray-500 hover:text-gray-400 hover:border-white/20 hover:bg-white/[0.04] transition-all"
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  Add First Component
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Stats Footer */}
      {data.stats && (
        <div className="px-3 pb-3 pt-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            {data.stats.views && (
              <span>👁 {data.stats.views.toLocaleString()}</span>
            )}
            {data.stats.conversions && (
              <span>🎯 {data.stats.conversions}%</span>
            )}
            {data.stats.bounceRate && (
              <span>📊 {data.stats.bounceRate}%</span>
            )}
          </div>
        </div>
      )}
      
      {/* Page Addition Buttons - Show on hover (TKT-001: Improved visibility with brand orange) */}
      {isHovered && data.onAddPage && !data.collapsed && !isPlaceholder && (
        <>
          {/* Render page addition buttons with consistent styling */}
          {[
            { position: 'top' as const, positionClass: '-top-4 left-1/2 -translate-x-1/2', title: 'Add child page above' },
            { position: 'bottom' as const, positionClass: '-bottom-4 left-1/2 -translate-x-1/2', title: 'Add child page below' },
            { position: 'left' as const, positionClass: '-left-4 top-1/2 -translate-y-1/2', title: 'Add sibling page to the left' },
            { position: 'right' as const, positionClass: '-right-4 top-1/2 -translate-y-1/2', title: 'Add sibling page to the right' }
          ].map(({ position, positionClass, title }) => (
            <button
              key={position}
              className={cn(
                'absolute z-30 w-8 h-8',
                'bg-[#FF5500]/80 border border-[#FF5500]',
                'hover:bg-[#FF5500] hover:scale-110',
                'rounded-full flex items-center justify-center',
                'transition-all duration-200 shadow-lg',
                positionClass
              )}
              onClick={(e) => {
                e.stopPropagation()
                data.onAddPage?.(id, position)
              }}
              onMouseEnter={() => setHoveredPagePosition(position)}
              onMouseLeave={() => setHoveredPagePosition(null)}
              title={title}
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          ))}
        </>
      )}
      
      {/* Preview Lines - Show when hovering over buttons */}
      {hoveredPagePosition && (
        <>
          {/* Top/Bottom Preview Lines (horizontal) */}
          {(hoveredPagePosition === 'top' || hoveredPagePosition === 'bottom') && (
            <div className={cn(
              "absolute left-0 right-0 h-0.5 bg-white/30 z-20 transition-all duration-200 animate-pulse",
              "before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent",
              hoveredPagePosition === 'top' ? '-top-6' : '-bottom-6'
            )} />
          )}
          
          {/* Left/Right Preview Lines (vertical) */}
          {(hoveredPagePosition === 'left' || hoveredPagePosition === 'right') && (
            <div className={cn(
              "absolute top-0 bottom-0 w-0.5 bg-white/30 z-20 transition-all duration-200 animate-pulse",
              "before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-b before:from-transparent before:via-white/50 before:to-transparent",
              hoveredPagePosition === 'left' ? '-left-6' : '-right-6'
            )} />
          )}
        </>
      )}
      
      {/* Collapse Indicator */}
      {data.collapsed && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-xl">
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-gray-600 to-gray-700 !border-2 transition-all',
          selected || isHovered ? '!border-[#FF5500]' : '!border-gray-500'
        )}
      />
      </div>
    </PageContextMenu>
  )
})
ProfessionalPageNode.displayName = 'ProfessionalPageNode'

// Professional Folder Node Component
export const ProfessionalFolderNode = memo(({ id, data, selected }: NodeProps<ProfessionalNodeData>) => {
  const [isHovered, setIsHovered] = useState(false)
  const [editingLabel, setEditingLabel] = useState(data.isEditing || false)
  const [labelValue, setLabelValue] = useState(data.label)

  // Use dynamic dimensions from server with fallback to constants
  const effectiveWidth = data._nodeWidth ?? LAYOUT.NODE_WIDTH - 60 // Folders are narrower by default
  const effectiveHeight = data._nodeHeight // May be undefined - use auto-height if not set

  // Update editing state when prop changes
  React.useEffect(() => {
    if (data.isEditing) {
      setEditingLabel(true)
      setLabelValue(data.label)
    } else {
      setEditingLabel(false)
    }
  }, [data.isEditing, data.label])

  return (
    <div
      className={cn(
        'node-card relative',
        'bg-gray-900 rounded-xl transition-all duration-200',
        'shadow-lg',
        selected
          ? 'ring-2 ring-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.3)]'
          : isHovered
            ? 'shadow-xl'
            : '',
        data.collapsed && 'node-collapsed'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minWidth: effectiveWidth,
        maxWidth: effectiveWidth + 20, // Allow slight flexibility
        // Apply fixed height from server to prevent overlap
        ...(effectiveHeight ? { height: effectiveHeight, overflow: 'hidden' } : {}),
        borderColor: data.color || '#F97316',
        borderWidth: '2px',
        borderStyle: 'solid',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-gray-600 to-gray-700 !border-2 transition-all',
          selected || isHovered ? '!border-[#FF5500]' : '!border-gray-500'
        )}
      />
      
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div 
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${data.color || '#F97316'}20` }}
          >
            <Folder className="w-4 h-4" style={{ color: data.color || '#F97316' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm px-1 rounded select-none">
              {data.label}
            </h3>
            {data.children && data.children.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {data.children.length} {data.children.length === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          {data.onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onToggleCollapse?.(id)
              }}
              className="p-1 rounded hover:bg-white/10 opacity-60 hover:opacity-100"
            >
              <ChevronDown className={cn(
                'w-4 h-4 text-gray-400 transition-transform',
                data.collapsed && '-rotate-90'
              )} />
            </button>
          )}
        </div>
      </div>
      
      {/* Collapse Indicator */}
      {data.collapsed && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-xl">
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-gray-600 to-gray-700 !border-2 transition-all',
          selected || isHovered ? '!border-[#FF5500]' : '!border-gray-500'
        )}
      />
    </div>
  )
})
ProfessionalFolderNode.displayName = 'ProfessionalFolderNode'

// Professional Redirect Node Component - for external redirect links
export interface RedirectNodeData extends ProfessionalNodeData {
  redirectInfo?: {
    sourcePath: string
    targetUrl: string
    isExternal: boolean
    redirectType: number
    showInNav?: boolean
    navLabel?: string
    openInNewTab?: boolean
  }
}

export const ProfessionalRedirectNode = memo(({ id, data, selected }: NodeProps<RedirectNodeData>) => {
  const [isHovered, setIsHovered] = useState(false)
  const redirectInfo = data.redirectInfo
  const isExternal = redirectInfo?.isExternal ?? true
  const targetUrl = redirectInfo?.targetUrl ?? ''

  // Use dynamic dimensions from server with fallback to constants
  const effectiveWidth = data._nodeWidth ?? LAYOUT.NODE_WIDTH - 40
  const effectiveHeight = data._nodeHeight // May be undefined - use auto-height if not set

  // Truncate long URLs for display
  const displayUrl = targetUrl.length > 40
    ? targetUrl.substring(0, 37) + '...'
    : targetUrl

  return (
    <div
      className={cn(
        'node-card relative',
        'bg-gray-900 rounded-xl transition-all duration-200',
        'shadow-lg',
        selected
          ? 'ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
          : isHovered
            ? 'shadow-xl'
            : ''
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minWidth: effectiveWidth,
        maxWidth: effectiveWidth + 40,
        // Apply fixed height from server to prevent overlap
        ...(effectiveHeight ? { height: effectiveHeight, overflow: 'hidden' } : {}),
        borderColor: '#3B82F6',
        borderWidth: '2px',
        borderStyle: 'dashed',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-blue-600 to-blue-700 !border-2 transition-all',
          selected || isHovered ? '!border-blue-400' : '!border-gray-500'
        )}
      />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg bg-blue-500/20"
          >
            {isExternal ? (
              <ExternalLink className="w-4 h-4 text-blue-400" />
            ) : (
              <ArrowRight className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-white text-sm truncate">
                {data.label || redirectInfo?.sourcePath || 'Redirect'}
              </h3>
              {isExternal && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full shrink-0">
                  External
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <span className="truncate" title={targetUrl}>
                {isExternal ? '→' : '↳'} {displayUrl}
              </span>
            </div>
            {redirectInfo?.redirectType && (
              <div className="mt-1">
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  redirectInfo.redirectType === 301
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                )}>
                  {redirectInfo.redirectType} {redirectInfo.redirectType === 301 ? 'Permanent' : 'Temporary'}
                </span>
              </div>
            )}
          </div>
          {data.onNodeClick && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onNodeClick?.(id)
              }}
              className="p-1 rounded hover:bg-white/10 opacity-60 hover:opacity-100"
              title="Edit redirect"
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          'w-3 h-3 !bg-gradient-to-br from-blue-600 to-blue-700 !border-2 transition-all',
          selected || isHovered ? '!border-blue-400' : '!border-gray-500'
        )}
      />
    </div>
  )
})
ProfessionalRedirectNode.displayName = 'ProfessionalRedirectNode'

// Export all node types
export const professionalNodeTypes = {
  page: ProfessionalPageNode,
  folder: ProfessionalFolderNode,
  redirect: ProfessionalRedirectNode,
}















