'use client'

/**
 * ComponentArrayEditor - Array of component instances editor
 *
 * Features:
 * - Component type selector (from allowedTypes)
 * - Load schema dynamically for selected type
 * - Render appropriate editors for component props
 * - Integrate with global component system (sharedComponentId)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Link2,
  Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getFieldLabel } from '../schema/types'
import type { FieldSchema } from '../schema/types'
import type { EditorProps } from '../primitives/types'

// Component instance structure
interface ComponentInstance {
  id: string
  type: string
  sharedComponentId?: string | null
  props?: Record<string, unknown>
  content?: Record<string, unknown>
}

// Component type definition
interface ComponentType {
  type: string
  label: string
  description?: string
  icon?: string
  schema?: FieldSchema[]
}

// Global component reference
interface GlobalComponent {
  id: string
  name: string
  type: string
  thumbnail?: string
}

// Forward declaration for FieldDispatcher
interface FieldDispatcherProps {
  schema: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  path?: string
  disabled?: boolean
  error?: string
}

interface ComponentArrayEditorProps extends EditorProps<ComponentInstance[]> {
  /** Field dispatcher component */
  FieldDispatcher: React.ComponentType<FieldDispatcherProps>
  /** Available component types */
  componentTypes?: ComponentType[]
  /** Available global components */
  globalComponents?: GlobalComponent[]
  /** Callback to load schema for a component type */
  onLoadSchema?: (type: string) => Promise<FieldSchema[]>
  /** Callback to load global components */
  onLoadGlobalComponents?: (type?: string) => Promise<GlobalComponent[]>
  /** Item-level errors keyed by index */
  itemErrors?: Record<number, string | Record<string, string>>
}

