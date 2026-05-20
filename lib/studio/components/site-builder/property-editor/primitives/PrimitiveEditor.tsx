'use client'

/**
 * PrimitiveEditor - Base Wrapper Component
 *
 * Provides consistent layout for all primitive editors including:
 * - Label with required indicator
 * - Error message display
 * - Description/help text
 * - Width handling
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { getFieldLabel } from '../schema/types'
import type { FieldSchema } from '../schema/types'
import type { PrimitiveEditorWrapperProps } from './types'

export function PrimitiveEditor({
  schema,
  error,
  required,
  className,
  children,
  htmlFor,
}: PrimitiveEditorWrapperProps) {
  const label = getFieldLabel(schema)
  const isRequired = required ?? schema.required

  // Determine width class
  const widthClass =
    schema.width === 'half'
      ? 'w-1/2'
      : schema.width === 'third'
        ? 'w-1/3'
        : 'w-full'

  return (
    <div
      className={cn(
        'space-y-1.5',
        widthClass,
        schema.className,
        className
      )}
    >
      {/* Label */}
      {label && (
        <Label
          htmlFor={htmlFor}
          className={cn(
            'text-sm font-medium text-foreground',
            error && 'text-destructive'
          )}
        >
          {label}
          {isRequired && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}

      {/* Editor content */}
      {children}

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Description */}
      {schema.description && !error && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
    </div>
  )
}

/**
 * Character count display component
 */
export function CharacterCount({
  count,
  maxLength,
  showWarning = true,
  warningThreshold = 90,
}: {
  count: number
  maxLength?: number
  showWarning?: boolean
  warningThreshold?: number
}) {
  if (!maxLength) return null

  const percentage = (count / maxLength) * 100
  const isWarning = showWarning && percentage >= warningThreshold
  const isOver = count > maxLength

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        isOver
          ? 'text-destructive font-medium'
          : isWarning
            ? 'text-yellow-600 dark:text-yellow-500'
            : 'text-muted-foreground'
      )}
    >
      {count}/{maxLength}
    </span>
  )
}

/**
 * Hook for debounced value updates
 */
export function useDebouncedCallback<T>(
  callback: (value: T) => void,
  delay: number = 300
): [(value: T) => void, () => void] {
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const pendingValueRef = React.useRef<T | null>(null)

  const debouncedCallback = React.useCallback(
    (value: T) => {
      pendingValueRef.current = value

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(value)
        pendingValueRef.current = null
      }, delay)
    },
    [callback, delay]
  )

  const flush = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (pendingValueRef.current !== null) {
      callback(pendingValueRef.current)
      pendingValueRef.current = null
    }
  }, [callback])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return [debouncedCallback, flush]
}

/**
 * Hook for generating unique IDs for form elements
 */
export function useFieldId(schema: FieldSchema, providedId?: string): string {
  const generatedId = React.useId()
  return providedId ?? `field-${schema.name}-${generatedId}`
}
