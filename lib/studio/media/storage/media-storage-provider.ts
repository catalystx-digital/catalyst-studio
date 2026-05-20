import type { Readable } from 'node:stream'

export interface MediaPutObjectInput {
  key: string
  contentType: string
  body: Readable | Buffer | Uint8Array
  checksum?: string
  metadata?: Record<string, string>
}

export interface MediaPutObjectOutput {
  etag?: string
  size?: number
}

export interface MediaGetObjectInput {
  key: string
}

export interface MediaGetObjectOutput {
  stream: Readable
  contentType?: string
  contentLength?: number
  metadata?: Record<string, string>
}

export interface MediaDeleteObjectInput {
  key: string
}

export interface MediaGetPublicUrlInput {
  key: string
}

export interface MediaGetSignedUrlInput {
  key: string
  expiresInSeconds?: number
}

export interface MediaStorageProvider {
  put(input: MediaPutObjectInput): Promise<MediaPutObjectOutput>
  get(input: MediaGetObjectInput): Promise<MediaGetObjectOutput>
  delete(input: MediaDeleteObjectInput): Promise<void>
  getPublicUrl(input: MediaGetPublicUrlInput): Promise<string | null>
  getSignedUrl(input: MediaGetSignedUrlInput): Promise<string>
}
