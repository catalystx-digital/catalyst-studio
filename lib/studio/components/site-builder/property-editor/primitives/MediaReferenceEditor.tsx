'use client'

/**
 * MediaReferenceEditor - Media asset reference picker
 *
 * Features:
 * - Media library browser
 * - Filter by media type
 * - Storage format: { mediaId: string, mediaType: 'image' | 'video' | 'file' }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronsUpDown,
  ImageIcon,
  Video,
  File,
  X,
} from 'lucide-react'
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

type MediaType = 'image' | 'video' | 'file'

interface MediaAsset {
  id: string
  type: MediaType
  filename: string
  url: string
  thumbnail?: string
  size?: number
}

interface MediaReferenceEditorProps extends EditorProps<MediaReferenceValue | null> {
  /** Available media assets */
  assets?: MediaAsset[]
  /** Callback to load media assets (optionally filtered by type) */
  onLoadAssets?: (type?: MediaType) => Promise<MediaAsset[]>
}

const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; icon: React.ElementType }> = {
  image: { label: 'Images', icon: ImageIcon },
  video: { label: 'Videos', icon: Video },
  file: { label: 'Files', icon: File },
}

function getMediaIcon(type: MediaType): React.ElementType {
  return MEDIA_TYPE_CONFIG[type]?.icon ?? File
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaReferenceEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  assets: providedAssets,
  onLoadAssets,
}: MediaReferenceEditorProps) {
  const id = useFieldId(schema, providedId)
  const [open, setOpen] = React.useState(false)
  const [assets, setAssets] = React.useState<MediaAsset[]>(providedAssets ?? [])
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<MediaType | undefined>(
    value?.mediaType
  )

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Update assets when provided externally
  React.useEffect(() => {
    if (providedAssets) {
      setAssets(providedAssets)
    }
  }, [providedAssets])

  // Load assets when popover opens or type changes
  React.useEffect(() => {
    async function loadAssets() {
      if (open && onLoadAssets) {
        setIsLoading(true)
        try {
          const loaded = await onLoadAssets(selectedType)
          setAssets(loaded)
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load assets:', err)
          }
        } finally {
          setIsLoading(false)
        }
      }
    }
    loadAssets()
  }, [open, selectedType, onLoadAssets])

  // Filter assets by selected type
  const filteredAssets = React.useMemo(() => {
    if (!selectedType) return assets
    return assets.filter((asset) => asset.type === selectedType)
  }, [assets, selectedType])

  // Find selected asset
  const selectedAsset = value
    ? assets.find((asset) => asset.id === value.mediaId)
    : null

  // Handle asset selection
  const handleSelect = React.useCallback(
    (assetId: string) => {
      const asset = assets.find((a) => a.id === assetId)
      if (asset) {
        onChange({
          mediaId: asset.id,
          mediaType: asset.type,
        })
        setOpen(false)
      }
    },
    [assets, onChange]
  )

  // Handle type filter change
  const handleTypeChange = React.useCallback((type: string) => {
    setSelectedType(type === 'all' ? undefined : (type as MediaType))
  }, [])

  // Handle clear
  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange(null)
    },
    [onChange]
  )

  const SelectedIcon = selectedAsset
    ? getMediaIcon(selectedAsset.type)
    : File

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-2">
        {/* Type filter */}
        <Select
          value={selectedType ?? 'all'}
          onValueChange={handleTypeChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Media</SelectItem>
            {Object.entries(MEDIA_TYPE_CONFIG).map(([type, config]) => {
              const Icon = config.icon
              return (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Media picker */}
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
                !selectedAsset && 'text-muted-foreground',
                error && 'border-destructive'
              )}
            >
              {selectedAsset ? (
                <div className="flex items-center gap-2 truncate">
                  {selectedAsset.thumbnail ? (
                    <img
                      src={selectedAsset.thumbnail}
                      alt=""
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <SelectedIcon className="h-4 w-4 flex-shrink-0" />
                  )}
                  <div className="flex flex-col items-start truncate">
                    <span className="truncate">{selectedAsset.filename}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {selectedAsset.type}
                      {selectedAsset.size && ` • ${formatFileSize(selectedAsset.size)}`}
                    </span>
                  </div>
                </div>
              ) : (
                <span>{schema.placeholder ?? 'Select media...'}</span>
              )}
              <div className="flex items-center gap-1 ml-2">
                {selectedAsset && !schema.required && (
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
              <CommandInput placeholder="Search media..." />
              <CommandList>
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No media found.</CommandEmpty>
                    <CommandGroup>
                      {filteredAssets.map((asset) => {
                        const Icon = getMediaIcon(asset.type)
                        return (
                          <CommandItem
                            key={asset.id}
                            value={`${asset.filename} ${asset.type}`}
                            onSelect={() => handleSelect(asset.id)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                value?.mediaId === asset.id
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {asset.thumbnail ? (
                                <img
                                  src={asset.thumbnail}
                                  alt=""
                                  className="h-8 w-8 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{asset.filename}</span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {asset.type}
                                  {asset.size && ` • ${formatFileSize(asset.size)}`}
                                </span>
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
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
