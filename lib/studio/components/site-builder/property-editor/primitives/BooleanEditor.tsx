'use client'

/**
 * BooleanEditor - Toggle switch/checkbox editor
 *
 * Features:
 * - Toggle switch (default) for better UX
 * - Optional checkbox mode via schema option
 * - Clear true/false labels
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getFieldLabel } from '../schema/types'
import { useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

export function BooleanEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<boolean>) {
  const id = useFieldId(schema, providedId)
  const label = getFieldLabel(schema)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const currentValue = value ?? false

  // Handle toggle change
  const handleChange = React.useCallback(
    (checked: boolean) => {
      onChange(checked)
    },
    [onChange]
  )

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2',
        schema.width === 'half' && 'w-1/2',
        schema.width === 'third' && 'w-1/3',
        schema.className,
        className
      )}
    >
      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium cursor-pointer',
            error && 'text-destructive',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {label}
          {schema.required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {schema.description && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Switch
        id={id}
        checked={currentValue}
        onCheckedChange={handleChange}
        disabled={isDisabled}
        aria-invalid={!!error}
      />
    </div>
  )
}

/**
 * CheckboxEditor - Alternative checkbox style boolean editor
 * Use when you want a traditional checkbox instead of a switch
 */
export function CheckboxEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<boolean>) {
  const id = useFieldId(schema, providedId)
  const label = getFieldLabel(schema)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const currentValue = value ?? false

  // Handle toggle change
  const handleChange = React.useCallback(
    (checked: boolean | 'indeterminate') => {
      if (checked !== 'indeterminate') {
        onChange(checked)
      }
    },
    [onChange]
  )

  return (
    <div
      className={cn(
        'flex items-start space-x-3 py-2',
        schema.width === 'half' && 'w-1/2',
        schema.width === 'third' && 'w-1/3',
        schema.className,
        className
      )}
    >
      <Checkbox
        id={id}
        checked={currentValue}
        onCheckedChange={handleChange}
        disabled={isDisabled}
        aria-invalid={!!error}
        className="mt-0.5"
      />

      <div className="space-y-0.5">
        <Label
          htmlFor={id}
          className={cn(
            'text-sm font-medium cursor-pointer',
            error && 'text-destructive',
            isDisabled && 'cursor-not-allowed opacity-50'
          )}
        >
          {label}
          {schema.required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {schema.description && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
