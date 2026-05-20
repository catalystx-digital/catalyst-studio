'use client'

/**
 * MultiSelectEditor - Multiple selection editor
 *
 * Features:
 * - Checkbox list or pill-based UI
 * - Select all / clear all
 * - Max selection limit option
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

const PILL_THRESHOLD = 6 // Show as pills/popover when more than 6 options

export function MultiSelectEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<(string | number)[]>) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)

  const options = schema.options ?? []
  const selectedValues = value ?? []
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const showPillMode = options.length > PILL_THRESHOLD
  const maxItems = schema.maxItems

  // Check if max selection reached
  const isMaxReached = maxItems !== undefined && selectedValues.length >= maxItems

  // Toggle option selection
  const toggleOption = React.useCallback(
    (optionValue: string | number) => {
      const stringValue = String(optionValue)
      const isSelected = selectedValues.some((v) => String(v) === stringValue)

      if (isSelected) {
        onChange(selectedValues.filter((v) => String(v) !== stringValue))
      } else if (!isMaxReached) {
        // Find the option to get the correct typed value
        const option = options.find((opt) => String(opt.value) === stringValue)
        if (option) {
          onChange([...selectedValues, option.value])
        }
      }
    },
    [selectedValues, onChange, options, isMaxReached]
  )

  // Select all
  const handleSelectAll = React.useCallback(() => {
    const allValues = options
      .filter((opt) => !opt.disabled)
      .map((opt) => opt.value)
    const limited = maxItems ? allValues.slice(0, maxItems) : allValues
    onChange(limited)
  }, [options, onChange, maxItems])

  // Clear all
  const handleClearAll = React.useCallback(() => {
    onChange([])
  }, [onChange])

  // Remove single item
  const handleRemove = React.useCallback(
    (optionValue: string | number) => {
      onChange(selectedValues.filter((v) => String(v) !== String(optionValue)))
    },
    [selectedValues, onChange]
  )

  if (showPillMode) {
    // Pill-based popover mode for many options
    return (
      <PrimitiveEditor
        schema={schema}
        error={error}
        className={className}
        htmlFor={id}
      >
        <div className="space-y-2">
          {/* Selected values as pills */}
          {selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((val) => {
                const option = options.find(
                  (opt) => String(opt.value) === String(val)
                )
                return (
                  <Badge
                    key={String(val)}
                    variant="secondary"
                    className="gap-1"
                  >
                    {option?.label ?? String(val)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => handleRemove(val)}
                    />
                  </Badge>
                )
              })}
            </div>
          )}

          {/* Add more popover */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id={id}
                variant="outline"
                size="sm"
                disabled={isDisabled || isMaxReached}
                className={cn(
                  'w-full justify-start font-normal',
                  error && 'border-destructive'
                )}
              >
                {selectedValues.length === 0
                  ? schema.placeholder ?? 'Select options...'
                  : `${selectedValues.length} selected`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search..." />
                <CommandList>
                  <CommandEmpty>No options found.</CommandEmpty>
                  <CommandGroup>
                    {/* Select All / Clear All */}
                    <div className="flex justify-between px-2 py-1 border-b">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={isMaxReached}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                      >
                        Clear All
                      </Button>
                    </div>

                    {options.map((option) => {
                      const isSelected = selectedValues.some(
                        (v) => String(v) === String(option.value)
                      )
                      return (
                        <CommandItem
                          key={String(option.value)}
                          value={option.label}
                          onSelect={() => toggleOption(option.value)}
                          disabled={option.disabled || (isMaxReached && !isSelected)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            {option.description && (
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Max items hint */}
          {maxItems && (
            <p className="text-xs text-muted-foreground">
              {selectedValues.length}/{maxItems} selected
            </p>
          )}
        </div>
      </PrimitiveEditor>
    )
  }

  // Checkbox list mode for few options
  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-2">
        {/* Select All / Clear All for more than 3 options */}
        {options.length > 3 && (
          <div className="flex gap-2 pb-1 border-b">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={isDisabled || isMaxReached}
              className="h-7 px-2 text-xs"
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={isDisabled}
              className="h-7 px-2 text-xs"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Checkbox list */}
        <div className="space-y-2">
          {options.map((option) => {
            const optionId = `${id}-${String(option.value)}`
            const isSelected = selectedValues.some(
              (v) => String(v) === String(option.value)
            )
            const isOptionDisabled =
              option.disabled || (isMaxReached && !isSelected)

            return (
              <div
                key={String(option.value)}
                className={cn(
                  'flex items-start space-x-3',
                  isOptionDisabled && 'opacity-50'
                )}
              >
                <Checkbox
                  id={optionId}
                  checked={isSelected}
                  onCheckedChange={() => toggleOption(option.value)}
                  disabled={isDisabled || isOptionDisabled}
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor={optionId}
                    className={cn(
                      'text-sm font-normal cursor-pointer',
                      (isDisabled || isOptionDisabled) && 'cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon && (
                        <span className="text-muted-foreground">
                          {option.icon}
                        </span>
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
        </div>

        {/* Max items hint */}
        {maxItems && (
          <p className="text-xs text-muted-foreground">
            {selectedValues.length}/{maxItems} selected
          </p>
        )}
      </div>
    </PrimitiveEditor>
  )
}
