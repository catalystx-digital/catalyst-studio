'use client'

/**
 * PhoneEditor - Phone number input editor
 *
 * Features:
 * - Phone number formatting
 * - tel: link generation
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Phone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'

// Basic phone validation - allows various formats
const PHONE_PATTERN = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/

function isValidPhone(phone: string): boolean {
  if (!phone) return true
  return PHONE_PATTERN.test(phone)
}

function formatPhone(phone: string): string {
  // Remove all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned
}

export function PhoneEditor({
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

  // Handle blur - validate and format
  const handleBlur = React.useCallback(() => {
    flush()

    if (localValue && !isValidPhone(localValue)) {
      setLocalError('Please enter a valid phone number')
    } else if (localValue) {
      // Format on blur
      const formatted = formatPhone(localValue)
      if (formatted !== localValue) {
        setLocalValue(formatted)
        onChange(formatted)
      }
    }
  }, [flush, localValue, onChange])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="tel"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isDisabled}
          placeholder={schema.placeholder ?? '+1 (555) 123-4567'}
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
