'use client'

import { createPortal } from 'react-dom'
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { X, Plus, Trash2, ChevronDown, ChevronRight, MoveDown, MoveUp, Globe } from 'lucide-react'
import { useResolvedComponentProps } from '@/lib/studio/hooks/use-resolved-component-props'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { motion, AnimatePresence } from 'framer-motion'
import type { PropertySchema } from './property-editor/types'
import { ReferencePicker } from './property-editor/ReferencePicker'
import { getSchemaForContent } from '@/lib/studio/components/cms/_factory/schema-accessor'

import { MakeGlobalDialog } from './global-components/MakeGlobalDialog'
interface ComponentPropertiesPanelProps {
  isOpen: boolean
  component: ComponentInstance | null
  nodeId: string | null
  websiteId?: string
  onClose: () => void
  onPropertyChange: (componentId: string, propertyPath: string, value: any) => void
  onDelete?: (componentId: string, nodeId: string) => void
}

/**
 * Maximum depth for recursive nested field rendering.
 * Prevents infinite recursion and keeps UI manageable.
 */
const MAX_NESTING_DEPTH = 5

/**
 * Visual hierarchy colors for nested components.
 * Each depth level gets progressively lighter/more subtle background.
 */
const DEPTH_STYLES = [
  '', // depth 0 - no extra styling (root level)
  'bg-gray-800/30 border-l-2 border-blue-500/40 pl-3 ml-1 rounded-r',
  'bg-gray-800/20 border-l-2 border-purple-500/40 pl-3 ml-1 rounded-r',
  'bg-gray-800/10 border-l-2 border-green-500/40 pl-3 ml-1 rounded-r',
  'bg-gray-800/5 border-l-2 border-orange-500/40 pl-3 ml-1 rounded-r',
] as const

/**
 * Get visual styling for a given nesting depth.
 */
const getDepthStyle = (depth: number): string => {
  if (depth <= 0) return ''
  return DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)] || DEPTH_STYLES[DEPTH_STYLES.length - 1]
}