// Generate unique ID
function generateId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function ComponentArrayEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  path,
  FieldDispatcher,
  componentTypes,
  globalComponents: providedGlobalComponents,
  onLoadSchema,
  onLoadGlobalComponents,
  itemErrors,
}: ComponentArrayEditorProps) {
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(
    new Set([0])
  )
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [globalDialogOpen, setGlobalDialogOpen] = React.useState<number | null>(null)
  const [loadedSchemas, setLoadedSchemas] = React.useState<
    Record<string, FieldSchema[]>
  >({})
  const [globalComponents, setGlobalComponents] = React.useState<GlobalComponent[]>(
    providedGlobalComponents ?? []
  )

  const items = value ?? []
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const label = getFieldLabel(schema)
  const allowedTypes = schema.allowedTypes ?? []

  const minItems = schema.minItems ?? 0
  const maxItems = schema.maxItems
  const canAdd = !maxItems || items.length < maxItems
  const canRemove = items.length > minItems

  // Filter component types by allowed
  const availableTypes = React.useMemo(() => {
    if (!componentTypes) return []
    if (allowedTypes.length === 0) return componentTypes
    return componentTypes.filter((t) => allowedTypes.includes(t.type))
  }, [componentTypes, allowedTypes])

  // Load schema for a component type
  const loadSchema = React.useCallback(
    async (type: string) => {
      if (loadedSchemas[type]) return loadedSchemas[type]

      // Try to get from componentTypes first
      const componentType = componentTypes?.find((t) => t.type === type)
      if (componentType?.schema) {
        setLoadedSchemas((prev) => ({
          ...prev,
          [type]: componentType.schema!,
        }))
        return componentType.schema
      }

      // Load dynamically
      if (onLoadSchema) {
        const schema = await onLoadSchema(type)
        setLoadedSchemas((prev) => ({
          ...prev,
          [type]: schema,
        }))
        return schema
      }

      return []
    },
    [loadedSchemas, componentTypes, onLoadSchema]
  )

  // Load global components
  React.useEffect(() => {
    if (providedGlobalComponents) {
      setGlobalComponents(providedGlobalComponents)
    }
  }, [providedGlobalComponents])

  React.useEffect(() => {
    async function load() {
      if (onLoadGlobalComponents && globalDialogOpen !== null) {
        const item = items[globalDialogOpen]
        const loaded = await onLoadGlobalComponents(item?.type)
        setGlobalComponents(loaded)
      }
    }
    load()
  }, [globalDialogOpen, onLoadGlobalComponents, items])

  // Load schemas for existing items
  React.useEffect(() => {
    items.forEach((item) => {
      if (item.type && !loadedSchemas[item.type]) {
        loadSchema(item.type)
      }
    })
  }, [items, loadedSchemas, loadSchema])

  // Toggle item expansion
  const toggleItem = React.useCallback((index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Add new component
  const handleAdd = React.useCallback(
    (type: string) => {
      if (!canAdd) return

      const newComponent: ComponentInstance = {
        id: generateId(),
        type,
        props: {},
        content: {},
      }

      const newItems = [...items, newComponent]
      onChange(newItems)

      // Expand the new item
      setExpandedItems((prev) => new Set([...prev, newItems.length - 1]))
      setAddDialogOpen(false)
    },
    [canAdd, items, onChange]
  )

  // Remove item
  const handleRemove = React.useCallback(
    (index: number) => {
      if (!canRemove) return

      const newItems = items.filter((_, i) => i !== index)
      onChange(newItems)

      setExpandedItems((prev) => {
        const next = new Set<number>()
        prev.forEach((i) => {
          if (i < index) next.add(i)
          else if (i > index) next.add(i - 1)
        })
        return next
      })

      setDeleteIndex(null)
    },
    [canRemove, items, onChange]
  )

  // Handle item change
  const handleItemChange = React.useCallback(
    (index: number) => (itemValue: unknown) => {
      const newItems = [...items]
      const current = newItems[index]
      const updated = itemValue as Record<string, unknown>

      // Merge into component structure
      newItems[index] = {
        ...current,
        props: {
          ...current.props,
          ...updated,
        },
      }

      onChange(newItems)
    },
    [items, onChange]
  )

  // Link to global component
  const handleLinkGlobal = React.useCallback(
    (index: number, globalId: string) => {
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        sharedComponentId: globalId,
      }
      onChange(newItems)
      setGlobalDialogOpen(null)
    },
    [items, onChange]
  )

  // Unlink from global component
  const handleUnlinkGlobal = React.useCallback(
    (index: number) => {
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        sharedComponentId: null,
      }
      onChange(newItems)
    },
    [items, onChange]
  )

  // Drag handlers
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  const handleDragEnd = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newItems = [...items]
      const [removed] = newItems.splice(dragIndex, 1)
      newItems.splice(dropIndex, 0, removed)
      onChange(newItems)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  // Get component type label
  const getTypeLabel = (type: string): string => {
    const typeConfig = componentTypes?.find((t) => t.type === type)
    return typeConfig?.label ?? type
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className={cn('text-sm font-medium', error && 'text-destructive')}>
            {label}
            {schema.required && (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({items.length} component{items.length !== 1 ? 's' : ''})
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          disabled={isDisabled || !canAdd}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const isExpanded = expandedItems.has(index)
          const itemPath = path ? `${path}[${index}]` : `[${index}]`
          const itemSchema = loadedSchemas[item.type] ?? []
          const isGlobal = !!item.sharedComponentId

          return (
            <div
              key={item.id}
              className={cn(
                'border rounded-lg',
                dropIndex === index && dragIndex !== null && 'border-primary',
                dragIndex === index && 'opacity-50',
                isGlobal && 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10'
              )}
              draggable={!isDisabled}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={handleDragEnd}
            >
              <Collapsible open={isExpanded} onOpenChange={() => toggleItem(index)}>
                {/* Item header */}
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-t-lg">
                  <div className={cn('cursor-grab', isDisabled && 'cursor-not-allowed opacity-50')}>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto hover:bg-transparent flex-1 justify-start"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      <Badge variant="secondary" className="mr-2">
                        {getTypeLabel(item.type)}
                      </Badge>
                      {isGlobal && (
                        <Badge variant="outline" className="text-blue-600">
                          <Link2 className="h-3 w-3 mr-1" />
                          Global
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  <div className="flex gap-1">
                    {/* Global link/unlink button */}
                    {isGlobal ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUnlinkGlobal(index)}
                        disabled={isDisabled}
                        title="Unlink from global component"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setGlobalDialogOpen(index)}
                        disabled={isDisabled}
                        title="Link to global component"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDeleteIndex(index)}
                      disabled={isDisabled || !canRemove}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Item content */}
                <CollapsibleContent className="p-3 border-t">
                  {isGlobal ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      This component is linked to a global component.
                      <br />
                      Changes are managed from the global components panel.
                    </div>
                  ) : itemSchema.length > 0 ? (
                    <div className="space-y-4">
                      {itemSchema.map((fieldSchema) => (
                        <FieldDispatcher
                          key={fieldSchema.name}
                          schema={fieldSchema}
                          value={(item.props as Record<string, unknown>)?.[fieldSchema.name]}
                          onChange={(fieldValue) => {
                            handleItemChange(index)({
                              ...item.props,
                              [fieldSchema.name]: fieldValue,
                            })
                          }}
                          path={`${itemPath}.props.${fieldSchema.name}`}
                          disabled={isDisabled}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Loading schema...
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
          No components yet. Click "Add" to create one.
        </div>
      )}

      {/* Add component dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Component</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {availableTypes.map((type) => (
              <Button
                key={type.type}
                variant="outline"
                className="justify-start h-auto p-3"
                onClick={() => handleAdd(type.type)}
              >
                <div className="text-left">
                  <div className="font-medium">{type.label}</div>
                  {type.description && (
                    <div className="text-xs text-muted-foreground">
                      {type.description}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Global component dialog */}
      <Dialog
        open={globalDialogOpen !== null}
        onOpenChange={(open) => !open && setGlobalDialogOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Global Component</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {globalComponents
              .filter(
                (g) => globalDialogOpen !== null && g.type === items[globalDialogOpen]?.type
              )
              .map((global) => (
                <Button
                  key={global.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() =>
                    globalDialogOpen !== null && handleLinkGlobal(globalDialogOpen, global.id)
                  }
                >
                  {global.name}
                </Button>
              ))}
            {globalComponents.filter(
              (g) => globalDialogOpen !== null && g.type === items[globalDialogOpen]?.type
            ).length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No global components of this type available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Component</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this component? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIndex !== null && handleRemove(deleteIndex)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
