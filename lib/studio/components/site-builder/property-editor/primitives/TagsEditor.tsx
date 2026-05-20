'use client'

/**
 * TagsEditor - Free-form tags editor
 *
 * Features:
 * - Free-form input with suggestions
 * - Comma or Enter to add tag
 * - Remove tag on click or backspace
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandEmpty,
  CommandGroup,
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

export function TagsEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string[]>) {
  const id = useFieldId(schema, providedId)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const tags = value ?? []
  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)
  const maxItems = schema.maxItems
  const isMaxReached = maxItems !== undefined && tags.length >= maxItems

  // Get suggestions from schema options (if provided)
  const suggestions = schema.options?.map((opt) => String(opt.value)) ?? []

  // Filter suggestions based on input and already selected tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion)
  )

  // Add a tag
  const addTag = React.useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase()
      if (!trimmed) return
      if (tags.includes(trimmed)) return
      if (isMaxReached) return

      onChange([...tags, trimmed])
      setInputValue('')
      setOpen(false)
    },
    [tags, onChange, isMaxReached]
  )

  // Remove a tag
  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove))
    },
    [tags, onChange]
  )

  // Handle input change
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value

      // Check for comma - add tag
      if (val.includes(',')) {
        const parts = val.split(',')
        parts.forEach((part, index) => {
          if (index < parts.length - 1 && part.trim()) {
            addTag(part)
          }
        })
        setInputValue(parts[parts.length - 1])
      } else {
        setInputValue(val)
        setOpen(val.length > 0 && filteredSuggestions.length > 0)
      }
    },
    [addTag, filteredSuggestions.length]
  )

  // Handle key down
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        // Remove last tag on backspace when input is empty
        removeTag(tags[tags.length - 1])
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    },
    [inputValue, tags, addTag, removeTag]
  )

  // Handle suggestion select
  const handleSuggestionSelect = React.useCallback(
    (suggestion: string) => {
      addTag(suggestion)
      inputRef.current?.focus()
    },
    [addTag]
  )

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-2">
        {/* Tags display */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => !isDisabled && removeTag(tag)}
              >
                {tag}
                {!isDisabled && (
                  <X className="h-3 w-3 hover:text-destructive" />
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Input with suggestions */}
        <Popover open={open && !isDisabled} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="relative">
              <Input
                ref={inputRef}
                id={id}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => inputValue && setOpen(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => {
                    if (inputValue.trim()) {
                      addTag(inputValue)
                    }
                    setOpen(false)
                  }, 150)
                }}
                disabled={isDisabled || isMaxReached}
                placeholder={
                  isMaxReached
                    ? 'Maximum tags reached'
                    : schema.placeholder ?? 'Add tags...'
                }
                className={cn(error && 'border-destructive')}
                aria-invalid={!!error}
              />
            </div>
          </PopoverTrigger>

          {filteredSuggestions.length > 0 && (
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command>
                <CommandList>
                  <CommandEmpty>No suggestions</CommandEmpty>
                  <CommandGroup>
                    {filteredSuggestions.slice(0, 10).map((suggestion) => (
                      <CommandItem
                        key={suggestion}
                        value={suggestion}
                        onSelect={() => handleSuggestionSelect(suggestion)}
                      >
                        {suggestion}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {/* Hints */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Press Enter or comma to add</span>
          {maxItems && (
            <span>
              {tags.length}/{maxItems}
            </span>
          )}
        </div>
      </div>
    </PrimitiveEditor>
  )
}
