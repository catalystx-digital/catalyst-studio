'use client'

/**
 * TextEditor - Multi-line text area editor
 *
 * Features:
 * - Multi-line textarea
 * - Auto-resize option
 * - Character counter
 * - Configurable rows
 * - Graceful handling of object values (extracts text content if present)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import {
  PrimitiveEditor,
  CharacterCount,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

/**
 * Normalize value to string - handles cases where data contains objects
 * instead of expected string values (common with imported/migrated data)
 */
function normalizeTextValue(value: unknown): string {
  // Null/undefined -> empty string
  if (value == null) return ''

  // String handling - check for corrupted "[object Object]" strings
  if (typeof value === 'string') {
    // Detect corrupted object-to-string coercion from previous saves
    if (value === '[object Object]' || value.startsWith('[object ')) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[TextEditor] Detected corrupted "[object Object]" string value. ' +
        'This indicates data was previously saved incorrectly. Clearing field.'
      )
      }
      return ''
    }
    return value
  }

  // Object - try to extract a sensible string value
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Common text content properties
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.value === 'string') return obj.value
    if (typeof obj.html === 'string') return obj.html
    if (typeof obj.description === 'string') return obj.description

    // Log warning for debugging imported data issues
    if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[TextEditor] Received object value where string expected. ' +
      'This may indicate a data migration issue. Object keys:',
      Object.keys(obj)
    )
    }

    // Return empty string rather than [object Object]
    return ''
  }

  // Numbers, booleans, etc. - convert to string
  return String(value)
}

export function TextEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [localValue, setLocalValue] = React.useState(normalizeTextValue(value))

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(normalizeTextValue(value))
  }, [value])

  // Auto-resize functionality
  const autoResize = React.useCallback(() => {
    if (!schema.autoResize || !textareaRef.current) return

    const textarea = textareaRef.current
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [schema.autoResize])

  // Run auto-resize on value change
  React.useEffect(() => {
    autoResize()
  }, [localValue, autoResize])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      debouncedOnChange(newValue)
    },
    [debouncedOnChange]
  )

  // Handle blur - flush debounce
  const handleBlur = React.useCallback(() => {
    flush()
  }, [flush])

  const charCount = localValue?.length ?? 0
  const isOverLimit = schema.maxLength ? charCount > schema.maxLength : false
  const rows = schema.rows ?? 4

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id={id}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
          placeholder={schema.placeholder}
          rows={rows}
          className={cn(
            'resize-none',
            schema.autoResize && 'overflow-hidden',
            isOverLimit && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${id}-error`
              : schema.description
                ? `${id}-description`
                : undefined
          }
        />

        {/* Character count */}
        {schema.maxLength && (
          <div className="absolute bottom-2 right-3">
            <CharacterCount count={charCount} maxLength={schema.maxLength} />
          </div>
        )}
      </div>
    </PrimitiveEditor>
  )
}
