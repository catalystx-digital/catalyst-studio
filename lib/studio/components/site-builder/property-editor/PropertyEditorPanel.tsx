'use client'

import { createPortal } from 'react-dom'
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { X, ChevronLeft, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store'
import { usePropertyPreview } from './usePropertyPreview'
import { ValidationError } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { PANEL_DIMENSIONS, COLOR_STYLES } from './constants'
import DOMPurify from 'isomorphic-dompurify'
import * as FocusScope from '@radix-ui/react-focus-scope'
import { FieldDispatcher } from './FieldDispatcher'
import type { FieldSchema } from './schema/types'
import { getSchemaForContent } from '@/lib/studio/components/cms/_factory/schema-accessor'
import { saveManager } from '../save-manager'
import { toast } from 'sonner'
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

/**
 * Default schema for page properties.
 * Pages don't have .def.ts files like components, so we use a hardcoded schema.
 * This ensures page properties panel always shows editable fields.
 */
const DEFAULT_PAGE_SCHEMA: FieldSchema[] = [
  { name: 'label', type: 'string', label: 'Page Title', required: true },
  { name: 'slug', type: 'string', label: 'URL Slug', required: true },
  { name: 'metadata.title', type: 'string', label: 'SEO Title' },
  { name: 'metadata.description', type: 'text', label: 'Meta Description', rows: 3 },
  { name: 'metadata.keywords', type: 'string', label: 'Keywords' },
  { name: 'metadata.ogImage', type: 'image', label: 'Social Share Image' },
  { name: 'showInNav', type: 'boolean', label: 'Show in Navigation' },
  { name: 'isPublished', type: 'boolean', label: 'Published' },
]

// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Deep utility helpers for safe nested reads/writes using dot-paths
function getByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj)
}

function setByPathImmutable(base: any, path: string, value: any): any {
  const segments = path.split('.')
  const clone = Array.isArray(base) ? base.slice() : { ...(base || {}) }
  let cursor: any = clone
  for (let i = 0; i < segments.length; i++) {
    const key = segments[i]
    if (i === segments.length - 1) {
      cursor[key] = value
    } else {
      const next = cursor[key]
      const nextObj = typeof next === 'object' && next != null ? (Array.isArray(next) ? next.slice() : { ...next }) : {}
      cursor[key] = nextObj
      cursor = nextObj
    }
  }
  return clone
}

export interface PropertyEditorPanelProps {
  isOpen: boolean
  componentId: string | null
  onClose: () => void
  onPropertyChange: (propertyName: string, value: any) => void
  onValidation: (errors: ValidationError[]) => void
  onPreview: () => void
  previewIframeRef?: React.RefObject<HTMLIFrameElement>
}

