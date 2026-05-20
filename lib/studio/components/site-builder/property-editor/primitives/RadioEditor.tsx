'use client'

/**
 * RadioEditor - Radio button group editor
 *
 * Features:
 * - Vertical or horizontal layout
 * - Option descriptions
 * - Visual feedback on selection
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

const HORIZONTAL_THRESHOLD = 4 // Show horizontal when 4 or fewer options

export function RadioEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | number | null>) {
  const id = useFieldId(schema, providedId)

  const options = schema.options ?? []
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Determine layout based on option count and descriptions
  const hasDescriptions = options.some((opt) => opt.description)
  const isHorizontal = !hasDescriptions && options.length <= HORIZONTAL_THRESHOLD

  // Handle selection
  const handleChange = React.useCallback(
    (selectedValue: string) => {
      // Find the option to get the correct typed value
      const option = options.find(
        (opt) => String(opt.value) === selectedValue
      )
      if (option) {
        onChange(option.value)
      }
    },
    [options, onChange]
  )

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <RadioGroup
        id={id}
        value={value !== null && value !== undefined ? String(value) : undefined}
        onValueChange={handleChange}
        disabled={isDisabled}
        className={cn(
          isHorizontal ? 'flex flex-wrap gap-4' : 'space-y-2'
        )}
        aria-invalid={!!error}
      >
        {options.map((option) => {
          const optionId = `${id}-${String(option.value)}`
          const isSelected = String(value) === String(option.value)

          return (
            <div
              key={String(option.value)}
              className={cn(
                'flex items-start space-x-3',
                isHorizontal && 'items-center space-x-2',
                option.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RadioGroupItem
                value={String(option.value)}
                id={optionId}
                disabled={option.disabled}
                className={cn(
                  isSelected && 'border-primary'
                )}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={optionId}
                  className={cn(
                    'text-sm font-normal cursor-pointer',
                    option.disabled && 'cursor-not-allowed',
                    isSelected && 'font-medium'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {option.icon && (
                      <span className="text-muted-foreground">{option.icon}</span>
                    )}
                    <span>{option.label}</span>
                  </div>
                </Label>
                {option.description && (
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </RadioGroup>
    </PrimitiveEditor>
  )
}
