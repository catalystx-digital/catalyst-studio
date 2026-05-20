'use client'

/**
 * ContentReferenceEditor - Content item reference picker
 *
 * Features:
 * - Content browser by type
 * - Search content by title
 * - Show content preview/summary
 * - Storage format: { mediaId: string, mediaType: 'image' | 'video' | 'file' }
 *   (aligned with MediaReference schema from ValueObjectRegistry)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { MediaReferenceValue } from '../schema/types'

interface ContentItem {
  id: string
  type: string
  title: string
  summary?: string
  thumbnail?: string
  updatedAt?: string
  /** URL for the media asset */
  url?: string
  /** Alt text for images */
  alt?: string
}

interface ContentType {
  type: string
  label: string
  icon?: string
}

interface ContentReferenceEditorProps extends EditorProps<MediaReferenceValue | null> {
  /** Available content items */
  contentItems?: ContentItem[]
  /** Available content types */
  contentTypes?: ContentType[]
  /** Callback to load content items (optionally filtered by type) */
  onLoadContent?: (type?: string) => Promise<ContentItem[]>
  /** Website ID for API-based content loading */
  websiteId?: string
}

export function ContentReferenceEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  contentItems: providedItems,
  contentTypes,
  onLoadContent,
  websiteId,
}: ContentReferenceEditorProps) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)
  const [contentItems, setContentItems] = React.useState<ContentItem[]>(
    providedItems ?? []
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<string | undefined>(
    value?.mediaType
  )

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Get allowed types from schema or use all available
  const allowedTypes = schema.allowedTypes ?? contentTypes?.map((t) => t.type) ?? []

  // Filter content types to only allowed ones
  const filteredTypes = contentTypes?.filter(
    (t) => allowedTypes.length === 0 || allowedTypes.includes(t.type)
  )

  // Update items when provided externally
  React.useEffect(() => {
    if (providedItems) {
      setContentItems(providedItems)
    }
  }, [providedItems])

  // Load content when popover opens or type changes
  React.useEffect(() => {
    async function loadContent() {
      if (!open) return

      // Use provided callback or default API fetch
      const loader = onLoadContent ?? (websiteId ? defaultApiLoader : null)

      if (loader) {
        setIsLoading(true)
        try {
          const items = await loader(selectedType)
          setContentItems(items)
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load content:', err)
          }
        } finally {
          setIsLoading(false)
        }
      }
    }

    // Default API loader when websiteId is available
    async function defaultApiLoader(type?: string): Promise<ContentItem[]> {
      if (!websiteId) return []

      // Get allowed types from schema
      const allowedTypes = schema.allowedTypes ?? []
      const allowedType = allowedTypes.length === 1 ? allowedTypes[0] : type

      const url = `/api/studio/site-builder/media?websiteId=${websiteId}${
        allowedType ? `&type=${allowedType}` : ''
      }`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`)
      }

      const { media } = await response.json()
      return media || []
    }

    loadContent()
  }, [open, selectedType, onLoadContent, websiteId, schema.allowedTypes])

  // Filter items by selected type
  const filteredItems = React.useMemo(() => {
    if (!selectedType) return contentItems
    return contentItems.filter((item) => item.type === selectedType)
  }, [contentItems, selectedType])

  // Find selected content by mediaId
  const selectedContent = React.useMemo(() => {
    if (!value?.mediaId) return null
    return contentItems.find((item) => item.id === value.mediaId)
  }, [value, contentItems])

  // Handle content selection
  const handleSelect = React.useCallback(
    (contentId: string) => {
      const item = contentItems.find((i) => i.id === contentId)
      if (item) {
        // Infer mediaType from item.type, defaulting to 'image'
        const inferMediaType = (type: string): 'image' | 'video' | 'file' => {
          if (type === 'video') return 'video'
          if (type === 'file' || type === 'document' || type === 'pdf') return 'file'
          return 'image' // default
        }

        // New format per ValueObjectRegistry MediaReference schema:
        // { mediaId: string, mediaType: 'image' | 'video' | 'file', url?: string, alt?: string }
        onChange({
          mediaId: item.id,
          mediaType: inferMediaType(item.type),
          // Include optional metadata if available
          ...(item.url && { url: item.url }),
          ...(item.thumbnail && { url: item.thumbnail }), // fallback to thumbnail as url
          ...(item.alt && { alt: item.alt }),
        })
        setOpen(false)
      }
    },
    [contentItems, onChange]
  )

  // Handle type filter change
  const handleTypeChange = React.useCallback((type: string) => {
    setSelectedType(type === 'all' ? undefined : type)
  }, [])

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
      <div className="space-y-2">
        {/* Type filter (if multiple types allowed) */}
        {filteredTypes && filteredTypes.length > 1 && (
          <Select
            value={selectedType ?? 'all'}
            onValueChange={handleTypeChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {filteredTypes.map((type) => (
                <SelectItem key={type.type} value={type.type}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Content picker */}
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
                !selectedContent && 'text-muted-foreground',
                error && 'border-destructive'
              )}
            >
              {selectedContent ? (
                <div className="flex items-center gap-2 truncate">
                  {selectedContent.thumbnail ? (
                    <img
                      src={selectedContent.thumbnail}
                      alt=""
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <FileText className="h-4 w-4 flex-shrink-0" />
                  )}
                  <div className="flex flex-col items-start truncate">
                    <span className="truncate">{selectedContent.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {selectedContent.type}
                    </span>
                  </div>
                </div>
              ) : (
                <span>{schema.placeholder ?? 'Select content...'}</span>
              )}
              <div className="flex items-center gap-1 ml-2">
                {selectedContent && !schema.required && (
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
              <CommandInput placeholder="Search content..." />
              <CommandList>
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No content found.</CommandEmpty>
                    <CommandGroup>
                      {filteredItems.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.title} ${item.type}`}
                          onSelect={() => handleSelect(item.id)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              value?.mediaId === item.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="h-8 w-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{item.title}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="capitalize">{item.type}</span>
                                {item.updatedAt && (
                                  <>
                                    <span>•</span>
                                    <span>{item.updatedAt}</span>
                                  </>
                                )}
                              </div>
                              {item.summary && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.summary}
                                </p>
                              )}
                            </div>
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
      </div>
    </PrimitiveEditor>
  )
}
