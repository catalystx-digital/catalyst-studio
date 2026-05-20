'use client'

/**
 * InternalLinkEditor - Internal page link editor
 *
 * Features:
 * - Page picker from sitemap tree
 * - Search pages by title
 * - Show selected page path
 * - Fetches pages from API when websiteId is provided
 * - Storage format: { type: 'internal', pageId: string, path: string, label?: string }
 *   (aligned with PageReferenceSchema from ValueObjectRegistry)
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, FileText, X } from 'lucide-react'
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
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { InternalLinkValue } from '../schema/types'

interface PageOption {
  id: string
  title: string
  path: string
  depth?: number
}

interface InternalLinkEditorProps extends EditorProps<InternalLinkValue | null> {
  /** Pages available for selection */
  pages?: PageOption[]
  /** Callback to load pages (if not provided via pages prop) */
  onLoadPages?: (search?: string) => Promise<PageOption[]>
}

export function InternalLinkEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  pages: providedPages,
  onLoadPages,
  websiteId,
}: InternalLinkEditorProps) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)
  const [pages, setPages] = React.useState<PageOption[]>(providedPages ?? [])
  const [isLoading, setIsLoading] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Default API fetch when websiteId is available and no custom onLoadPages
  const defaultLoadPages = React.useCallback(async (search = ''): Promise<PageOption[]> => {
    if (!websiteId) return []

    const response = await fetch(
      `/api/studio/site-builder/pages?websiteId=${websiteId}&search=${encodeURIComponent(search)}`
    )
    if (!response.ok) {
      throw new Error('Failed to fetch pages')
    }
    const data = await response.json()
    return data.pages || []
  }, [websiteId])

  const loadPages = onLoadPages ?? (websiteId ? defaultLoadPages : undefined)

  // Load pages on mount or when popover opens
  React.useEffect(() => {
    if (providedPages) {
      setPages(providedPages)
    }
  }, [providedPages])

  React.useEffect(() => {
    async function fetchPages() {
      if (open && loadPages && pages.length === 0) {
        setIsLoading(true)
        try {
          const loadedPages = await loadPages()
          setPages(loadedPages)
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load pages:', err)
          }
        } finally {
          setIsLoading(false)
        }
      }
    }
    fetchPages()
  }, [open, loadPages, pages.length])

  // Find selected page
  const selectedPage = value
    ? pages.find((page) => page.id === value.pageId)
    : null

  // Handle page selection
  const handleSelect = React.useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (page) {
        // Output schema-aligned format: { type: 'internal', pageId, path, label? }
        onChange({
          type: 'internal',
          pageId: page.id,
          path: page.path,
          // Include title as label for convenience
          label: page.title,
        })
        setOpen(false)
      }
    },
    [pages, onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
    },
    [onChange]
  )

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
              !selectedPage && 'text-muted-foreground',
              error && 'border-destructive'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 flex-shrink-0" />
              {selectedPage ? (
                <div className="flex flex-col items-start truncate">
                  <span className="truncate">{selectedPage.title}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedPage.path}
                  </span>
                </div>
              ) : (
                <span>{schema.placeholder ?? 'Select a page...'}</span>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2">
              {selectedPage && !schema.required && (
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
            <CommandInput placeholder="Search pages..." />
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading pages...
                </div>
              ) : (
                <>
                  <CommandEmpty>No pages found.</CommandEmpty>
                  <CommandGroup>
                    {pages.map((page) => (
                      <CommandItem
                        key={page.id}
                        value={`${page.title} ${page.path}`}
                        onSelect={() => handleSelect(page.id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value?.pageId === page.id
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <div
                          className="flex flex-col"
                          style={{ paddingLeft: (page.depth ?? 0) * 12 }}
                        >
                          <span>{page.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {page.path}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </PrimitiveEditor>
  )
}
