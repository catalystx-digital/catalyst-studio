'use client'

/**
 * ArrayEditor - List of same-type items editor
 *
 * Features:
 * - Add/remove items
 * - Drag-drop reorder
 * - Expand/collapse individual items
 * - Minimum/maximum item count
 * - Item header shows summary (first field value)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { getFieldLabel, getDefaultValue } from '../schema/types'
import type { FieldSchema } from '../schema/types'
import type { EditorProps } from '../primitives/types'

// Forward declaration for FieldDispatcher
interface FieldDispatcherProps {
  schema: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  path?: string
  disabled?: boolean
  error?: string
}

interface ArrayEditorProps extends EditorProps<unknown[]> {
  /** Field dispatcher component */
  FieldDispatcher: React.ComponentType<FieldDispatcherProps>
  /** Item-level errors keyed by index */
  itemErrors?: Record<number, string | Record<string, string>>
}

export function ArrayEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  path,
  FieldDispatcher,
  itemErrors,
}: ArrayEditorProps) {
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(
    new Set([0]) // First item expanded by default
  )
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)

  const items = value ?? []
  const itemSchema = schema.items
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const label = getFieldLabel(schema)

  const minItems = schema.minItems ?? 0
  const maxItems = schema.maxItems
  const canAdd = !maxItems || items.length < maxItems
  const canRemove = items.length > minItems

  // Get item summary for display
  const getItemSummary = React.useCallback(
    (item: unknown, index: number): string => {
      if (!item || typeof item !== 'object') {
        return `Item ${index + 1}`
      }

      // Try to get first string field as summary
      const obj = item as Record<string, unknown>

      // Common field names for titles
      const titleFields = ['title', 'name', 'label', 'heading', 'text']
      for (const field of titleFields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const text = obj[field] as string
          return text.length > 50 ? `${text.slice(0, 50)}...` : text
        }
      }

      // Try first field in schema
      if (itemSchema?.fields?.[0]) {
        const firstField = itemSchema.fields[0].name
        if (obj[firstField] && typeof obj[firstField] === 'string') {
          const text = obj[firstField] as string
          return text.length > 50 ? `${text.slice(0, 50)}...` : text
        }
      }

      return `Item ${index + 1}`
    },
    [itemSchema]
  )

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

  // Add new item
  const handleAdd = React.useCallback(() => {
    if (!canAdd || !itemSchema) return

    const defaultValue = getDefaultValue(itemSchema)
    const newItems = [...items, defaultValue]
    onChange(newItems)

    // Expand the new item
    setExpandedItems((prev) => new Set([...prev, newItems.length - 1]))
  }, [canAdd, itemSchema, items, onChange])

  // Remove item
  const handleRemove = React.useCallback(
    (index: number) => {
      if (!canRemove) return

      const newItems = items.filter((_, i) => i !== index)
      onChange(newItems)

      // Update expanded set
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
      newItems[index] = itemValue
      onChange(newItems)
    },
    [items, onChange]
  )

  // Drag and drop handlers
  const handleDragStart = React.useCallback(
    (index: number) => (e: React.DragEvent) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const handleDragOver = React.useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropIndex(index)
    },
    []
  )

  const handleDragEnd = React.useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newItems = [...items]
      const [removed] = newItems.splice(dragIndex, 1)
      newItems.splice(dropIndex, 0, removed)
      onChange(newItems)

      // Update expanded set
      setExpandedItems((prev) => {
        const next = new Set<number>()
        prev.forEach((i) => {
          if (i === dragIndex) {
            next.add(dropIndex)
          } else if (dragIndex < dropIndex) {
            if (i > dragIndex && i <= dropIndex) next.add(i - 1)
            else next.add(i)
          } else {
            if (i >= dropIndex && i < dragIndex) next.add(i + 1)
            else next.add(i)
          }
        })
        return next
      })
    }

    setDragIndex(null)
    setDropIndex(null)
  }, [dragIndex, dropIndex, items, onChange])

  if (!itemSchema) {
    return (
      <div className="text-sm text-muted-foreground">
        Array schema missing items definition
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span
            className={cn(
              'text-sm font-medium',
              error && 'text-destructive'
            )}
          >
            {label}
            {schema.required && (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({items.length} item{items.length !== 1 ? 's' : ''})
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
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

      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const isExpanded = expandedItems.has(index)
          const itemPath = path ? `${path}[${index}]` : `[${index}]`
          const itemError = itemErrors?.[index]
          const errorString = typeof itemError === 'string' ? itemError : undefined

          return (
            <div
              key={index}
              className={cn(
                'border rounded-lg',
                dropIndex === index && dragIndex !== null && 'border-primary',
                dragIndex === index && 'opacity-50'
              )}
              draggable={!isDisabled}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={handleDragEnd}
            >
              <Collapsible open={isExpanded} onOpenChange={() => toggleItem(index)}>
                {/* Item header */}
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-t-lg">
                  <div
                    className={cn(
                      'cursor-grab',
                      isDisabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
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
                      <span className="text-sm truncate">
                        {getItemSummary(item, index)}
                      </span>
                    </Button>
                  </CollapsibleTrigger>

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

                {/* Item content */}
                <CollapsibleContent className="p-3 border-t">
                  <FieldDispatcher
                    schema={itemSchema}
                    value={item}
                    onChange={handleItemChange(index)}
                    path={itemPath}
                    disabled={isDisabled}
                    error={errorString}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
          No items yet. Click "Add" to create one.
        </div>
      )}

      {/* Min/max hints */}
      {(minItems > 0 || maxItems) && (
        <p className="text-xs text-muted-foreground">
          {minItems > 0 && `Minimum: ${minItems}`}
          {minItems > 0 && maxItems && ' • '}
          {maxItems && `Maximum: ${maxItems}`}
        </p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item? This action cannot be
              undone.
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
