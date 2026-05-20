'use client'

/**
 * ImageEditor - Image from media library editor
 *
 * Features:
 * - Media library picker integration
 * - Image preview with dimensions
 * - Alt text field (inline)
 * - Storage format: { mediaId: string, url: string, alt?: string, width?: number, height?: number }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ImageIcon, Upload, X, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { MediaImageValue } from '../schema/types'

interface MediaAsset {
  id: string
  url: string
  filename: string
  width?: number
  height?: number
  alt?: string
}

interface ImageEditorProps extends EditorProps<MediaImageValue | null> {
  /** Available media assets */
  assets?: MediaAsset[]
  /** Callback to open media library picker */
  onOpenMediaLibrary?: () => Promise<MediaAsset | null>
  /** Callback to upload new image */
  onUpload?: (file: File) => Promise<MediaAsset>
}

export function ImageEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  assets,
  onOpenMediaLibrary,
  onUpload,
}: ImageEditorProps) {
  const id = useFieldId(schema, providedId)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isPickerOpen, setIsPickerOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [localAlt, setLocalAlt] = React.useState(value?.alt ?? '')

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync alt text with value
  React.useEffect(() => {
    setLocalAlt(value?.alt ?? '')
  }, [value?.alt])

  // Handle media library selection
  const handleMediaSelect = React.useCallback(
    async (asset: MediaAsset) => {
      onChange({
        mediaId: asset.id,
        url: asset.url,
        alt: asset.alt ?? localAlt,
        width: asset.width,
        height: asset.height,
      })
      setIsPickerOpen(false)
    },
    [onChange, localAlt]
  )

  // Handle open media library
  const handleOpenLibrary = React.useCallback(async () => {
    if (onOpenMediaLibrary) {
      const asset = await onOpenMediaLibrary()
      if (asset) {
        handleMediaSelect(asset)
      }
    } else {
      setIsPickerOpen(true)
    }
  }, [onOpenMediaLibrary, handleMediaSelect])

  // Handle file upload
  const handleUpload = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onUpload) return

      setIsUploading(true)
      try {
        const asset = await onUpload(file)
        handleMediaSelect(asset)
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Upload failed:', err)
        }
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [onUpload, handleMediaSelect]
  )

  // Handle alt text change
  const handleAltChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAlt = e.target.value
      setLocalAlt(newAlt)
      if (value) {
        onChange({
          ...value,
          alt: newAlt,
        })
      }
    },
    [value, onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(() => {
    onChange(null)
    setLocalAlt('')
  }, [onChange])

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-3">
        {/* Image preview or placeholder */}
        {value?.url ? (
          <div className="relative group">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
              <img
                src={value.url}
                alt={value.alt ?? ''}
                className="w-full h-full object-cover"
              />
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenLibrary}
                  disabled={isDisabled}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Change
                </Button>
                {!schema.required && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleClear}
                    disabled={isDisabled}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Dimensions */}
            {(value.width || value.height) && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {value.width} × {value.height}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'aspect-video bg-muted rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/80 transition-colors',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !isDisabled && handleOpenLibrary()}
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to select an image
            </p>
            {onUpload && (
              <p className="text-xs text-muted-foreground">
                or drag and drop
              </p>
            )}
          </div>
        )}

        {/* Upload button */}
        {onUpload && !value && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenLibrary}
              disabled={isDisabled}
              className="flex-1"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Media Library
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled || isUploading}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Alt text input */}
        {value?.url && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-alt`} className="text-xs">
              Alt Text
            </Label>
            <Input
              id={`${id}-alt`}
              type="text"
              value={localAlt}
              onChange={handleAltChange}
              disabled={isDisabled}
              placeholder="Describe the image..."
              className="text-sm"
            />
          </div>
        )}

        {/* Simple media picker dialog */}
        {assets && (
          <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select Image</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleMediaSelect(asset)}
                    className={cn(
                      'aspect-square rounded-lg overflow-hidden border-2 hover:border-primary transition-colors',
                      value?.mediaId === asset.id
                        ? 'border-primary'
                        : 'border-transparent'
                    )}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt ?? asset.filename}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PrimitiveEditor>
  )
}
