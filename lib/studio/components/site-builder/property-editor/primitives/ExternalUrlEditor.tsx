'use client'

/**
 * ExternalUrlEditor - External URL input editor
 *
 * Features:
 * - URL validation (https://, http://, mailto:, tel:)
 * - Open in new tab preview button
 * - Protocol auto-prefix
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ExternalLink, Link2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

const URL_PATTERN = /^(https?:\/\/|mailto:|tel:)/i

function isValidUrl(url: string): boolean {
  if (!url) return true
  try {
    // Add protocol if missing for validation
    const urlWithProtocol = URL_PATTERN.test(url) ? url : `https://${url}`
    new URL(urlWithProtocol)
    return true
  } catch {
    return false
  }
}

function normalizeUrl(url: string): string {
  if (!url) return ''
  // Don't add protocol if it's already a valid protocol
  if (URL_PATTERN.test(url)) return url
  // Add https:// for bare domains
  return `https://${url}`
}

export function ExternalUrlEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(value ?? '')
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  // Sync with external error
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Debounced onChange
  const [debouncedOnChange, flush] = useDebouncedCallback(onChange, 300)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)

      // Clear error when typing
      if (localError && !error) {
        setLocalError(undefined)
      }

      debouncedOnChange(newValue)
    },
    [debouncedOnChange, localError, error]
  )

  // Handle blur - validate and normalize
  const handleBlur = React.useCallback(() => {
    flush()

    if (localValue && !isValidUrl(localValue)) {
      setLocalError('Please enter a valid URL')
    } else if (localValue) {
      // Normalize URL on blur
      const normalized = normalizeUrl(localValue)
      if (normalized !== localValue) {
        setLocalValue(normalized)
        onChange(normalized)
      }
    }
  }, [flush, localValue, onChange])

  // Open URL in new tab
  const handleOpenUrl = React.useCallback(() => {
    if (localValue) {
      const url = normalizeUrl(localValue)
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [localValue])

  const displayError = localError || error
  const hasValidUrl = localValue && isValidUrl(localValue)

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id={id}
            type="url"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={schema.placeholder ?? 'https://example.com'}
            className={cn(
              'pl-10',
              displayError && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!displayError}
          />
        </div>

        {/* Preview button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleOpenUrl}
          disabled={isDisabled || !hasValidUrl}
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </PrimitiveEditor>
  )
}
