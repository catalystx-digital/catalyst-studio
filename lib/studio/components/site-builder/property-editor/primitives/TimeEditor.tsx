'use client'

/**
 * TimeEditor - Time picker editor
 *
 * Features:
 * - Time input with native picker
 * - HH:mm:ss format for storage
 * - Optional seconds
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Clock, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

export function TimeEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | null>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(value ?? '')

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Handle time change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)

      // Normalize to HH:mm:ss format
      if (newValue) {
        const normalized = newValue.includes(':')
          ? newValue.length === 5
            ? `${newValue}:00`
            : newValue
          : null
        onChange(normalized)
      } else {
        onChange(null)
      }
    },
    [onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(() => {
    setLocalValue('')
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
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="time"
          value={localValue.slice(0, 5)} // Show HH:mm only
          onChange={handleChange}
          disabled={isDisabled}
          className={cn(
            'pl-10',
            error && 'border-destructive',
            localValue && !schema.required && 'pr-10'
          )}
          aria-invalid={!!error}
        />
        {localValue && !schema.required && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
            disabled={isDisabled}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </PrimitiveEditor>
  )
}
