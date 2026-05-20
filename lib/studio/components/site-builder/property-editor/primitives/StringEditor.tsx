'use client'

/**
 * StringEditor - Single-line text input editor
 *
 * Features:
 * - Single-line text input
 * - Character counter when maxLength specified
 * - Pattern validation with error message
 * - Debounced onChange (300ms)
 * - Graceful handling of object values (extracts url/src if present)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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
function normalizeStringValue(value: unknown): string {
  // Null/undefined -> empty string
  if (value == null) return ''

  // String handling - check for corrupted "[object Object]" strings
  if (typeof value === 'string') {
    // Detect corrupted object-to-string coercion from previous saves
    if (value === '[object Object]' || value.startsWith('[object ')) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[StringEditor] Detected corrupted "[object Object]" string value. ' +
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

    // Common URL-like properties (ordered by priority)
    if (typeof obj.url === 'string') return obj.url
    if (typeof obj.src === 'string') return obj.src
    if (typeof obj.href === 'string') return obj.href

    // Other common string properties
    if (typeof obj.value === 'string') return obj.value
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.label === 'string') return obj.label

    // Log warning for debugging imported data issues
    if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[StringEditor] Received object value where string expected. ' +
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

export function StringEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)

  // Debug: Log all incoming values to trace [object Object] issue
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    console.log('[StringEditor] Mount/Update:', {
      fieldName: schema.name,
      rawValue: value,
      rawValueType: typeof value,
      normalized: normalizeStringValue(value),
    })
    }
  }, [value, schema.name])

  const [localValue, setLocalValue] = React.useState(normalizeStringValue(value))
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(normalizeStringValue(value))
  }, [value])

  // Sync with external error changes
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Validate against pattern
  const validatePattern = React.useCallback(
    (val: string): string | undefined => {
      if (!schema.pattern || !val) return undefined

      try {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(val)) {
          return schema.patternMessage ?? 'Invalid format'
        }
      } catch {
        // Invalid regex pattern in schema
        if (process.env.NODE_ENV === 'development') {
        console.warn(`Invalid regex pattern in schema: ${schema.pattern}`)
        }
      }
      return undefined
    },
    [schema.pattern, schema.patternMessage]
  )

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)

      // Clear pattern error when typing
      if (localError && !error) {
        setLocalError(undefined)
      }

      debouncedOnChange(newValue)
    },
    [debouncedOnChange, localError, error]
  )

  // Handle blur - flush debounce and validate
  const handleBlur = React.useCallback(() => {
    flush()

    // Validate pattern on blur
    const patternError = validatePattern(localValue)
    if (patternError) {
      setLocalError(patternError)
    }
  }, [flush, validatePattern, localValue])

  const displayError = localError || error
  const charCount = localValue?.length ?? 0
  const isOverLimit = schema.maxLength ? charCount > schema.maxLength : false

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
          placeholder={schema.placeholder}
          maxLength={schema.maxLength ? schema.maxLength + 10 : undefined} // Allow slight overflow for UX
          className={cn(
            isOverLimit && 'border-destructive focus-visible:ring-destructive',
            schema.maxLength && 'pr-16' // Space for character count
          )}
          aria-invalid={!!displayError}
          aria-describedby={
            displayError
              ? `${id}-error`
              : schema.description
                ? `${id}-description`
                : undefined
          }
        />

        {/* Character count */}
        {schema.maxLength && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <CharacterCount count={charCount} maxLength={schema.maxLength} />
          </div>
        )}
      </div>
    </PrimitiveEditor>
  )
}
