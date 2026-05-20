'use client'

/**
 * VideoEditor - Video from media library or embed URL editor
 *
 * Features:
 * - Media library or embed URL
 * - Poster image selection
 * - Storage format: { mediaId?: string, url: string, poster?: string }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Video, Upload, X, Link2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PrimitiveEditor, useDebouncedCallback, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { MediaVideoValue } from '../schema/types'

interface VideoAsset {
  id: string
  url: string
  filename: string
  poster?: string
}

interface ImageAsset {
  id: string
  url: string
  filename: string
}

interface VideoEditorProps extends EditorProps<MediaVideoValue | null> {
  /** Available video assets */
  videoAssets?: VideoAsset[]
  /** Available image assets for poster */
  imageAssets?: ImageAsset[]
  /** Callback to open media library for video */
  onOpenVideoLibrary?: () => Promise<VideoAsset | null>
  /** Callback to open media library for poster image */
  onOpenImageLibrary?: () => Promise<ImageAsset | null>
  /** Callback to upload new video */
  onUploadVideo?: (file: File) => Promise<VideoAsset>
}

function isValidVideoUrl(url: string): boolean {
  if (!url) return true
  try {
    new URL(url)
    // Check for video extensions or embed URLs
    return (
      /\.(mp4|webm|mov|avi|ogg)(\?.*)?$/i.test(url) ||
      /youtube\.com|youtu\.be|vimeo\.com|wistia\.com/i.test(url)
    )
  } catch {
    return false
  }
}

export function VideoEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
  videoAssets,
  imageAssets,
  onOpenVideoLibrary,
  onOpenImageLibrary,
  onUploadVideo,
}: VideoEditorProps) {
  const id = useFieldId(schema, providedId)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [mode, setMode] = React.useState<'library' | 'url'>(
    value?.mediaId ? 'library' : 'url'
  )
  const [isVideoPickerOpen, setIsVideoPickerOpen] = React.useState(false)
  const [isPosterPickerOpen, setIsPosterPickerOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [localUrl, setLocalUrl] = React.useState(value?.url ?? '')
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalUrl(value?.url ?? '')
    setMode(value?.mediaId ? 'library' : 'url')
  }, [value])

  // Sync with external error
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Debounced onChange for URL
  const [debouncedUrlChange, flushUrl] = useDebouncedCallback(
    (url: string) => {
      onChange(url ? { url, poster: value?.poster } : null)
    },
    500
  )

  // Handle video selection from library
  const handleVideoSelect = React.useCallback(
    (asset: VideoAsset) => {
      onChange({
        mediaId: asset.id,
        url: asset.url,
        poster: asset.poster ?? value?.poster,
      })
      setIsVideoPickerOpen(false)
      setMode('library')
    },
    [onChange, value?.poster]
  )

  // Handle URL change
  const handleUrlChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newUrl = e.target.value
      setLocalUrl(newUrl)

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

    if (localUrl && !isValidVideoUrl(localUrl)) {
      setLocalError('Please enter a valid video URL')
    }
  }, [flushUrl, localUrl])

  // Handle open video library
  const handleOpenVideoLibrary = React.useCallback(async () => {
    if (onOpenVideoLibrary) {
      const asset = await onOpenVideoLibrary()
      if (asset) {
        handleVideoSelect(asset)
      }
    } else {
      setIsVideoPickerOpen(true)
    }
  }, [onOpenVideoLibrary, handleVideoSelect])

  // Handle video upload
  const handleUpload = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onUploadVideo) return

      setIsUploading(true)
      try {
        const asset = await onUploadVideo(file)
        handleVideoSelect(asset)
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
    [onUploadVideo, handleVideoSelect]
  )

  // Handle poster selection
  const handlePosterSelect = React.useCallback(
    async (asset?: ImageAsset) => {
      if (value) {
        onChange({
          ...value,
          poster: asset?.url,
        })
      }
      setIsPosterPickerOpen(false)
    },
    [value, onChange]
  )

  // Handle open poster library
  const handleOpenPosterLibrary = React.useCallback(async () => {
    if (onOpenImageLibrary) {
      const asset = await onOpenImageLibrary()
      if (asset) {
        handlePosterSelect(asset)
      }
    } else {
      setIsPosterPickerOpen(true)
    }
  }, [onOpenImageLibrary, handlePosterSelect])

  // Handle clear
  const handleClear = React.useCallback(() => {
    onChange(null)
    setLocalUrl('')
  }, [onChange])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'library' | 'url')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library" disabled={isDisabled}>
              <Video className="h-4 w-4 mr-2" />
              Media Library
            </TabsTrigger>
            <TabsTrigger value="url" disabled={isDisabled}>
              <Link2 className="h-4 w-4 mr-2" />
              Embed URL
            </TabsTrigger>
          </TabsList>

          {/* Media Library Tab */}
          <TabsContent value="library" className="mt-3 space-y-3">
            {value?.mediaId ? (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={value.url}
                  poster={value.poster}
                  controls
                  className="w-full h-full"
                />
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
            ) : (
              <div
                className={cn(
                  'aspect-video bg-muted rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/80 transition-colors',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => !isDisabled && handleOpenVideoLibrary()}
              >
                <Video className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a video
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenVideoLibrary}
                disabled={isDisabled}
                className="flex-1"
              >
                {value?.mediaId ? 'Change Video' : 'Select Video'}
              </Button>
              {onUploadVideo && (
                <>
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
                    accept="video/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>
          </TabsContent>

          {/* Embed URL Tab */}
          <TabsContent value="url" className="mt-3 space-y-3">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id={id}
                type="url"
                value={localUrl}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                disabled={isDisabled}
                placeholder="https://youtube.com/watch?v=..."
                className={cn(
                  'pl-10',
                  displayError && 'border-destructive'
                )}
              />
            </div>

            {localUrl && !displayError && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={localUrl}
                  poster={value?.poster}
                  controls
                  className="w-full h-full"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Poster image selection */}
        {value?.url && (
          <div className="space-y-2">
            <Label className="text-xs">Poster Image (optional)</Label>
            {value.poster ? (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
                <img
                  src={value.poster}
                  alt="Video poster"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handlePosterSelect(undefined)}
                  disabled={isDisabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenPosterLibrary}
                disabled={isDisabled}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Select Poster Image
              </Button>
            )}
          </div>
        )}

        {/* Video picker dialog */}
        {videoAssets && (
          <Dialog open={isVideoPickerOpen} onOpenChange={setIsVideoPickerOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select Video</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {videoAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handleVideoSelect(asset)}
                    className={cn(
                      'aspect-video rounded-lg overflow-hidden border-2 hover:border-primary transition-colors bg-black',
                      value?.mediaId === asset.id
                        ? 'border-primary'
                        : 'border-transparent'
                    )}
                  >
                    {asset.poster ? (
                      <img
                        src={asset.poster}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Poster picker dialog */}
        {imageAssets && (
          <Dialog open={isPosterPickerOpen} onOpenChange={setIsPosterPickerOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select Poster Image</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
                {imageAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => handlePosterSelect(asset)}
                    className={cn(
                      'aspect-square rounded-lg overflow-hidden border-2 hover:border-primary transition-colors',
                      value?.poster === asset.url
                        ? 'border-primary'
                        : 'border-transparent'
                    )}
                  >
                    <img
                      src={asset.url}
                      alt={asset.filename}
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