export const ComponentPropertiesPanel: React.FC<ComponentPropertiesPanelProps> = ({
  isOpen,
  component,
  nodeId,
  websiteId,
  onClose,
  onPropertyChange,
  onDelete
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isPortalReady, setIsPortalReady] = useState(false)
  const [properties, setProperties] = useState<Record<string, any>>({})
  const [propertyDefinitions, setPropertyDefinitions] = useState<any[]>([])
  const [uiSchema, setUiSchema] = useState<PropertySchema[]>([])
  const [objectArrayExpanded, setObjectArrayExpanded] = useState<Record<string, boolean>>({})
  const [makeGlobalOpen, setMakeGlobalOpen] = useState(false)

  // Stable ref for latest properties to avoid re-render cascade
  const propertiesRef = useRef(properties)
  propertiesRef.current = properties

  useEffect(() => {
    setIsPortalReady(true)
    return () => setIsPortalReady(false)
  }, [])

  // Helpers for nested paths
  const getByPath = useCallback((obj: any, path: string): any => {
    if (!obj || !path) return undefined
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), obj)
  }, [])

  /**
   * Normalize a value that should be a string but might be:
   * 1. An object with a nested `src` property (corrupted import data)
   * 2. The string "[object Object]" (already rendered as string)
   * 3. An object that should be extracted to a primitive
   */
  const normalizeStringValue = useCallback((value: any, fieldName?: string): string => {
    // Already a string
    if (typeof value === 'string') {
      // Handle corrupted "[object Object]" strings
      if (value === '[object Object]') {
        return ''
      }
      return value
    }

    // Null/undefined
    if (value == null) {
      return ''
    }

    // Handle objects that should be strings
    if (typeof value === 'object') {
      // Case 1: Nested src object { src: { src: "url", mediaId: "..." } }
      // This happens when image.src is an object instead of a string
      if (value.src && typeof value.src === 'string') {
        return value.src
      }

      // Case 2: Object with url field
      if (value.url && typeof value.url === 'string') {
        return value.url
      }

      // Case 3: Object with originalUrl field
      if (value.originalUrl && typeof value.originalUrl === 'string') {
        return value.originalUrl
      }

      // Log warning for debugging
      if (process.env.NODE_ENV !== 'production') {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`[ComponentPropertiesPanel] Unexpected object value for field "${fieldName}":`, value)
        }
      }

      // Return empty string for unknown objects
      return ''
    }

    // Fallback: convert to string
    return String(value)
  }, [])

  const setByPathImmutable = useCallback((base: any, path: string, value: any): any => {
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
  }, [])

  // Parse component properties from JSON string or object
  useEffect(() => {
    if (!component) {
      setProperties({})
      setPropertyDefinitions([])
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      if (process.env.NODE_ENV === 'development') {
      console.log('[ComponentPropertiesPanel] Received component:', component)
      }
      if (process.env.NODE_ENV === 'development') {
      console.log('[ComponentPropertiesPanel] Component props:', component.props)
      }
    }

    // Parse the props/content JSON to get actual properties
    try {
      let parsedProps = {}
      const tryParse = (val: any): any => {
        if (val == null) return undefined
        if (typeof val === 'string') {
          try { return JSON.parse(val) } catch { return undefined }
        }
        if (typeof val === 'object') return val
        return undefined
      }

      // Check if this is a shared component - data is in _resolvedSharedContent
      const isShared = !!component.props?.sharedComponentId
      const resolvedSharedContent = component.props?._resolvedSharedContent as Record<string, unknown> | undefined
      const instanceOverrides = (component.props?.overrides || {}) as Record<string, unknown>

      if (isShared && resolvedSharedContent) {
        // For shared components: merge resolved content with any instance overrides
        // Use simple shallow merge for display - deep merge happens on save
        parsedProps = { ...resolvedSharedContent, ...instanceOverrides }
        if (process.env.NODE_ENV === 'development') {
          console.log('[ComponentPropertiesPanel] Shared component detected, using resolved content:', {
            sharedComponentId: component.props?.sharedComponentId,
            resolvedKeys: Object.keys(resolvedSharedContent),
            overrideKeys: Object.keys(instanceOverrides),
          })
        }
      } else {
        // Canonical content lives on component.content. props.content/text are legacy mirrors.
        parsedProps =
          tryParse(component.content) ??
          tryParse(component.props?.content) ??
          tryParse(component.props?.text) ??
          {}
      }

      if (!parsedProps || (typeof parsedProps === 'object' && Object.keys(parsedProps).length === 0)) {
        if (process.env.NODE_ENV !== 'production') {
          if (process.env.NODE_ENV === 'development') {
          console.log('[ComponentPropertiesPanel] No structured props found; showing empty object')
          }
        }
      }
      setProperties(parsedProps)

      // Get schema/definitions from metadata (prefer props.metadata, then component.metadata)
      const metaFromProps = component.props?.metadata || {}
      const metaFromComponent = (component as any).metadata || {}
      const metadata = Object.keys(metaFromProps).length ? metaFromProps : metaFromComponent
      const definitions = metadata.properties || []
      const schemaFields = metadata.schema || []
      if (process.env.NODE_ENV !== 'production') {
        if (process.env.NODE_ENV === 'development') {
        console.log('[ComponentPropertiesPanel] Property definitions:', definitions)
        }
        if (process.env.NODE_ENV === 'development') {
        console.log('[ComponentPropertiesPanel] Schema fields:', schemaFields)
        }
      }
      setPropertyDefinitions(definitions)
      if (Array.isArray(schemaFields) && schemaFields.length > 0) {
        // Use embedded schema - convert to PropertySchema format
        setUiSchema(schemaFields as PropertySchema[])
      } else {
        // No embedded schema - fetch from CMS factory by component type
        if (component.type) {
          getSchemaForContent(component.type)
            .then((fields) => {
              if (fields && fields.length > 0) {
                if (process.env.NODE_ENV !== 'production') {
                  if (process.env.NODE_ENV === 'development') {
                  console.log('[ComponentPropertiesPanel] Fetched schema from factory:', fields)
                  }
                }
                // Convert FieldSchema[] to PropertySchema[] format for uiSchema renderer
                // The uiSchema renderer has proper nested field handling
                const converted: PropertySchema[] = fields.map(field => ({
                  name: field.name,
                  type: (field.type || 'text') as PropertySchema['type'],
                  label: field.label || field.name,
                  required: field.required,
                  options: field.options?.map(o => ({ label: o.label, value: String(o.value) })),
                  fields: field.fields as PropertySchema[] | undefined,
                  items: field.items ? {
                    kind: 'object' as const,
                    fields: (field.items as any)?.fields as PropertySchema[] | undefined,
                  } : undefined,
                  allowedTypes: field.allowedTypes,
                }))
                // Store in uiSchema to use the nested-aware renderer
                setUiSchema(converted)
              } else {
                setUiSchema([])
              }
            })
            .catch((e) => {
              if (process.env.NODE_ENV === 'development') {
              console.error('[ComponentPropertiesPanel] Failed to fetch schema from factory:', e)
              }
              setUiSchema([])
            })
        } else {
          setUiSchema([])
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('[ComponentPropertiesPanel] Failed to parse component properties:', error)
      }
      if (process.env.NODE_ENV === 'development') {
      console.error('[ComponentPropertiesPanel] Component causing error:', component)
      }
      setProperties({})
      setPropertyDefinitions([])
    }
  }, [component])

  // Handle clicks outside the panel
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Add slight delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Stable callback using ref to avoid re-render cascade when properties change
  const handlePropertyUpdate = useCallback((propertyName: string, value: any) => {
    if (!component) return
    const currentProperties = propertiesRef.current
    const newProperties = propertyName.includes('.')
      ? setByPathImmutable(currentProperties, propertyName.replace(/^content\./, ''), value)
      : { ...currentProperties, [propertyName.replace(/^content\./, '')]: value }
    setProperties(newProperties)
    // TKT-041 FIX: Don't spread component.props - it may contain recursively nested data
    // from prior save cycles. Only include metadata (for schema) and shared component fields.
    const jsonContent = JSON.stringify(newProperties)
    const updatedProps: Record<string, unknown> = {
      text: jsonContent,
      content: jsonContent,
    }
    // Preserve metadata for schema definitions
    if (component.props?.metadata) {
      updatedProps.metadata = component.props.metadata
    }
    // Preserve shared component fields if this is a shared component
    if (component.props?.sharedComponentId) {
      updatedProps.sharedComponentId = component.props.sharedComponentId
      if (component.props._resolvedSharedContent) {
        updatedProps._resolvedSharedContent = component.props._resolvedSharedContent
      }
      if (component.props.overrides) {
        updatedProps.overrides = component.props.overrides
      }
    }
    onPropertyChange(component.id, 'content', newProperties)
    onPropertyChange(component.id, 'props', updatedProps)
  }, [component, onPropertyChange, setByPathImmutable])

  /**
   * Recursive field renderer for nested property schemas.
   * Handles object and array types with nested fields up to MAX_NESTING_DEPTH levels.
   */
  const renderSchemaField = useCallback((
    schema: PropertySchema,
    basePath: string,
    depth: number = 0
  ): React.ReactNode => {
    // Stop recursion at max depth
    if (depth >= MAX_NESTING_DEPTH) {
      return (
        <div key={basePath} className="text-xs text-muted-foreground italic">
          Maximum nesting depth reached
        </div>
      )
    }

    const value = getByPath(properties, basePath)
    const fieldKey = `${basePath}-${depth}`

    // Handle primitive types
    const renderPrimitiveField = (): React.ReactNode => {
      if (schema.type === 'select' && schema.options) {
        return (
          <div key={fieldKey}>
            <Label className="text-sm font-medium">{schema.label}</Label>
            <Select
              value={value ?? ''}
              onValueChange={(val) => handlePropertyUpdate(basePath, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={schema.label} />
              </SelectTrigger>
              <SelectContent>
                {schema.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }

      if (schema.type === 'checkbox' || (schema.type as string) === 'boolean') {
        return (
          <div key={fieldKey} className="flex items-center gap-2">
            <Switch
              checked={!!value}
              onCheckedChange={(val) => handlePropertyUpdate(basePath, !!val)}
            />
            <Label className="text-sm">{schema.label}</Label>
          </div>
        )
      }

      if (schema.type === 'number') {
        return (
          <div key={fieldKey}>
            <Label className="text-sm font-medium">{schema.label}</Label>
            <Input
              type="number"
              value={value ?? ''}
              onChange={(e) => {
                const numeric = e.target.valueAsNumber
                handlePropertyUpdate(basePath, Number.isNaN(numeric) ? undefined : numeric)
              }}
            />
          </div>
        )
      }

      if (schema.type === 'textarea' || schema.type === 'richText') {
        return (
          <div key={fieldKey}>
            <Label className="text-sm font-medium">{schema.label}</Label>
            <Textarea
              value={normalizeStringValue(value, schema.label)}
              onChange={(e) => handlePropertyUpdate(basePath, e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        )
      }

      if (schema.type === 'reference') {
        return (
          <div key={fieldKey} className="space-y-2">
            <div className="text-xs uppercase text-muted-foreground">{schema.label}</div>
            <ReferencePicker value={value} onChange={(v) => handlePropertyUpdate(basePath, v)} />
          </div>
        )
      }

      // Default: text input
      return (
        <div key={fieldKey}>
          <Label className="text-sm font-medium">{schema.label}</Label>
          <Input
            value={normalizeStringValue(value, schema.label)}
            onChange={(e) => handlePropertyUpdate(basePath, e.target.value)}
          />
        </div>
      )
    }

    // Handle object type with nested fields
    if (schema.type === 'object' && Array.isArray(schema.fields) && schema.fields.length > 0) {
      return (
        <div key={fieldKey} className="space-y-2">
          <div className="text-xs uppercase text-muted-foreground font-medium">
            {schema.label || basePath}
            {depth > 0 && <span className="ml-2 text-[10px] opacity-50">(nested)</span>}
          </div>
          <div className={cn('space-y-3 py-2', getDepthStyle(depth))}>
            {schema.fields.map((childSchema) => {
              const childName = childSchema.name.replace(/^content\./, '')
              const childPath = `${basePath}.${childName}`
              return renderSchemaField(childSchema, childPath, depth + 1)
            })}
          </div>
        </div>
      )
    }

    // Handle array of objects
    // Support both FieldSchema format (items.type) and PropertySchema format (items.kind)
    const itemsIsObject = schema.items && (
      (schema.items as any).kind === 'object' ||
      (schema.items as any).type === 'object'
    )
    const itemFields = (schema.items as any)?.fields
    if (schema.type === 'array' && itemsIsObject && Array.isArray(itemFields)) {
      const list: any[] = Array.isArray(value) ? value : []
      const label = schema.label || basePath

      const generateObjectId = () =>
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? (crypto as any).randomUUID()
          : `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const handleAddItem = () => {
        const newItem = { id: generateObjectId() }
        handlePropertyUpdate(basePath, [...list, newItem])
        setObjectArrayExpanded((prev) => ({ ...prev, [newItem.id]: true }))
      }

      const handleRemoveItem = (idx: number) => {
        const next = list.slice()
        const [removed] = next.splice(idx, 1)
        handlePropertyUpdate(basePath, next)
        const key = String((removed && removed.id) ?? `${basePath}-${idx}`)
        setObjectArrayExpanded((prev) => {
          if (!(key in prev)) return prev
          const { [key]: _omit, ...rest } = prev
          return rest
        })
      }

      const handleMoveItem = (idx: number, direction: -1 | 1) => {
        const target = idx + direction
        if (target < 0 || target >= list.length) return
        const next = list.slice()
        const [moved] = next.splice(idx, 1)
        next.splice(target, 0, moved)
        handlePropertyUpdate(basePath, next)
      }

      return (
        <div key={fieldKey} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground">{label}</div>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleAddItem}
              aria-label={`Add ${label}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {list.length === 0 && (
              <div className="rounded-md border border-dashed border-gray-700 bg-gray-800/50 p-3 text-xs text-muted-foreground">
                No items yet. Use the + button to add one.
              </div>
            )}
            {list.map((item, idx) => {
              const itemKey = String((item && item.id) ?? `${basePath}-${idx}`)
              const isOpen = objectArrayExpanded[itemKey] ?? idx === 0
              const itemLabel =
                (item && (item.title || item.heading || item.label || item.name)) ||
                `${label} ${idx + 1}`
              const itemPath = `${basePath}.${idx}`

              return (
                <div key={itemKey} className="rounded-md border border-gray-700 bg-gray-900/60">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setObjectArrayExpanded((prev) => ({ ...prev, [itemKey]: !isOpen }))}
                        aria-label={isOpen ? 'Collapse item' : 'Expand item'}
                        className="size-11 text-gray-400 hover:text-white"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <div className="truncate text-sm font-medium text-white">{itemLabel}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveItem(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                        className="size-11 text-gray-400 hover:text-white disabled:text-gray-600"
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleMoveItem(idx, 1)}
                        disabled={idx === list.length - 1}
                        aria-label="Move down"
                        className="size-11 text-gray-400 hover:text-white disabled:text-gray-600"
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveItem(idx)}
                        aria-label="Remove item"
                        className="size-11 text-red-400 hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className={cn('space-y-3 border-t border-gray-800 p-3', getDepthStyle(depth))}>
                      {(itemFields || []).map((childSchema: PropertySchema) => {
                        const childName = childSchema.name.replace(/^content\./, '')
                        const childPath = `${itemPath}.${childName}`
                        return renderSchemaField(childSchema, childPath, depth + 1)
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Handle array of primitives
    // Support both FieldSchema format (items.type is a primitive type) and PropertySchema format (items.kind === 'primitive')
    const itemsIsPrimitive = schema.items && (
      (schema.items as any).kind === 'primitive' ||
      // Check for primitive types from FieldSchema
      ['string', 'text', 'number', 'integer', 'boolean', 'select', 'email', 'externalUrl', 'date'].includes((schema.items as any).type)
    )
    if (schema.type === 'array' && itemsIsPrimitive && !itemsIsObject) {
      const list: any[] = Array.isArray(value) ? value : []
      return (
        <div key={fieldKey} className="space-y-2">
          <div className="text-xs uppercase text-muted-foreground">{schema.label}</div>
          <div className="space-y-2">
            {list.map((v, i) => (
              <Input
                key={`${basePath}.${i}`}
                value={v || ''}
                onChange={(e) => {
                  const next = list.slice()
                  next[i] = e.target.value
                  handlePropertyUpdate(basePath, next)
                }}
              />
            ))}
          </div>
        </div>
      )
    }

    // Handle component arrays (not yet supported)
    // Support both FieldSchema format (items.type === 'componentArray') and PropertySchema format (items.kind === 'component')
    const itemsIsComponent = schema.items && (
      (schema.items as any).kind === 'component' ||
      (schema.items as any).type === 'componentArray'
    )
    if (schema.type === 'array' && itemsIsComponent) {
      return (
        <div key={fieldKey} className="space-y-2">
          <div className="text-xs uppercase text-muted-foreground">{schema.label}</div>
          <div className="text-sm text-gray-500">Component arrays not yet supported in legacy UI</div>
        </div>
      )
    }

    // Fallback to primitive field rendering
    return renderPrimitiveField()
  }, [properties, handlePropertyUpdate, getByPath, normalizeStringValue, objectArrayExpanded])

  const renderPropertyField = (definition: any) => {
    const { name, type, label, description, required } = definition; const normalizedName = name && name.startsWith('content.') ? name.slice(8) : name
    const value = (normalizedName && properties[normalizedName] !== undefined ? properties[normalizedName] : properties[name]) ?? ''

    // Check if this is a richtext field (HTML content)
    const isRichTextType = type === 'richtext' || type === 'richText' || 
                          (name === 'body' && ['hero-banner', 'text-block', 'card', 'two-column'].includes(component?.type || ''))
    
    // Check if this is an array type
    const isArrayType = !isRichTextType && type && typeof type === 'string' && 
                        (type.includes('[]') || type.startsWith('Array<'))
    
    // Check if this is a complex object type (contains curly braces)
    const isComplexObjectType = !isRichTextType && !isArrayType && type && typeof type === 'string' && 
                                (type.includes('{') || type.startsWith('({'))
    
    // Extract enum options from type if it contains pipe-separated values
    // BUT not if it's a complex object type, array type, or richtext
    const isEnumType = !isRichTextType && !isComplexObjectType && !isArrayType && type && typeof type === 'string' && 
                      (type.includes('|') || type.startsWith("'") || type.includes('"'))
    
    let enumOptions: string[] = []
    if (isEnumType) {
      // Parse enum values from type string like ('left'|'center'|'right')
      const matches = type.match(/['"]([^'"]+)['"]/g)
      if (matches) {
        enumOptions = matches.map((m: string) => m.replace(/['"]/g, ''))
      }
    }

    // Handle enum/select types
    if (enumOptions.length > 0) {
      return (
        <div key={name} className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name}
            </Label>
            <span className="text-xs text-gray-500">({type})</span>
            {required && <span className="text-red-400">*</span>}
          </div>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          <Select
            value={value || ''}
            onValueChange={(newValue) => handlePropertyUpdate(normalizedName, newValue)}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder={`Select ${label || name}`} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {enumOptions.map((option) => (
                <SelectItem 
                  key={option} 
                  value={option}
                  className="text-white hover:bg-gray-700"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }

    // Handle different property types
    // Handle richtext/HTML fields
    if (isRichTextType) {
      return (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="text-sm font-medium text-gray-300">
            {label || name}
            {required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          <div className="border border-gray-700 rounded-md bg-gray-800/50 overflow-hidden">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-700 bg-gray-900/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('bold', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Bold"
              >
                <strong>B</strong>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('italic', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Italic"
              >
                <em>I</em>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('underline', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Underline"
              >
                <u>U</u>
              </Button>
              <div className="h-4 w-px bg-gray-700 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = prompt('Enter URL:')
                  if (url) {
                    document.execCommand('createLink', false, url)
                    const editorEl = document.getElementById(`editor-${name}`)
                    if (editorEl) {
                      handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                    }
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Add Link"
              >
                🔗
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('unlink', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Remove Link"
              >
                🔗̸
              </Button>
              <div className="h-4 w-px bg-gray-700 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('formatBlock', false, 'h2')
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Heading 2"
              >
                H2
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('formatBlock', false, 'h3')
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Heading 3"
              >
                H3
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('formatBlock', false, 'p')
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Paragraph"
              >
                P
              </Button>
              <div className="h-4 w-px bg-gray-700 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('insertUnorderedList', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Bullet List"
              >
                •
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  document.execCommand('insertOrderedList', false)
                  const editorEl = document.getElementById(`editor-${name}`)
                  if (editorEl) {
                    handlePropertyUpdate(normalizedName, editorEl.innerHTML)
                  }
                }}
                className="h-7 px-2 text-gray-400 hover:text-white hover:bg-gray-700"
                title="Numbered List"
              >
                1.
              </Button>
            </div>
            
            {/* WYSIWYG Editor */}
            <div
              id={`editor-${name}`}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const target = e.target as HTMLDivElement
                handlePropertyUpdate(normalizedName, target.innerHTML)
              }}
              onFocus={(e) => {
                // Ensure toolbar commands work on this editor
                const target = e.target as HTMLDivElement
                if (!target.innerHTML || target.innerHTML === '<br>') {
                  target.innerHTML = ''
                }
              }}
              className="min-h-[150px] p-3 bg-gray-900 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 prose prose-sm prose-invert max-w-none [&>*]:text-gray-200 [&_a]:text-blue-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: value || '' }}
              style={{
                // Ensure good readability
                lineHeight: '1.6',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      )
    }

    switch (type) {
      case 'string':
      case 'text':
        return (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name}
              {required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            <Input
              id={name}
              value={value}
              onChange={(e) => handlePropertyUpdate(normalizedName, e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder={`Enter ${label || name}`}
            />
          </div>
        )

      case 'textarea':
      case 'longtext':
        return (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name}
              {required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            <Textarea
              id={name}
              value={value}
              onChange={(e) => handlePropertyUpdate(normalizedName, e.target.value)}
              className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
              placeholder={`Enter ${label || name}`}
            />
          </div>
        )

      case 'boolean':
        return (
          <div key={name} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={name} className="text-sm font-medium text-gray-300">
                {label || name}
                {required && <span className="text-red-400 ml-1">*</span>}
              </Label>
              <Switch
                id={name}
                checked={value === true}
                onCheckedChange={(checked) => handlePropertyUpdate(normalizedName, checked)}
              />
            </div>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        )

      case 'number':
        return (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name}
              {required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            <Input
              id={name}
              type="number"
              value={value}
              onChange={(e) => handlePropertyUpdate(normalizedName, parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder={`Enter ${label || name}`}
            />
          </div>
        )

      case 'select':
        // Parse options from type string like "'left'|'center'|'right'"
        const options: string[] = type.match(/'([^']+)'/g)?.map((opt: string) => opt.replace(/'/g, '')) || []
        return (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name}
              {required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            <Select value={value} onValueChange={(val) => handlePropertyUpdate(normalizedName, val)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder={`Select ${label || name}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      default:
        // Handle array types  
        if (isArrayType) {
          // Ensure value is an array
          let arrayValue = value || []
          if (typeof arrayValue === 'string') {
            try {
              arrayValue = JSON.parse(arrayValue)
            } catch {
              arrayValue = []
            }
          }
          if (!Array.isArray(arrayValue)) {
            arrayValue = []
          }

          if (process.env.NODE_ENV !== 'production') {
            if (process.env.NODE_ENV === 'development') {
            console.log(`[Array Handler] Property: ${name}, Value:`, arrayValue)
            }
            if (process.env.NODE_ENV === 'development') {
            console.log(`[Array Handler] Type: ${type}`)
            }
          }

          // Determine the item type (e.g., {label:string;url:string} from {label:string;url:string}[])
          const itemType = type.replace('[]', '').replace(/^Array<(.*)>$/, '$1').trim()
          const isComplexItem = itemType.includes('{') || 
                                (arrayValue.length > 0 && typeof arrayValue[0] === 'object')
          
          if (process.env.NODE_ENV !== 'production') {
            if (process.env.NODE_ENV === 'development') {
            console.log(`[Array Handler] Item type: ${itemType}, Is complex: ${isComplexItem}`)
            }
          }

          return (
            <div key={name} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-300">
                  {label || name}
                  {required && <span className="text-red-400 ml-1">*</span>}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    let newItem: any = ''
                    if (isComplexItem) {
                      // Create proper object structure for known types
                      if (name === 'ctaButtons' || name === 'buttons') {
                        newItem = { label: '', url: '', style: 'primary' }
                      } else if (name === 'links' || name === 'navigation') {
                        newItem = { label: '', url: '' }
                      } else if (name === 'attribute' || name === 'attributes') {
                        newItem = { author: '', title: '' }
                      } else {
                        newItem = {}
                      }
                    }
                    const updatedArray = [...arrayValue, newItem]
                    handlePropertyUpdate(normalizedName, updatedArray)
                  }}
                  className="h-7 px-2 bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
              {description && (
                <p className="text-xs text-gray-500">{description}</p>
              )}
              
              <div className="space-y-2">
                {arrayValue.map((item: any, index: number) => (
                  <div key={index} className="border border-gray-700 rounded-md p-3 bg-gray-800/50">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-gray-400">Item {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const updatedArray = arrayValue.filter((_: any, i: number) => i !== index)
                          handlePropertyUpdate(normalizedName, updatedArray)
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {(() => {
                      if (process.env.NODE_ENV !== 'production') {
                        if (process.env.NODE_ENV === 'development') {
                        console.log(`[Array Item ${index}] Item:`, item, `Type:`, typeof item, `IsComplexItem:`, isComplexItem)
                        }
                      }
                      
                      // Fix: If item is a string "[object Object]", try to detect and handle it
                      let actualItem = item
                      if (typeof item === 'string' && item === '[object Object]') {
                        if (process.env.NODE_ENV !== 'production') {
                          if (process.env.NODE_ENV === 'development') {
                          console.warn(`[Array Item ${index}] Detected stringified object, creating empty object`)
                          }
                        }
                        actualItem = {}
                      }
                      
                      return isComplexItem ? (
                        // For complex objects in arrays, show individual fields
                        <div className="space-y-2">
                          {/* Check if item is actually an object first */}
                          {typeof actualItem === 'object' && actualItem !== null ? (
                          <>
                            {/* Common fields for button/link objects */}
                            {(itemType.includes('label') || actualItem.hasOwnProperty('label') || name === 'ctaButtons') && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Label</Label>
                                <Input
                                  value={actualItem.label || ''}
                                  onChange={(e) => {
                                    const updatedArray = [...arrayValue]
                                    updatedArray[index] = { ...actualItem, label: e.target.value }
                                    handlePropertyUpdate(normalizedName, updatedArray)
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                  placeholder="Enter label"
                                />
                              </div>
                            )}
                            {(itemType.includes('url') || actualItem.hasOwnProperty('url') || name === 'ctaButtons') && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">URL</Label>
                                <Input
                                  value={actualItem.url || ''}
                                  onChange={(e) => {
                                    const updatedArray = [...arrayValue]
                                    updatedArray[index] = { ...actualItem, url: e.target.value }
                                    handlePropertyUpdate(normalizedName, updatedArray)
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                  placeholder="Enter URL"
                                />
                              </div>
                            )}
                            {(itemType.includes('style') || actualItem.hasOwnProperty('style') || name === 'ctaButtons') && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Style</Label>
                                <Select
                                  value={actualItem.style || 'primary'}
                                  onValueChange={(newStyle) => {
                                    const updatedArray = [...arrayValue]
                                    updatedArray[index] = { ...actualItem, style: newStyle }
                                    handlePropertyUpdate(normalizedName, updatedArray)
                                  }}
                                >
                                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-sm">
                                    <SelectValue placeholder="Select style" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700">
                                    <SelectItem value="primary" className="text-white hover:bg-gray-700 text-sm">
                                      Primary
                                    </SelectItem>
                                    <SelectItem value="secondary" className="text-white hover:bg-gray-700 text-sm">
                                      Secondary
                                    </SelectItem>
                                    <SelectItem value="outline" className="text-white hover:bg-gray-700 text-sm">
                                      Outline
                                    </SelectItem>
                                    <SelectItem value="ghost" className="text-white hover:bg-gray-700 text-sm">
                                      Ghost
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {(itemType.includes('title') || actualItem.hasOwnProperty('title')) && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Title</Label>
                                <Input
                                  value={actualItem.title || ''}
                                  onChange={(e) => {
                                    const updatedArray = [...arrayValue]
                                    updatedArray[index] = { ...actualItem, title: e.target.value }
                                    handlePropertyUpdate(normalizedName, updatedArray)
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                  placeholder="Enter title"
                                />
                              </div>
                            )}
                            {(itemType.includes('description') || actualItem.hasOwnProperty('description')) && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Description</Label>
                                <Textarea
                                  value={actualItem.description || ''}
                                  onChange={(e) => {
                                    const updatedArray = [...arrayValue]
                                    updatedArray[index] = { ...actualItem, description: e.target.value }
                                    handlePropertyUpdate(normalizedName, updatedArray)
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white min-h-[50px] text-sm"
                                  placeholder="Enter description"
                                />
                              </div>
                            )}
                            {/* Show any other properties not handled above */}
                            {Object.keys(actualItem)
                              .filter(key => !['label', 'url', 'style', 'title', 'description'].includes(key))
                              .map(key => {
                                let val = (actualItem as any)[key] as any
                                // If stored as a JSON string array, try to parse for better UX
                                if (typeof val === 'string') {
                                  const trimmed = val.trim()
                                  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                                    try { val = JSON.parse(trimmed) } catch { /* leave as string */ }
                                  }
                                }
                                const isObj = typeof val === 'object' && val !== null
                                const isArray = Array.isArray(val)

                                // Special handling for nested button/link arrays like ctaButtons/actions/links
                                if (isArray && (/ctaButtons?|buttons?|actions?|links?/i.test(key) || (val as any[]).some(it => it && typeof it === 'object' && ('label' in it || 'url' in it || 'href' in it)))) {
                                  const btns = Array.isArray(val) ? (val as any[]) : []
                                  return (
                                    <div key={key} className="space-y-1">
                                      <Label className="text-xs text-gray-400">{key}</Label>
                                      <div className="space-y-2">
                                        {btns.map((btn, bIdx) => {
                                          const b = (btn && typeof btn === 'object') ? btn : {}
                                          const labelVal = b.label ?? b.text ?? ''
                                          const urlKey = ('href' in b && !('url' in b)) ? 'href' : 'url'
                                          const urlVal = b[urlKey] ?? ''
                                          const variantKey = ('style' in b && !('variant' in b)) ? 'style' : 'variant'
                                          const variantVal = b[variantKey] ?? 'primary'
                                          return (
                                            <div key={bIdx} className="border border-gray-700 rounded p-2 space-y-2 bg-gray-900/40">
                                              <div className="flex gap-2">
                                                <Input
                                                  value={labelVal}
                                                  placeholder="Label"
                                                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                                  onChange={(e) => {
                                                    const next = btns.slice()
                                                    next[bIdx] = { ...b, label: e.target.value }
                                                    const updatedArray = [...arrayValue]
                                                    updatedArray[index] = { ...actualItem, [key]: next }
                                                    handlePropertyUpdate(normalizedName, updatedArray)
                                                  }}
                                                />
                                                <Input
                                                  value={urlVal}
                                                  placeholder="URL"
                                                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                                  onChange={(e) => {
                                                    const next = btns.slice()
                                                    next[bIdx] = { ...b, [urlKey]: e.target.value }
                                                    const updatedArray = [...arrayValue]
                                                    updatedArray[index] = { ...actualItem, [key]: next }
                                                    handlePropertyUpdate(normalizedName, updatedArray)
                                                  }}
                                                />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Select
                                                  value={variantVal}
                                                  onValueChange={(v) => {
                                                    const next = btns.slice()
                                                    next[bIdx] = { ...b, [variantKey]: v }
                                                    const updatedArray = [...arrayValue]
                                                    updatedArray[index] = { ...actualItem, [key]: next }
                                                    handlePropertyUpdate(normalizedName, updatedArray)
                                                  }}
                                                >
                                                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-sm">
                                                    <SelectValue placeholder="Variant" />
                                                  </SelectTrigger>
                                                  <SelectContent className="bg-gray-800 border-gray-700">
                                                    <SelectItem value="primary" className="text-white hover:bg-gray-700 text-sm">Primary</SelectItem>
                                                    <SelectItem value="secondary" className="text-white hover:bg-gray-700 text-sm">Secondary</SelectItem>
                                                    <SelectItem value="outline" className="text-white hover:bg-gray-700 text-sm">Outline</SelectItem>
                                                    <SelectItem value="ghost" className="text-white hover:bg-gray-700 text-sm">Ghost</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2 text-gray-400 hover:text-white"
                                                  onClick={() => {
                                                    const next = btns.filter((_, i) => i !== bIdx)
                                                    const updatedArray = [...arrayValue]
                                                    updatedArray[index] = { ...actualItem, [key]: next }
                                                    handlePropertyUpdate(normalizedName, updatedArray)
                                                  }}
                                                >
                                                  Remove
                                                </Button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
                                          onClick={() => {
                                            const next = [...btns, { label: '', url: '', variant: 'primary' }]
                                            const updatedArray = [...arrayValue]
                                            updatedArray[index] = { ...actualItem, [key]: next }
                                            handlePropertyUpdate(normalizedName, updatedArray)
                                          }}
                                        >
                                          Add Button
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                }

                                // Special handling for nested attribute-like arrays: list of small objects with primitive fields
                                if (isArray && (/attributes?/i.test(key) || (val as any[]).every(it => it && typeof it === 'object' && !Array.isArray(it)))) {
                                  const items = Array.isArray(val) ? (val as any[]) : []
                                  // Collect union of keys across items (only primitive fields)
                                  const keySet = new Set<string>()
                                  items.forEach((it) => {
                                    Object.keys(it || {}).forEach(k => {
                                      const v = (it as any)[k]
                                      if (v == null || ['string','number','boolean'].includes(typeof v)) keySet.add(k)
                                    })
                                  })
                                  const keys = Array.from(keySet.size ? keySet : new Set(['author','title']))

                                  return (
                                    <div key={key} className="space-y-2">
                                      <Label className="text-xs text-gray-400">{key}</Label>
                                      <div className="space-y-2">
                                        {items.map((it, iidx) => (
                                          <div key={iidx} className="border border-gray-700 rounded p-2 bg-gray-900/40">
                                            <div className="space-y-2">
                                              {keys.map(k => (
                                                <div key={k} className="flex items-center gap-2">
                                                  <span className="min-w-20 text-[11px] uppercase tracking-wide text-gray-500">{k}</span>
                                                  <Input
                                                    value={(it && (it as any)[k]) ?? ''}
                                                    onChange={(e) => {
                                                      const next = items.slice()
                                                      next[iidx] = { ...(it || {}), [k]: e.target.value }
                                                      const updatedArray = [...arrayValue]
                                                      updatedArray[index] = { ...actualItem, [key]: next }
                                                      handlePropertyUpdate(normalizedName, updatedArray)
                                                    }}
                                                    className="bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1"
                                                    placeholder={`Enter ${k}`}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                            <div className="flex justify-end mt-2">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-gray-400 hover:text-white"
                                                onClick={() => {
                                                  const next = items.filter((_, i) => i !== iidx)
                                                  const updatedArray = [...arrayValue]
                                                  updatedArray[index] = { ...actualItem, [key]: next }
                                                  handlePropertyUpdate(normalizedName, updatedArray)
                                                }}
                                              >
                                                Remove
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 px-2 bg-gray-800 border-gray-700 text-gray-300 hover:text-white"
                                          onClick={() => {
                                            const defaultItem = keys.includes('author') || keys.includes('title') ? { author: '', title: '' } : { key: '', value: '' }
                                            const next = [...items, defaultItem]
                                            const updatedArray = [...arrayValue]
                                            updatedArray[index] = { ...actualItem, [key]: next }
                                            handlePropertyUpdate(normalizedName, updatedArray)
                                          }}
                                        >
                                          Add Item
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                }

                                // Render flat key/value objects (e.g., attribute: { author, title }) as simple fields
                                if (isObj && !isArray) {
                                  const obj = val as Record<string, any>
                                  const keys = Object.keys(obj)
                                  const allPrimitive = keys.every(k => {
                                    const v = obj[k]
                                    return v === null || ['string', 'number', 'boolean'].includes(typeof v)
                                  })
                                  const looksLikeAttributes = /attributes?|meta(data)?|info|details|attribute/i.test(key) || allPrimitive
                                  if (looksLikeAttributes) {
                                    return (
                                      <div key={key} className="space-y-2">
                                        <Label className="text-xs text-gray-400">{key}</Label>
                                        <div className="space-y-1">
                                          {keys.map((nk) => (
                                            <div key={nk} className="flex items-center gap-2">
                                              <span className="min-w-20 text-[11px] uppercase tracking-wide text-gray-500">{nk}</span>
                                              <Input
                                                value={obj[nk] ?? ''}
                                                onChange={(e) => {
                                                  const nextObj = { ...obj, [nk]: e.target.value }
                                                  const updatedArray = [...arrayValue]
                                                  updatedArray[index] = { ...actualItem, [key]: nextObj }
                                                  handlePropertyUpdate(normalizedName, updatedArray)
                                                }}
                                                className="bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1"
                                                placeholder={`Enter ${nk}`}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  }
                                }

                                // Render complex non-button values with a JSON editor
                                if (isObj || isArray) {
                                  return (
                                    <div key={key} className="space-y-1">
                                      <Label className="text-xs text-gray-400">{key}</Label>
                                      <Textarea
                                        value={(() => { try { return JSON.stringify(val, null, 2) } catch { return String(val) } })()}
                                        onChange={(e) => {
                                          let nextVal: any = e.target.value
                                          try { nextVal = JSON.parse(e.target.value) } catch { /* keep string */ }
                                          const updatedArray = [...arrayValue]
                                          updatedArray[index] = { ...actualItem, [key]: nextVal }
                                          handlePropertyUpdate(normalizedName, updatedArray)
                                        }}
                                        className="bg-gray-800 border-gray-700 text-white font-mono text-xs min-h-[80px]"
                                        placeholder={`Enter ${key} as JSON`}
                                      />
                                    </div>
                                  )
                                }
                                // Primitive fallback
                                return (
                                  <div key={key} className="space-y-1">
                                    <Label className="text-xs text-gray-400">{key}</Label>
                                    <Input
                                      value={val || ''}
                                      onChange={(e) => {
                                        const updatedArray = [...arrayValue]
                                        updatedArray[index] = { ...actualItem, [key]: e.target.value }
                                        handlePropertyUpdate(normalizedName, updatedArray)
                                      }}
                                      className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                                      placeholder={`Enter ${key}`}
                                    />
                                  </div>
                                )
                              })}
                          </>
                        ) : (
                          // Fallback if item is not a proper object
                          <div className="text-xs text-gray-500">
                            Invalid item format
                          </div>
                        )}
                      </div>
                      ) : (
                        // For simple values in arrays (strings, numbers, etc.)
                        <Input
                          value={actualItem}
                          onChange={(e) => {
                            const updatedArray = [...arrayValue]
                            updatedArray[index] = e.target.value
                            handlePropertyUpdate(normalizedName, updatedArray)
                          }}
                          className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                          placeholder={`Enter ${label || name} item`}
                        />
                      )
                    })()}
                  </div>
                ))}
                
                {arrayValue.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No items yet. Click "Add Item" to create one.
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Handle complex object types
        if (isComplexObjectType) {
          // Parse the type to extract possible properties
          let objectValue = value || {}
          if (typeof objectValue === 'string') {
            try {
              objectValue = JSON.parse(objectValue)
            } catch {
              objectValue = {}
            }
          }

          // If this is a plain key/value map (no nested objects/arrays), render as key/value inputs
          if (objectValue && typeof objectValue === 'object' && !Array.isArray(objectValue)) {
            const keys = Object.keys(objectValue as Record<string, any>)
            const allPrimitive = keys.every(k => {
              const v = (objectValue as any)[k]
              return v === null || ['string', 'number', 'boolean'].includes(typeof v)
            })
            if (allPrimitive) {
              return (
                <div key={name} className="space-y-2">
                  <Label className="text-sm font-medium text-gray-300">
                    {label || name}
                    {required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  <div className="border border-gray-700 rounded-md p-3 bg-gray-800/50 space-y-2">
                    {keys.map((nk) => (
                      <div key={nk} className="flex items-center gap-2">
                        <span className="min-w-24 text-[11px] uppercase tracking-wide text-gray-500">{nk}</span>
                        <Input
                          value={(objectValue as any)[nk] ?? ''}
                          onChange={(e) => {
                            const updatedObject = { ...(objectValue as any), [nk]: e.target.value }
                            handlePropertyUpdate(normalizedName, updatedObject)
                          }}
                          className="bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1"
                          placeholder={`Enter ${nk}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          }

          // For complex objects, render a structured editor
          return (
            <div key={name} className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                {label || name}
                {required && <span className="text-red-400 ml-1">*</span>}
              </Label>
              {description && (
                <p className="text-xs text-gray-500">{description}</p>
              )}
              <div className="border border-gray-700 rounded-md p-3 bg-gray-800/50 space-y-3">
                {/* Type selector if the object has a 'type' property with union values */}
                {type.includes("type:'") && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Type</Label>
                    <Select
                      value={objectValue.type || ''}
                      onValueChange={(newType) => {
                        const updatedObject = { ...objectValue, type: newType }
                        handlePropertyUpdate(normalizedName, updatedObject)
                      }}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {(type.match(/type:\s*'([^'|]+)(?:\|'([^']+))*'/g)?.[0]
                          ?.replace(/type:\s*/, '')
                          ?.split('|')
                          ?.map(t => t.replace(/'/g, '').trim()) || []
                        ).map(option => (
                          <SelectItem 
                            key={option} 
                            value={option}
                            className="text-white hover:bg-gray-700 text-sm"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Dynamic fields based on selected type */}
                {objectValue.type === 'text' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400">Heading</Label>
                      <Input
                        value={objectValue.heading || ''}
                        onChange={(e) => {
                          const updatedObject = { ...objectValue, heading: e.target.value }
                          handlePropertyUpdate(normalizedName, updatedObject)
                        }}
                        className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                        placeholder="Enter heading"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400">Body</Label>
                      <div className="border border-gray-700 rounded-md bg-gray-800/50 overflow-hidden">
                        {/* Mini toolbar for nested body field */}
                        <div className="flex items-center gap-1 p-1 border-b border-gray-700 bg-gray-900/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              document.execCommand('bold', false)
                              const editorEl = document.getElementById(`nested-editor-${name}-body`)
                              if (editorEl) {
                                const updatedObject = { ...objectValue, body: editorEl.innerHTML }
                                handlePropertyUpdate(normalizedName, updatedObject)
                              }
                            }}
                            className="h-6 px-1.5 text-gray-400 hover:text-white hover:bg-gray-700 text-xs"
                            title="Bold"
                          >
                            <strong>B</strong>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              document.execCommand('italic', false)
                              const editorEl = document.getElementById(`nested-editor-${name}-body`)
                              if (editorEl) {
                                const updatedObject = { ...objectValue, body: editorEl.innerHTML }
                                handlePropertyUpdate(normalizedName, updatedObject)
                              }
                            }}
                            className="h-6 px-1.5 text-gray-400 hover:text-white hover:bg-gray-700 text-xs"
                            title="Italic"
                          >
                            <em>I</em>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const url = prompt('Enter URL:')
                              if (url) {
                                document.execCommand('createLink', false, url)
                                const editorEl = document.getElementById(`nested-editor-${name}-body`)
                                if (editorEl) {
                                  const updatedObject = { ...objectValue, body: editorEl.innerHTML }
                                  handlePropertyUpdate(normalizedName, updatedObject)
                                }
                              }
                            }}
                            className="h-6 px-1.5 text-gray-400 hover:text-white hover:bg-gray-700 text-xs"
                            title="Link"
                          >
                            🔗
                          </Button>
                          <div className="h-3 w-px bg-gray-700 mx-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              document.execCommand('insertUnorderedList', false)
                              const editorEl = document.getElementById(`nested-editor-${name}-body`)
                              if (editorEl) {
                                const updatedObject = { ...objectValue, body: editorEl.innerHTML }
                                handlePropertyUpdate(normalizedName, updatedObject)
                              }
                            }}
                            className="h-6 px-1.5 text-gray-400 hover:text-white hover:bg-gray-700 text-xs"
                            title="Bullet List"
                          >
                            •
                          </Button>
                        </div>
                        {/* WYSIWYG Editor for nested body */}
                        <div
                          id={`nested-editor-${name}-body`}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const target = e.target as HTMLDivElement
                            const updatedObject = { ...objectValue, body: target.innerHTML }
                            handlePropertyUpdate(normalizedName, updatedObject)
                          }}
                          onFocus={(e) => {
                            const target = e.target as HTMLDivElement
                            if (!target.innerHTML || target.innerHTML === '<br>') {
                              target.innerHTML = ''
                            }
                          }}
                          className="min-h-[80px] p-2 bg-gray-900 text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 prose prose-sm prose-invert max-w-none [&>*]:text-gray-200 [&_a]:text-blue-400 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: objectValue.body || '' }}
                          style={{
                            lineHeight: '1.5',
                            fontSize: '13px'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {objectValue.type === 'image' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Image URL</Label>
                    <Input
                      value={objectValue.imageUrl || ''}
                      onChange={(e) => {
                        const updatedObject = { ...objectValue, imageUrl: e.target.value }
                        handlePropertyUpdate(normalizedName, updatedObject)
                      }}
                      className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                      placeholder="Enter image URL"
                    />
                  </div>
                )}
                
                {objectValue.type === 'video' && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Video URL</Label>
                    <Input
                      value={objectValue.videoUrl || ''}
                      onChange={(e) => {
                        const updatedObject = { ...objectValue, videoUrl: e.target.value }
                        handlePropertyUpdate(normalizedName, updatedObject)
                      }}
                      className="bg-gray-800 border-gray-700 text-white h-8 text-sm"
                      placeholder="Enter video URL"
                    />
                  </div>
                )}
                
                {/* Fallback JSON editor for unknown types or no type selected */}
                {(!objectValue.type || !['text', 'image', 'video'].includes(objectValue.type)) && !type.includes("type:'") && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">JSON Data</Label>
                    <Textarea
                      value={JSON.stringify(objectValue, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value)
                          handlePropertyUpdate(normalizedName, parsed)
                        } catch {
                          // Invalid JSON, don't update
                        }
                      }}
                      className="bg-gray-800 border-gray-700 text-white font-mono text-xs min-h-[80px]"
                      placeholder="Enter JSON data"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        }

        // For other complex types like arrays or unknown, show as JSON editor
        return (
          <div key={name} className="space-y-2">
            <Label htmlFor={name} className="text-sm font-medium text-gray-300">
              {label || name} <span className="text-xs text-gray-500">({type})</span>
              {required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
            <Textarea
              id={name}
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handlePropertyUpdate(normalizedName, parsed)
                } catch {
                  handlePropertyUpdate(normalizedName, e.target.value)
                }
              }}
              className="bg-gray-800 border-gray-700 text-white font-mono text-xs min-h-[100px]"
              placeholder={`Enter ${label || name} as JSON`}
            />
          </div>
        )
    }
  }

  if (!isPortalReady || typeof document === 'undefined' || !document.body) {
    return null
  }

  return (
    <>
      {createPortal(
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-[1040]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && component && (
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className={cn(
              'fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-[1050]',
              'flex flex-col'
            )}
          >
            {/* Header - CP-04: Added delete button */}
            {/* Visual indicator for shared/global components */}
            <div className={cn(
              "flex items-center justify-between p-4 border-b",
              component.props?.sharedComponentId ? "bg-blue-900/20 border-blue-500/30" : "border-gray-700"
            )}>
              <div className="flex-1 min-w-0">
                {component.props?.sharedComponentId ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <h2 className="text-lg font-semibold text-white truncate">
                        Global Component
                      </h2>
                      {Object.keys(component.props?.overrides || {}).length > 0 && (
                        <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                          Edited
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {component.type}
                    </p>
                    <p className="text-xs text-blue-300 mt-1">
                      Changes affect all pages using this component
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-white">
                      Component Properties
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {component.type}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Make Global button - only for non-global components */}
                {!component.props?.sharedComponentId && websiteId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMakeGlobalOpen(true)}
                    className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    title="Convert to global component"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && nodeId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(component.id, nodeId)}
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Delete component"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Properties */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {uiSchema.length > 0 ? (
                  uiSchema.map(schema => {
                    const name = schema.name
                    const normalizedName = name && name.startsWith('content.') ? name.slice(8) : name
                    // Use recursive renderer with depth=0 for top-level fields
                    return renderSchemaField(schema, normalizedName, 0)
                  })
                ) : propertyDefinitions.length > 0 ? (
                  propertyDefinitions.map(def => renderPropertyField(def))
                ) : (
                  // Fallback: Show raw properties if no definitions
                  <div className="space-y-4">
                    <div className="text-sm text-gray-500">
                      No property definitions available. Showing raw data:
                    </div>
                    <Textarea
                      value={JSON.stringify(properties, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value)
                          setProperties(parsed)
                          if (component) {
                            const updatedProps = {
                              ...component.props,
                              text: e.target.value,
                              content: e.target.value
                            }
                            onPropertyChange(component.id, 'content', parsed)
                            onPropertyChange(component.id, 'props', updatedProps)
                          }
                        } catch (error) {
                          if (process.env.NODE_ENV === 'development') {
                          console.error('Invalid JSON:', error)
                          }
                        }
                      }}
                      className="bg-gray-800 border-gray-700 text-white font-mono text-xs min-h-[400px]"
                      placeholder="Component properties (JSON)"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-900/50">
              <p className="text-xs text-gray-500">
                Click outside or press ESC to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )}
      <MakeGlobalDialog
        isOpen={makeGlobalOpen}
        onClose={() => setMakeGlobalOpen(false)}
        component={component}
        websiteId={websiteId || ''}
      />
    </>
  )
}







