'use client'

/**
 * EmailEditor - Email address input editor
 *
 * Features:
 * - Email validation
 * - mailto: link generation
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  if (!email) return true
  return EMAIL_PATTERN.test(email)
}

export function EmailEditor({
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

  // Handle blur - validate
  const handleBlur = React.useCallback(() => {
    flush()

    if (localValue && !isValidEmail(localValue)) {
      setLocalError('Please enter a valid email address')
    }
  }, [flush, localValue])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="email"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isDisabled}
          placeholder={schema.placeholder ?? 'email@example.com'}
          className={cn(
            'pl-10',
            displayError && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-invalid={!!displayError}
        />
      </div>
    </PrimitiveEditor>
  )
}
