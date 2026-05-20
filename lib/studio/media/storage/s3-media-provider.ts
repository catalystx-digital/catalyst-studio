import { Readable } from 'node:stream'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl as presignGetObjectUrl } from '@aws-sdk/s3-request-presigner'

import { monitoring } from '@/lib/monitoring'

import type {
  MediaDeleteObjectInput,
  MediaGetObjectInput,
  MediaGetObjectOutput,
  MediaGetPublicUrlInput,
  MediaGetSignedUrlInput,
  MediaPutObjectInput,
  MediaPutObjectOutput,
  MediaStorageProvider
} from './media-storage-provider'

export interface S3MediaProviderConfig {
  bucket: string
  region: string
  endpoint?: string
  forcePathStyle?: boolean
  publicBaseUrl?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}

export class S3MediaProvider implements MediaStorageProvider {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly region: string
  private readonly publicBaseUrl?: string

  constructor(config: S3MediaProviderConfig) {
    this.bucket = config.bucket
    this.region = config.region
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, '')
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials
    })
  }

  private log(action: string, metadata?: Record<string, unknown>): void {
    console.log(`[S3MediaProvider] ${action}`, metadata || '')
  }

  private toReadable(body: any): Readable {
    if (body instanceof Readable) {
      return body
    }
    if (body && typeof body.pipe === 'function') {
      return body as Readable
    }
    if (body && typeof body.getReader === 'function') {
      const reader = body.getReader()
      return Readable.from((async function* () {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) yield value
        }
      })())
    }
    throw new Error('Unsupported S3 body type')
  }

  async put(input: MediaPutObjectInput): Promise<MediaPutObjectOutput> {
    const start = performance.now()
    const metadata = { ...(input.metadata ?? {}) }
    if (input.checksum) {
      metadata.checksum = input.checksum
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: Object.keys(metadata).length ? metadata : undefined
    })

    const response = await this.client.send(command)
    const duration = performance.now() - start
    const etag = response.ETag?.replace(/"/g, '')
    monitoring.logPerformance('media.storage.s3.put', duration, {
      key: input.key,
      etag
    })
    this.log('Stored media object', { key: input.key, etag, durationMs: Math.round(duration) })

    return { etag }
  }

  async get(input: MediaGetObjectInput): Promise<MediaGetObjectOutput> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: input.key })
    const response = await this.client.send(command)
    const stream = this.toReadable(response.Body)

    this.log('Fetched media object', { key: input.key, bytes: response.ContentLength })

    return {
      stream,
      contentType: response.ContentType,
      contentLength: response.ContentLength ?? undefined,
      metadata: response.Metadata ?? undefined
    }
  }

  async delete(input: MediaDeleteObjectInput): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: input.key })
    await this.client.send(command)
    this.log('Deleted media object', { key: input.key })
  }

  async getPublicUrl(input: MediaGetPublicUrlInput): Promise<string | null> {
    if (this.publicBaseUrl) {
      const encodedKey = input.key.split('/').map(encodeURIComponent).join('/')
      return `${this.publicBaseUrl}/${encodedKey}`
    }
    const encodedKey = input.key.split('/').map(encodeURIComponent).join('/')
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`
  }

  async getSignedUrl(input: MediaGetSignedUrlInput): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: input.key })
    return presignGetObjectUrl(this.client, command, { expiresIn: input.expiresInSeconds ?? 900 })
  }
}
