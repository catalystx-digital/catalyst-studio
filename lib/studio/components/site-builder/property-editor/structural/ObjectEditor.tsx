'use client'

/**
 * ObjectEditor - Nested object fields editor
 *
 * Features:
 * - Render child FieldSchema[] as nested editors
 * - Collapsible with expand/collapse toggle
 * - Field grouping support
 * - Path propagation for nested fields
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getFieldLabel } from '../schema/types'
import type { FieldSchema } from '../schema/types'
import type { EditorProps } from '../primitives/types'

// Forward declaration for FieldDispatcher to avoid circular dependency
interface FieldDispatcherProps {
  schema: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  path?: string
  disabled?: boolean
  error?: string
}

interface ObjectEditorProps extends EditorProps<Record<string, unknown>> {
  /** Field dispatcher component (passed to avoid circular import) */
  FieldDispatcher: React.ComponentType<FieldDispatcherProps>
  /** Field-level errors keyed by field name */
  fieldErrors?: Record<string, string>
}

export function ObjectEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  path,
  FieldDispatcher,
  fieldErrors,
}: ObjectEditorProps) {
  const [isOpen, setIsOpen] = React.useState(!schema.collapsed)

  const fields = schema.fields ?? []
  const currentValue = value ?? {}
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const label = getFieldLabel(schema)

  // Group fields by their group property
  const groupedFields = React.useMemo(() => {
    const groups: Record<string, FieldSchema[]> = {}
    const ungrouped: FieldSchema[] = []

    // Sort fields by order
    const sortedFields = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    for (const field of sortedFields) {
      if (field.group) {
        if (!groups[field.group]) {
          groups[field.group] = []
        }
        groups[field.group].push(field)
      } else {
        ungrouped.push(field)
      }
    }

    return { groups, ungrouped }
  }, [fields])

  // Handle field change
  const handleFieldChange = React.useCallback(
    (fieldName: string) => (fieldValue: unknown) => {
      onChange({
        ...currentValue,
        [fieldName]: fieldValue,
      })
    },
    [currentValue, onChange]
  )

  // Get field path
  const getFieldPath = React.useCallback(
    (fieldName: string) => {
      return path ? `${path}.${fieldName}` : fieldName
    },
    [path]
  )

  // Render a single field
  const renderField = React.useCallback(
    (field: FieldSchema) => {
      // Check hidden condition
      if (typeof field.hidden === 'function') {
        if (field.hidden(currentValue)) return null
      } else if (field.hidden) {
        return null
      }

      const fieldPath = getFieldPath(field.name)
      const fieldError = fieldErrors?.[field.name]

      return (
        <div
          key={field.name}
          className={cn(
            field.width === 'half' && 'w-1/2',
            field.width === 'third' && 'w-1/3',
            !field.width && 'w-full'
          )}
        >
          <FieldDispatcher
            schema={field}
            value={currentValue[field.name]}
            onChange={handleFieldChange(field.name)}
            path={fieldPath}
            disabled={isDisabled}
            error={fieldError}
          />
        </div>
      )
    },
    [currentValue, handleFieldChange, getFieldPath, isDisabled, FieldDispatcher, fieldErrors]
  )

  // If no label, render fields directly without collapsible wrapper
  if (!label) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Render ungrouped fields */}
        <div className="flex flex-wrap gap-4">
          {groupedFields.ungrouped.map(renderField)}
        </div>

        {/* Render grouped fields */}
        {Object.entries(groupedFields.groups).map(([groupName, groupFields]) => (
          <div key={groupName} className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {groupName}
            </h4>
            <div className="flex flex-wrap gap-4 pl-2 border-l-2 border-muted">
              {groupFields.map(renderField)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Render with collapsible wrapper
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('space-y-2', className)}
    >
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="p-0 h-auto hover:bg-transparent"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
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
      </div>

      {error && (
        <p className="text-xs text-destructive ml-6" role="alert">
          {error}
        </p>
      )}

      {schema.description && (
        <p className="text-xs text-muted-foreground ml-6">
          {schema.description}
        </p>
      )}

      <CollapsibleContent className="pl-6 pt-2 space-y-4">
        {/* Render ungrouped fields */}
        <div className="flex flex-wrap gap-4">
          {groupedFields.ungrouped.map(renderField)}
        </div>

        {/* Render grouped fields */}
        {Object.entries(groupedFields.groups).map(([groupName, groupFields]) => (
          <div key={groupName} className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              {groupName}
            </h4>
            <div className="flex flex-wrap gap-4 pl-2 border-l-2 border-muted">
              {groupFields.map(renderField)}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
