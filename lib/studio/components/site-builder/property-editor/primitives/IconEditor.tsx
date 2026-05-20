'use client'

/**
 * IconEditor - Icon identifier picker
 *
 * Features:
 * - Icon library browser
 * - Search by icon name
 * - Preview selected icon
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'

// Get all Lucide icon names
const ICON_NAMES = Object.keys(LucideIcons).filter(
  (name) =>
    name !== 'default' &&
    name !== 'createLucideIcon' &&
    name !== 'icons' &&
    typeof (LucideIcons as Record<string, unknown>)[name] === 'function'
)

export function IconEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<string | null>) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Filter icons by search
  const filteredIcons = React.useMemo(() => {
    if (!search) return ICON_NAMES.slice(0, 100) // Limit initial display
    const searchLower = search.toLowerCase()
    return ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(searchLower)
    ).slice(0, 100)
  }, [search])

  // Get icon component
  const getIcon = React.useCallback((name: string) => {
    return (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]
  }, [])

  // Handle icon selection
  const handleSelect = React.useCallback(
    (iconName: string) => {
      onChange(iconName)
      setOpen(false)
      setSearch('')
    },
    [onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
    },
    [onChange]
  )

  const SelectedIcon = value ? getIcon(value) : null

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
              !value && 'text-muted-foreground',
              error && 'border-destructive'
            )}
          >
            <div className="flex items-center gap-2">
              {SelectedIcon ? (
                <>
                  <SelectedIcon className="h-4 w-4" />
                  <span>{value}</span>
                </>
              ) : (
                <span>{schema.placeholder ?? 'Select icon...'}</span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              {value && !schema.required && (
                <X
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="grid grid-cols-6 gap-1 p-2">
              {filteredIcons.map((iconName) => {
                const Icon = getIcon(iconName)
                if (!Icon) return null
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => handleSelect(iconName)}
                    className={cn(
                      'flex items-center justify-center p-2 rounded hover:bg-muted transition-colors',
                      value === iconName && 'bg-primary/10 text-primary'
                    )}
                    title={iconName}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No icons found
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </PrimitiveEditor>
  )
}
