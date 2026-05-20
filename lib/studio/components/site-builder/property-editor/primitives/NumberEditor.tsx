'use client'

/**
 * NumberEditor - Numeric input editor
 *
 * Features:
 * - Input type="number" with min/max/step
 * - Optional slider mode for bounded ranges
 * - Unit suffix display (e.g., "px", "ms", "%")
 * - Integer-only mode (no decimals)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

export function NumberEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<number | null>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState<string>(
    value !== null && value !== undefined ? String(value) : ''
  )
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  // Determine if we should show as slider
  const showSlider =
    schema.slider &&
    schema.min !== undefined &&
    schema.max !== undefined

  const isInteger = schema.type === 'integer'
  const step = schema.step ?? (isInteger ? 1 : 0.1)

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(value !== null && value !== undefined ? String(value) : '')
  }, [value])

  // Sync with external error changes
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Parse and validate value
  const parseValue = React.useCallback(
    (input: string): number | null => {
      if (input === '' || input === '-') return null

      const parsed = isInteger ? parseInt(input, 10) : parseFloat(input)

      if (isNaN(parsed)) return null

      return parsed
    },
    [isInteger]
  )

  // Validate against constraints
  const validate = React.useCallback(
    (num: number | null): string | undefined => {
      if (num === null) {
        if (schema.required) {
          return 'This field is required'
        }
        return undefined
      }

      if (schema.min !== undefined && num < schema.min) {
        return `Value must be at least ${schema.min}`
      }

      if (schema.max !== undefined && num > schema.max) {
        return `Value must be at most ${schema.max}`
      }

      if (isInteger && !Number.isInteger(num)) {
        return 'Value must be a whole number'
      }

      return undefined
    },
    [schema.min, schema.max, schema.required, isInteger]
  )

  // Handle input change
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setLocalValue(inputValue)

      // Clear error when typing
      if (localError && !error) {
        setLocalError(undefined)
      }

      const parsed = parseValue(inputValue)
      const validationError = validate(parsed)

      if (!validationError) {
        onChange(parsed)
      }
    },
    [parseValue, validate, onChange, localError, error]
  )

  // Handle blur - validate
  const handleBlur = React.useCallback(() => {
    const parsed = parseValue(localValue)
    const validationError = validate(parsed)

    if (validationError) {
      setLocalError(validationError)
    } else {
      // Normalize the display value
      if (parsed !== null) {
        setLocalValue(String(parsed))
      }
      onChange(parsed)
    }
  }, [localValue, parseValue, validate, onChange])

  // Handle slider change
  const handleSliderChange = React.useCallback(
    (values: number[]) => {
      const newValue = values[0]
      setLocalValue(String(newValue))
      setLocalError(undefined)
      onChange(newValue)
    },
    [onChange]
  )

  const displayError = localError || error
  const numericValue = parseValue(localValue)

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      {showSlider ? (
        // Slider mode
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Slider
              id={id}
              value={[numericValue ?? schema.min ?? 0]}
              onValueChange={handleSliderChange}
              min={schema.min}
              max={schema.max}
              step={step}
              disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
              className="flex-1"
            />
            <div className="flex items-center min-w-[60px]">
              <Input
                type="number"
                value={localValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
                min={schema.min}
                max={schema.max}
                step={step}
                className={cn(
                  'h-8 w-16 text-center',
                  schema.unit && 'pr-6'
                )}
              />
              {schema.unit && (
                <span className="ml-1 text-sm text-muted-foreground">
                  {schema.unit}
                </span>
              )}
            </div>
          </div>

          {/* Min/Max labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{schema.min}</span>
            <span>{schema.max}</span>
          </div>
        </div>
      ) : (
        // Standard input mode
        <div className="relative">
          <Input
            id={id}
            type="number"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
            placeholder={schema.placeholder}
            min={schema.min}
            max={schema.max}
            step={step}
            className={cn(
              displayError && 'border-destructive focus-visible:ring-destructive',
              schema.unit && 'pr-12'
            )}
            aria-invalid={!!displayError}
          />

          {/* Unit suffix */}
          {schema.unit && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              {schema.unit}
            </div>
          )}
        </div>
      )}
    </PrimitiveEditor>
  )
}
