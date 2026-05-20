'use client'

/**
 * DateEditor - Date picker editor
 *
 * Features:
 * - Native date input with styling
 * - ISO8601 format for storage (YYYY-MM-DD)
 * - Min/max date constraints
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

export function DateEditor({
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

  // Parse the value to a Date object for display
  const dateValue = React.useMemo(() => {
    if (!value) return ''
    try {
      const parsed = parseISO(value)
      return isValid(parsed) ? value : ''
    } catch {
      return ''
    }
  }, [value])

  // Format date for display
  const displayValue = React.useMemo(() => {
    if (!value) return ''
    try {
      const parsed = parseISO(value)
      return isValid(parsed) ? format(parsed, 'PPP') : ''
    } catch {
      return ''
    }
  }, [value])

  // Calculate min date constraint
  const minDate = React.useMemo(() => {
    if (schema.min === undefined) return undefined
    // If min is a number, treat it as days from today
    if (typeof schema.min === 'number') {
      const d = new Date()
      d.setDate(d.getDate() + schema.min)
      return format(d, 'yyyy-MM-dd')
    }
    return undefined
  }, [schema.min])

  // Calculate max date constraint
  const maxDate = React.useMemo(() => {
    if (schema.max === undefined) return undefined
    // If max is a number, treat it as days from today
    if (typeof schema.max === 'number') {
      const d = new Date()
      d.setDate(d.getDate() + schema.max)
      return format(d, 'yyyy-MM-dd')
    }
    return undefined
  }, [schema.max])

  // Handle date change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      if (newValue) {
        onChange(newValue)
      } else {
        onChange(null)
      }
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
          type="date"
          value={dateValue}
          onChange={handleChange}
          disabled={isDisabled}
          min={minDate}
          max={maxDate}
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
