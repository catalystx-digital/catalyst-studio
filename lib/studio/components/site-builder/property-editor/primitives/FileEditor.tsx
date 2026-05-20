'use client'

/**
 * FileEditor - File from media library editor
 *
 * Features:
 * - Media library picker (filtered by file type)
 * - File type icon based on extension
 * - File size display
 * - Storage format: { mediaId: string, url: string, filename: string, size?: number }
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  Upload,
  X,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { MediaFileValue } from '../schema/types'

interface FileAsset {
  id: string
  url: string
  filename: string
  size?: number
  mimeType?: string
}

interface FileEditorProps extends EditorProps<MediaFileValue | null> {
  /** Available file assets */
  assets?: FileAsset[]
  /** Callback to open media library picker */
  onOpenMediaLibrary?: () => Promise<FileAsset | null>
  /** Callback to upload new file */
  onUpload?: (file: File) => Promise<FileAsset>
  /** Accepted file types (e.g., '.pdf,.doc,.docx') */
  accept?: string
}

// Get icon based on file extension/mime type
function getFileIcon(filename: string, mimeType?: string): React.ElementType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mime = mimeType?.toLowerCase() ?? ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return FileImage
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
    return FileVideo
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return FileAudio
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return FileText
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return FileSpreadsheet
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return FileArchive
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml'].includes(ext)) {
    return FileCode
  }

  return File
}

// Format file size
function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileEditor({
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
  accept,
}: FileEditorProps) {
  const id = useFieldId(schema, providedId)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isPickerOpen, setIsPickerOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Handle file selection from library
  const handleFileSelect = React.useCallback(
    (asset: FileAsset) => {
      onChange({
        mediaId: asset.id,
        url: asset.url,
        filename: asset.filename,
        size: asset.size,
        mimeType: asset.mimeType,
      })
      setIsPickerOpen(false)
    },
    [onChange]
  )

  // Handle open media library
  const handleOpenLibrary = React.useCallback(async () => {
    if (onOpenMediaLibrary) {
      const asset = await onOpenMediaLibrary()
      if (asset) {
        handleFileSelect(asset)
      }
    } else {
      setIsPickerOpen(true)
    }
  }, [onOpenMediaLibrary, handleFileSelect])

  // Handle file upload
  const handleUpload = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onUpload) return

      setIsUploading(true)
      try {
        const asset = await onUpload(file)
        handleFileSelect(asset)
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
    [onUpload, handleFileSelect]
  )

  // Handle clear
  const handleClear = React.useCallback(() => {
    onChange(null)
  }, [onChange])

  // Handle download
  const handleDownload = React.useCallback(() => {
    if (value?.url) {
      window.open(value.url, '_blank')
    }
  }, [value?.url])

  const FileIcon = value ? getFileIcon(value.filename, value.mimeType) : File

  return (
    <PrimitiveEditor
      schema={schema}
      error={error}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-3">
        {/* File display or placeholder */}
        {value ? (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
            <FileIcon className="h-10 w-10 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{value.filename}</p>
              {value.size && (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(value.size)}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                disabled={isDisabled}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              {!schema.required && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={isDisabled}
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'p-6 bg-muted rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/80 transition-colors',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !isDisabled && handleOpenLibrary()}
          >
            <File className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Click to select a file
            </p>
          </div>
        )}

        {/* Action buttons */}
        {!value && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenLibrary}
              disabled={isDisabled}
              className="flex-1"
            >
              <File className="h-4 w-4 mr-2" />
              Media Library
            </Button>
            {onUpload && (
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
                  accept={accept}
                  onChange={handleUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        {/* Change button when file is selected */}
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenLibrary}
            disabled={isDisabled}
            className="w-full"
          >
            Change File
          </Button>
        )}

        {/* Simple file picker dialog */}
        {assets && (
          <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Select File</DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {assets.map((asset) => {
                  const Icon = getFileIcon(asset.filename, asset.mimeType)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleFileSelect(asset)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors text-left',
                        value?.mediaId === asset.id && 'bg-muted'
                      )}
                    >
                      <Icon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{asset.filename}</p>
                        {asset.size && (
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(asset.size)}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PrimitiveEditor>
  )
}
