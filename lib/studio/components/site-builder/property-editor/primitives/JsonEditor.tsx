'use client'

/**
 * JsonEditor - Raw JSON editor
 *
 * Features:
 * - JSON syntax validation
 * - Pretty-print formatting
 * - Error highlighting
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, Copy, Wand2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseJson(text: string): { value: unknown; error?: string } {
  if (!text.trim()) {
    return { value: null }
  }
  try {
    return { value: JSON.parse(text) }
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export function JsonEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<unknown>) {
  const id = useFieldId(schema, providedId)
  const [localValue, setLocalValue] = React.useState(formatJson(value))
  const [localError, setLocalError] = React.useState<string | undefined>(error)
  const [copied, setCopied] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const rows = schema.rows ?? 10

  // Sync with external value
  React.useEffect(() => {
    setLocalValue(formatJson(value))
  }, [value])

  // Sync with external error
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Debounced onChange
  const [debouncedOnChange] = useDebouncedCallback((text: string) => {
    const { value: parsed, error: parseError } = parseJson(text)
    if (parseError) {
      setLocalError(parseError)
    } else {
      setLocalError(undefined)
      onChange(parsed)
    }
  }, 500)

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  // Handle format/prettify
  const handleFormat = React.useCallback(() => {
    const { value: parsed, error: parseError } = parseJson(localValue)
    if (!parseError && parsed !== null) {
      const formatted = formatJson(parsed)
      setLocalValue(formatted)
      onChange(parsed)
    }
  }, [localValue, onChange])

  // Handle copy
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(localValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [localValue])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            disabled={isDisabled}
            title="Format JSON"
            className="h-7 px-2"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            Format
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={isDisabled}
            title="Copy JSON"
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {/* Editor */}
        <Textarea
          id={id}
          value={localValue}
          onChange={handleChange}
          disabled={isDisabled}
          rows={rows}
          placeholder={schema.placeholder ?? '{\n  \n}'}
          className={cn(
            'font-mono text-sm resize-none',
            displayError && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!displayError}
        />
      </div>
    </PrimitiveEditor>
  )
}
