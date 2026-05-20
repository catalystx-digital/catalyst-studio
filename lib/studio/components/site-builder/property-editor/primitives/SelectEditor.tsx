'use client'

/**
 * SelectEditor - Dropdown selection editor
 *
 * Features:
 * - Dropdown with search for > 5 options
 * - Option icons and descriptions
 * - Clear button for optional fields
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { SelectOption } from '../schema/types'

const SEARCH_THRESHOLD = 5 // Show search when more than 5 options

export function SelectEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | number | null>) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)

  const options = schema.options ?? []
  const showSearch = options.length > SEARCH_THRESHOLD
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Find selected option
  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value)
  )

  // Handle selection
  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      // Find the option to get the correct typed value
      const option = options.find(
        (opt) => String(opt.value) === selectedValue
      )
      if (option) {
        onChange(option.value)
        setOpen(false)
      }
    },
    [options, onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
    },
    [onChange]
  )

  if (showSearch) {
    // Searchable combobox for many options
    return (
      <PrimitiveEditor
        schema={schema}
        error={error}
        className={className}
        htmlFor={id}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={!!error}
              disabled={isDisabled}
              className={cn(
                'w-full justify-between font-normal',
                !selectedOption && 'text-muted-foreground',
                error && 'border-destructive'
              )}
            >
              <span className="truncate">
                {selectedOption ? selectedOption.label : schema.placeholder ?? 'Select...'}
              </span>
              <div className="flex items-center gap-1 ml-2">
                {selectedOption && !schema.required && (
                  <X
                    className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                    onClick={handleClear}
                  />
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search..." />
              <CommandList>
                <CommandEmpty>No option found.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={String(option.value)}
                      value={option.label}
                      onSelect={() => handleSelect(String(option.value))}
                      disabled={option.disabled}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          String(value) === String(option.value)
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {option.icon && (
                            <span className="text-muted-foreground">
                              {option.icon}
                            </span>
                          )}
                          <span>{option.label}</span>
                        </div>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </PrimitiveEditor>
    )
  }

  // Simple select for few options
  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="relative">
        <Select
          value={value !== null && value !== undefined ? String(value) : undefined}
          onValueChange={handleSelect}
          disabled={isDisabled}
        >
          <SelectTrigger
            id={id}
            className={cn(
              error && 'border-destructive',
              selectedOption && !schema.required && 'pr-10'
            )}
            aria-invalid={!!error}
          >
            <SelectValue placeholder={schema.placeholder ?? 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={String(option.value)}
                value={String(option.value)}
                disabled={option.disabled}
              >
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <span className="text-muted-foreground">{option.icon}</span>
                  )}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear button */}
        {selectedOption && !schema.required && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
            disabled={isDisabled}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </PrimitiveEditor>
  )
}