export const PropertyEditorPanel: React.FC<PropertyEditorPanelProps> = ({
  isOpen,
  componentId,
  onClose,
  onPropertyChange,
  onValidation,
  onPreview,
  previewIframeRef
}) => {
  const { nodes, edges, updateNode, captureState, selectedComponentId, getSelectedComponent, updateComponentInNode, deleteNodes } = useSiteBuilderStore()
  const websiteId = useSiteBuilderStore(state => state.websiteId)
  const [activeTab, setActiveTab] = useState('properties')
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number>(PANEL_DIMENSIONS.DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<number>(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isPortalReady, setIsPortalReady] = useState(false)

  useEffect(() => {
    setIsPortalReady(true)
    return () => setIsPortalReady(false)
  }, [])

  const { previewChanges } = usePropertyPreview()

  // Debounced save function for page properties auto-save
  const debouncedSavePageProperties = useMemo(() => {
    return debounce(async (nodeId: string, nodeData: any) => {
      setIsSaving(true)
      try {
        // Prepare metadata object with SEO fields
        const metadata: Record<string, unknown> = {
          ...(nodeData.metadata || {}),
        }

        // Ensure SEO fields from node data are in metadata
        if (nodeData.metadata?.title !== undefined) {
          metadata.title = nodeData.metadata.title
        }
        if (nodeData.metadata?.description !== undefined) {
          metadata.description = nodeData.metadata.description
        }
        if (nodeData.metadata?.keywords !== undefined) {
          metadata.keywords = nodeData.metadata.keywords
        }
        if (nodeData.metadata?.ogImage !== undefined) {
          metadata.ogImage = nodeData.metadata.ogImage
        }

        // Include metadata-backed fields
        const metadataBackedFields = ['showInNav', 'isPublished'] as const
        for (const field of metadataBackedFields) {
          if ((nodeData as Record<string, unknown>)[field] !== undefined) {
            metadata[field] = (nodeData as Record<string, unknown>)[field]
          }
        }

        // Create UPDATE operation
        const operation = {
          type: 'UPDATE' as const,
          nodeId: nodeId,
          data: {
            title: nodeData.label,
            slug: nodeData.slug,
            metadata,
          },
        }

        saveManager.addOperation(operation)
        await saveManager.saveNow()
      } catch (error) {
        console.error('Failed to auto-save page properties:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to save page properties')
      } finally {
        setIsSaving(false)
      }
    }, 500) // 500ms debounce
  }, [])

  // Determine if we're editing a page node or component instance
  const isComponentId = componentId === selectedComponentId
  const selectedNode = !isComponentId ? nodes.find(n => n.id === componentId) : null
  const selectedComponent = getSelectedComponent()

  // Clear distinction: isEditingPage for page nodes, isEditingComponent for component instances
  const isEditingPage = !isComponentId && !!selectedNode
  const isEditingComponent = isComponentId && !!selectedComponent

  // Detect if the selected page is the home page (should not be deletable)
  const isHomePage = isEditingPage && (
    selectedNode?.data?.slug === '' ||
    selectedNode?.data?.slug === '/' ||
    selectedNode?.data?.slug === 'home' ||
    selectedNode?.data?.label?.toLowerCase() === 'home' ||
    selectedNode?.id === 'home'
  )

  // Get content type for schema lookup (only used for components)
  const contentType = isEditingComponent
    ? selectedComponent?.type || 'component'
    : String(selectedNode?.data?.metadata?.pageType || 'page')

  // Get display label
  const typeLabel = useMemo(() => {
    if (isEditingComponent) {
      return selectedComponent?.type || 'Component'
    }
    return selectedNode?.data?.metadata?.pageType || 'Page'
  }, [isEditingComponent, selectedComponent?.type, selectedNode?.data])

  // Load schema using unified accessor (async) for components, or use default for pages
  const [schema, setSchema] = useState<FieldSchema[]>([])
  const [schemaLoading, setSchemaLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSchemaLoading(true)

    // Pages use hardcoded schema (no .def.ts files exist for pages)
    if (isEditingPage) {
      setSchema(DEFAULT_PAGE_SCHEMA)
      setSchemaLoading(false)
      return
    }

    // Components load schema from definition files
    getSchemaForContent(contentType).then(loadedSchema => {
      if (!cancelled) {
        setSchema(loadedSchema)
        setSchemaLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [contentType, isEditingPage])

  // Get current content values
  const content = useMemo(() => {
    if (isEditingComponent && selectedComponent) {
      // Try to parse JSON from props.text or return content object
      const tryParse = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val) } catch { return null }
        }
        return typeof val === 'object' ? val : null
      }
      return tryParse(selectedComponent.props?.text) || selectedComponent.content || {}
    }
    return selectedNode?.data || {}
  }, [isEditingComponent, selectedComponent, selectedNode?.data])
  
  const handlePropertyChange = useCallback((propertyName: string, value: any) => {
    if (!componentId && !selectedComponentId) return

    // Sanitize string values
    const sanitizedValue = typeof value === 'string' ? DOMPurify.sanitize(value) : value

    captureState()
    setValidationErrors(prev => prev.filter(e => e.field !== propertyName))

    if (isEditingComponent && selectedComponentId) {
      // Update component instance via store
      previewChanges(selectedComponentId, propertyName, sanitizedValue)
      onPropertyChange(propertyName, sanitizedValue)

      const containingNode = nodes.find(node =>
        node.data.components?.some((c: any) => c.id === selectedComponentId)
      )

      if (containingNode) {
        // Update content path in component
        const nextContent = setByPathImmutable(content, propertyName, sanitizedValue)
        updateComponentInNode(containingNode.id, selectedComponentId, {
          content: nextContent,
          props: { ...selectedComponent?.props, text: JSON.stringify(nextContent) }
        })
      }
    } else if (componentId) {
      // Update page node in local state
      previewChanges(componentId, propertyName, sanitizedValue)
      onPropertyChange(propertyName, sanitizedValue)

      const updatedData = setByPathImmutable(selectedNode?.data || {}, propertyName, sanitizedValue)
      updateNode(componentId, { data: updatedData })

      // Trigger debounced auto-save for page properties
      debouncedSavePageProperties(componentId, updatedData)
    }
  }, [componentId, selectedComponentId, captureState, updateNode, updateComponentInNode, previewChanges, onPropertyChange, isEditingComponent, selectedComponent, nodes, content, selectedNode?.data, debouncedSavePageProperties])
  
  // Simple change handler
  const createChangeHandler = useCallback((propertyName: string) => {
    return (value: any) => handlePropertyChange(propertyName, value)
  }, [handlePropertyChange])
  
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Count child pages recursively using edges
  const countChildPages = useCallback((nodeId: string): number => {
    const childEdges = edges.filter(e => e.source === nodeId)
    let count = childEdges.length
    for (const edge of childEdges) {
      count += countChildPages(edge.target)
    }
    return count
  }, [edges])

  // Get all child node IDs recursively
  const getAllChildNodeIds = useCallback((nodeId: string): string[] => {
    const childEdges = edges.filter(e => e.source === nodeId)
    const childIds = childEdges.map(e => e.target)
    const allDescendants: string[] = [...childIds]
    for (const childId of childIds) {
      allDescendants.push(...getAllChildNodeIds(childId))
    }
    return allDescendants
  }, [edges])

  // Handle page deletion
  const handleDeleteClick = useCallback(() => {
    if (!componentId || isEditingComponent) return
    setShowDeleteDialog(true)
  }, [componentId, isEditingComponent])

  const handleConfirmDelete = useCallback(() => {
    if (!componentId || isEditingComponent) return

    setIsDeleting(true)

    // Get all child page IDs to delete along with the parent
    const childIds = getAllChildNodeIds(componentId)
    const allNodeIds = [componentId, ...childIds]

    // Delete all nodes (parent + children)
    deleteNodes(allNodeIds)

    // Close dialog and panel
    setShowDeleteDialog(false)
    setIsDeleting(false)
    onClose()
  }, [componentId, isEditingComponent, getAllChildNodeIds, deleteNodes, onClose])

  // Get child count for current page
  const childPageCount = useMemo(() => {
    if (!componentId || isEditingComponent) return 0
    return countChildPages(componentId)
  }, [componentId, isEditingComponent, countChildPages])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }, [handleClose])
  
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleKeyDown])
  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = e.clientX
  }, [])
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const diff = resizeRef.current - e.clientX
    const newWidth = Math.min(PANEL_DIMENSIONS.MAX_WIDTH, Math.max(PANEL_DIMENSIONS.MIN_WIDTH, panelWidth + diff))
    setPanelWidth(newWidth)
    resizeRef.current = e.clientX
  }, [isResizing, panelWidth])
  
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  const handleOverlayClick = useCallback(() => {
    handleClose()
  }, [handleClose])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])
  
  useEffect(() => {
    if (!isOpen) {
      setValidationErrors([])
      setActiveTab('properties')
    }
  }, [isOpen])

  if (!isPortalReady || typeof document === 'undefined' || !document.body) {
    return null
  }

  const panelContent = createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="property-editor-overlay"
            className="fixed inset-0 bg-transparent z-[1040]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
          <FocusScope.Root trapped asChild>
            <motion.div
              key="property-editor"
              ref={panelRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ width: `${panelWidth}px` }}
              className={cn(
                'fixed right-0 top-0 h-full bg-background border-l border-border shadow-xl z-[1050]',
                'flex flex-col'
              )}
            >
              <div
                className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20"
                onMouseDown={handleResizeStart}
                role="separator"
                aria-label="Resize property panel"
                aria-orientation="vertical"
                aria-valuenow={panelWidth}
                aria-valuemin={PANEL_DIMENSIONS.MIN_WIDTH}
                aria-valuemax={PANEL_DIMENSIONS.MAX_WIDTH}
                tabIndex={0}
              />

              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  <h2 className="text-lg font-semibold">
                    {isEditingComponent ? 'Component Properties' : 'Page Properties'}
                  </h2>
                  {typeLabel && (
                    <span className="text-sm text-gray-500 ml-2">
                      {DOMPurify.sanitize(String(typeLabel))}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Delete button - only show for page nodes, not components or home page */}
                  {isEditingPage && !isHomePage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteClick}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      aria-label="Delete page"
                      title="Delete page"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8"
                    aria-label="Close property panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
                <TabsList className="w-full bg-transparent border-b border-gray-800 rounded-none h-12 p-0 px-4 justify-start">
                  <TabsTrigger value="properties" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">Properties</TabsTrigger>
                  <TabsTrigger value="styles" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">Styles</TabsTrigger>
                  {!isEditingComponent && (
                    <TabsTrigger value="redirects" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">Redirects</TabsTrigger>
                  )}
                  <TabsTrigger value="advanced" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">Advanced</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 min-h-0">
              <TabsContent value="properties" className="p-4 space-y-4">
                {/* Schema-driven field rendering - FieldDispatcher handles all recursion */}
                {schema.map((field) => (
                  <FieldDispatcher
                    key={field.name}
                    schema={field}
                    value={getByPath(content, field.name)}
                    onChange={createChangeHandler(field.name)}
                    websiteId={websiteId}
                  />
                ))}
              </TabsContent>
              
              <TabsContent value="styles" className="p-4 space-y-4">
                {isEditingComponent && selectedComponent ? (
                  // Component styles (responsive)
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Desktop Styles</h3>
                      <FieldDispatcher
                        schema={{ name: 'backgroundColor', type: 'color', label: 'Background Color' }}
                        value={selectedComponent.styles?.desktop?.backgroundColor || ''}
                        onChange={(value) => handlePropertyChange('styles.desktop.backgroundColor', value)}
                        websiteId={websiteId}
                      />
                      <FieldDispatcher
                        schema={{ name: 'textColor', type: 'color', label: 'Text Color' }}
                        value={selectedComponent.styles?.desktop?.textColor || ''}
                        onChange={(value) => handlePropertyChange('styles.desktop.textColor', value)}
                        websiteId={websiteId}
                      />
                      <FieldDispatcher
                        schema={{
                          name: 'padding',
                          type: 'select',
                          label: 'Padding',
                          options: [
                            { label: 'None', value: '0' },
                            { label: 'Small', value: '8px' },
                            { label: 'Medium', value: '16px' },
                            { label: 'Large', value: '24px' },
                            { label: 'Extra Large', value: '32px' }
                          ]
                        }}
                        value={selectedComponent.styles?.desktop?.padding || ''}
                        onChange={(value) => handlePropertyChange('styles.desktop.padding', value)}
                        websiteId={websiteId}
                      />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Mobile Styles</h3>
                      <FieldDispatcher
                        schema={{ name: 'backgroundColor', type: 'color', label: 'Background Color' }}
                        value={selectedComponent.styles?.mobile?.backgroundColor || ''}
                        onChange={(value) => handlePropertyChange('styles.mobile.backgroundColor', value)}
                        websiteId={websiteId}
                      />
                      <FieldDispatcher
                        schema={{ name: 'textColor', type: 'color', label: 'Text Color' }}
                        value={selectedComponent.styles?.mobile?.textColor || ''}
                        onChange={(value) => handlePropertyChange('styles.mobile.textColor', value)}
                        websiteId={websiteId}
                      />
                      <FieldDispatcher
                        schema={{
                          name: 'padding',
                          type: 'select',
                          label: 'Padding',
                          options: [
                            { label: 'None', value: '0' },
                            { label: 'Small', value: '8px' },
                            { label: 'Medium', value: '16px' },
                            { label: 'Large', value: '24px' },
                            { label: 'Extra Large', value: '32px' }
                          ]
                        }}
                        value={selectedComponent.styles?.mobile?.padding || ''}
                        onChange={(value) => handlePropertyChange('styles.mobile.padding', value)}
                        websiteId={websiteId}
                      />
                    </div>
                  </>
                ) : (
                  // Page styles (existing logic)
                  <>
                    <FieldDispatcher
                      schema={{ name: 'backgroundColor', type: 'color', label: 'Background Color' }}
                      value={(content as any)?.backgroundColor}
                      onChange={(value) => handlePropertyChange('backgroundColor', value)}
                      websiteId={websiteId}
                    />
                    <FieldDispatcher
                      schema={{ name: 'textColor', type: 'color', label: 'Text Color' }}
                      value={(content as any)?.textColor}
                      onChange={(value) => handlePropertyChange('textColor', value)}
                      websiteId={websiteId}
                    />
                    <FieldDispatcher
                      schema={{
                        name: 'padding',
                        type: 'select',
                        label: 'Padding',
                        options: [
                          { label: 'None', value: '0' },
                          { label: 'Small', value: '8px' },
                          { label: 'Medium', value: '16px' },
                          { label: 'Large', value: '24px' },
                          { label: 'Extra Large', value: '32px' }
                        ]
                      }}
                      value={(content as any)?.padding}
                      onChange={(value) => handlePropertyChange('padding', value)}
                      websiteId={websiteId}
                    />
                  </>
                )}
              </TabsContent>

              {/* Redirects Tab - Only for page nodes */}
              {!isEditingComponent && (
                <TabsContent value="redirects" className="p-4 space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                      <span>Set up a redirect for this page</span>
                    </div>

                    <FieldDispatcher
                      schema={{
                        name: 'redirectUrl',
                        type: 'string',
                        label: 'Redirect URL',
                        placeholder: 'https://example.com/new-page or /internal-path',
                      }}
                      value={(selectedNode?.data as any)?.redirectUrl || ''}
                      onChange={createChangeHandler('redirectUrl')}
                      websiteId={websiteId}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FieldDispatcher
                        schema={{
                          name: 'redirectType',
                          type: 'select',
                          label: 'Redirect Type',
                          options: [
                            { value: '301', label: '301 (Permanent)' },
                            { value: '302', label: '302 (Temporary)' }
                          ]
                        }}
                        value={String((selectedNode?.data as any)?.redirectType || '301')}
                        onChange={(value) => handlePropertyChange('redirectType', parseInt(value as string, 10))}
                        websiteId={websiteId}
                      />

                      <FieldDispatcher
                        schema={{ name: 'openInNewTab', type: 'boolean', label: 'Open in New Tab' }}
                        value={(selectedNode?.data as any)?.openInNewTab ?? false}
                        onChange={(value) => handlePropertyChange('openInNewTab', value)}
                        websiteId={websiteId}
                      />
                    </div>

                    <FieldDispatcher
                      schema={{ name: 'showInNav', type: 'boolean', label: 'Show in Navigation' }}
                      value={(selectedNode?.data as any)?.showInNav ?? false}
                      onChange={(value) => handlePropertyChange('showInNav', value)}
                      websiteId={websiteId}
                    />

                    {(selectedNode?.data as any)?.showInNav && (
                      <FieldDispatcher
                        schema={{
                          name: 'navLabel',
                          type: 'string',
                          label: 'Navigation Label',
                          placeholder: 'Label shown in navigation',
                        }}
                        value={(selectedNode?.data as any)?.navLabel || selectedNode?.data?.label || ''}
                        onChange={createChangeHandler('navLabel')}
                        websiteId={websiteId}
                      />
                    )}

                    <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-md">
                      <strong>Note:</strong> When a redirect URL is set, visitors to this page will be automatically redirected. The page content will not be shown.
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="advanced" className="p-4 space-y-4">
                <FieldDispatcher
                  schema={{
                    name: 'className',
                    type: 'string',
                    label: 'CSS Classes',
                    placeholder: 'e.g., custom-class another-class',
                  }}
                  value={getByPath(content, 'className')}
                  onChange={createChangeHandler('className')}
                  websiteId={websiteId}
                />
                <FieldDispatcher
                  schema={{
                    name: 'id',
                    type: 'string',
                    label: 'Element ID',
                    placeholder: 'e.g., my-component',
                  }}
                  value={getByPath(content, 'id')}
                  onChange={createChangeHandler('id')}
                  websiteId={websiteId}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Status footer - shows saving and validation errors */}
          {(isSaving || validationErrors.length > 0) && (
            <div className="p-4 border-t space-y-2">
              {isSaving && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              )}
              {validationErrors.length > 0 && (
                <div className={`text-sm ${COLOR_STYLES.ERROR_TEXT}`}>
                  {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
            </motion.div>
          </FocusScope.Root>
        </>
      )}
    </AnimatePresence>,
    document.body
  )

  // Page delete confirmation dialog - rendered separately from portal
  const deleteDialog = (
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete Page
          </AlertDialogTitle>
          <AlertDialogDescription>
            {childPageCount > 0 ? (
              <>
                <span className="text-amber-500 font-medium">Warning: </span>
                This page has {childPageCount} child page{childPageCount !== 1 ? 's' : ''}.
                Deleting this page will also delete all child pages. This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete this page? This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Deleting...
              </>
            ) : childPageCount > 0 ? (
              `Delete ${childPageCount + 1} Pages`
            ) : (
              'Delete Page'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <>
      {panelContent}
      {deleteDialog}
    </>
  )
}
