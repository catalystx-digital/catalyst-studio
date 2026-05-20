'use client'

/**
 * SlugEditor - URL-safe identifier editor
 *
 * Features:
 * - Auto-generate from another field (configurable)
 * - Validate URL-safe characters
 * - Show preview of full URL path
 * - Manual override capability
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RefreshCw, Lock, Unlock } from 'lucide-react'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

/**
 * Convert a string to a URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Validate that a string is a valid slug
 */
function isValidSlug(text: string): boolean {
  if (!text) return true // Empty is valid (might be optional)
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)
}

interface SlugEditorProps extends EditorProps<string> {
  /** Source value to generate slug from (usually from parent form data) */
  sourceValue?: string
  /** Base path to show in preview (e.g., "/blog/") */
  basePath?: string
}

export function SlugEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  sourceValue,
  basePath = '/',
}: SlugEditorProps) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(value ?? '')
  const [isLocked, setIsLocked] = React.useState(!!value) // Lock if has existing value
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  // Sync with external value changes
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Sync with external error changes
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Auto-generate from source when unlocked
  React.useEffect(() => {
    if (!isLocked && sourceValue && !localValue) {
      const newSlug = slugify(sourceValue)
      setLocalValue(newSlug)
      onChange(newSlug)
    }
  }, [sourceValue, isLocked, localValue, onChange])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value
      // Auto-slugify as user types
      const newValue = slugify(rawValue)
      setLocalValue(newValue)

      // Clear validation error when typing
      if (localError && !error) {
        setLocalError(undefined)
      }

      debouncedOnChange(newValue)
    },
    [debouncedOnChange, localError, error]
  )

  // Handle blur - flush and validate
  const handleBlur = React.useCallback(() => {
    flush()

    if (localValue && !isValidSlug(localValue)) {
      setLocalError('Invalid slug format. Use lowercase letters, numbers, and hyphens only.')
    }
  }, [flush, localValue])

  // Regenerate from source
  const handleRegenerate = React.useCallback(() => {
    if (sourceValue) {
      const newSlug = slugify(sourceValue)
      setLocalValue(newSlug)
      onChange(newSlug)
      setLocalError(undefined)
    }
  }, [sourceValue, onChange])

  // Toggle lock state
  const toggleLock = React.useCallback(() => {
    setIsLocked((prev) => !prev)
  }, [])

  const displayError = localError || error
  const fullPath = `${basePath}${localValue || '[slug]'}`

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={id}
              type="text"
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)}
              placeholder={schema.placeholder ?? 'enter-slug-here'}
              className={cn(
                'pr-10',
                displayError && 'border-destructive focus-visible:ring-destructive'
              )}
              aria-invalid={!!displayError}
            />

            {/* Lock/Unlock indicator */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={toggleLock}
              disabled={disabled}
              title={isLocked ? 'Unlock to enable auto-generation' : 'Lock to prevent auto-generation'}
            >
              {isLocked ? (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* Regenerate button */}
          {sourceValue && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRegenerate}
              disabled={disabled}
              title="Regenerate from title"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* URL Preview */}
        <div className="flex items-center text-xs text-muted-foreground">
          <span className="truncate">
            Preview: <code className="bg-muted px-1 py-0.5 rounded">{fullPath}</code>
          </span>
        </div>
      </div>
    </PrimitiveEditor>
  )
}
