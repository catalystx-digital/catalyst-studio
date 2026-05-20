'use client'

/**
 * ExternalImageEditor - External image URL editor
 *
 * Features:
 * - URL input with preview
 * - Alt text field
 * - Storage format: { url: string, alt?: string }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ImageIcon, Link2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  PrimitiveEditor,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { ExternalImageValue } from '../schema/types'

function isValidImageUrl(url: string): boolean {
  if (!url) return true
  try {
    new URL(url)
    // Check for common image extensions or data URLs
    return (
      /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(url) ||
      url.startsWith('data:image/')
    )
  } catch {
    return false
  }
}

export function ExternalImageEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<ExternalImageValue | null>) {
  const id = useFieldId(schema, providedId)
  const [localUrl, setLocalUrl] = React.useState(value?.url ?? '')
  const [localAlt, setLocalAlt] = React.useState(value?.alt ?? '')
  const [localError, setLocalError] = React.useState<string | undefined>(error)
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalUrl(value?.url ?? '')
    setLocalAlt(value?.alt ?? '')
  }, [value])

  // Sync with external error
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Reset image state when URL changes
  React.useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [localUrl])

  // Debounced onChange for URL
  const [debouncedUrlChange, flushUrl] = useDebouncedCallback(
    (url: string) => {
      onChange(url ? { url, alt: localAlt } : null)
    },
    500
  )

  // Handle URL change
  const handleUrlChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newUrl = e.target.value
      setLocalUrl(newUrl)

      // Clear error when typing
      if (localError && !error) {
        setLocalError(undefined)
      }

      debouncedUrlChange(newUrl)
    },
    [debouncedUrlChange, localError, error]
  )

  // Handle URL blur - validate
  const handleUrlBlur = React.useCallback(() => {
    flushUrl()

    if (localUrl && !isValidImageUrl(localUrl)) {
      setLocalError('Please enter a valid image URL')
    }
  }, [flushUrl, localUrl])

  // Handle alt text change
  const handleAltChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAlt = e.target.value
      setLocalAlt(newAlt)
      if (localUrl) {
        onChange({ url: localUrl, alt: newAlt })
      }
    },
    [localUrl, onChange]
  )

  // Handle clear
  const handleClear = React.useCallback(() => {
    setLocalUrl('')
    setLocalAlt('')
    onChange(null)
  }, [onChange])

  // Handle image load
  const handleImageLoad = React.useCallback(() => {
    setImageLoaded(true)
    setImageError(false)
  }, [])

  // Handle image error
  const handleImageError = React.useCallback(() => {
    setImageLoaded(false)
    setImageError(true)
  }, [])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-3">
        {/* URL input */}
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id={id}
            type="url"
            value={localUrl}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            disabled={isDisabled}
            placeholder={schema.placeholder ?? 'https://example.com/image.jpg'}
            className={cn(
              'pl-10',
              displayError && 'border-destructive focus-visible:ring-destructive'
            )}
            aria-invalid={!!displayError}
          />
        </div>

        {/* Image preview */}
        {localUrl && (
          <div className="relative">
            <div
              className={cn(
                'aspect-video bg-muted rounded-lg overflow-hidden border',
                imageError && 'flex items-center justify-center'
              )}
            >
              {imageError ? (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Failed to load image</p>
                </div>
              ) : (
                <img
                  src={localUrl}
                  alt={localAlt}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className={cn(
                    'w-full h-full object-cover',
                    !imageLoaded && 'opacity-0'
                  )}
                />
              )}
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading...
                  </div>
                </div>
              )}
            </div>

            {/* Clear button */}
            {!schema.required && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={handleClear}
                disabled={isDisabled}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Alt text input */}
        {localUrl && (
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
      </div>
    </PrimitiveEditor>
  )
}
