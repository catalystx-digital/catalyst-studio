'use client'

/**
 * DateTimeEditor - Date and time picker editor
 *
 * Features:
 * - Native datetime-local input with styling
 * - ISO8601 format for storage with timezone
 * - Min/max constraints
 * - Clear button for optional fields
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CalendarIcon, X } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

/**
 * Convert ISO string to datetime-local input format (YYYY-MM-DDTHH:mm)
 */
function toDateTimeLocalValue(isoString: string | null): string {
  if (!isoString) return ''
  try {
    const parsed = parseISO(isoString)
    if (!isValid(parsed)) return ''
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    return format(parsed, "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

/**
 * Convert datetime-local input value to ISO string
 */
function fromDateTimeLocalValue(localValue: string): string | null {
  if (!localValue) return null
  try {
    // datetime-local gives us YYYY-MM-DDTHH:mm, parse and convert to ISO
    const date = new Date(localValue)
    return isValid(date) ? date.toISOString() : null
  } catch {
    return null
  }
}

export function DateTimeEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | null>) {
  const id = useFieldId(schema, providedId)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Convert ISO value to datetime-local format for input
  const inputValue = React.useMemo(() => toDateTimeLocalValue(value), [value])

  // Format date for display below the input
  const displayValue = React.useMemo(() => {
    if (!value) return ''
    try {
      const parsed = parseISO(value)
      return isValid(parsed) ? format(parsed, 'PPP p') : ''
    } catch {
      return ''
    }
  }, [value])

  // Calculate min datetime constraint
  const minDateTime = React.useMemo(() => {
    if (schema.min === undefined) return undefined
    // If min is a number, treat it as days from today
    if (typeof schema.min === 'number') {
      const d = new Date()
      d.setDate(d.getDate() + schema.min)
      return format(d, "yyyy-MM-dd'T'HH:mm")
    }
    return undefined
  }, [schema.min])

  // Calculate max datetime constraint
  const maxDateTime = React.useMemo(() => {
    if (schema.max === undefined) return undefined
    // If max is a number, treat it as days from today
    if (typeof schema.max === 'number') {
      const d = new Date()
      d.setDate(d.getDate() + schema.max)
      return format(d, "yyyy-MM-dd'T'HH:mm")
    }
    return undefined
  }, [schema.max])

  // Handle datetime change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      onChange(fromDateTimeLocalValue(newValue))
    },
    [onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(() => {
    onChange(null)
  }, [onChange])

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Input
          id={id}
          type="datetime-local"
          value={inputValue}
          onChange={handleChange}
          disabled={isDisabled}
          min={minDateTime}
          max={maxDateTime}
          className={cn(
            'pr-8',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!error}
        />
        {value && !schema.required && !isDisabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {displayValue && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          {displayValue}
        </p>
      )}
    </PrimitiveEditor>
  )
}
