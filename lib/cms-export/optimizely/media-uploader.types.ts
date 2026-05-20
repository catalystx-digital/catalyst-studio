/**
 * Type definitions for Optimizely Media Uploader
 *
 * These types are extracted to a separate file to allow importing
 * in client-side code without pulling in Node.js dependencies.
 */

/**
 * Result of uploading media assets to Optimizely
 */
export interface MediaUploadResult {
  /** Mapping from local WebsiteMedia.id to Optimizely asset ID */
  mediaIdMapping: Map<string, string>
  /** Count of successfully uploaded assets */
  uploadedCount: number
  /** Count of assets skipped (duplicates) */
  skippedCount: number
  /** Count of failed uploads */
  failedCount: number
  /** Details of any failures */
  errors: Array<{ mediaId: string; error: string }>
}

/**
 * Options for media upload
 */
export interface MediaUploadOptions {
  /** Optimizely container ID for media assets */
  mediaContainerId?: string
  /** Progress callback for reporting upload progress */
  onProgress?: (current: number, total: number, message: string) => void
}
