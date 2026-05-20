import { createReadStream, createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

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

export interface FileMediaProviderConfig {
  rootDirectory: string
  publicBaseUrl?: string
}

export class FileMediaProvider implements MediaStorageProvider {
  private readonly rootDirectory: string
  private readonly publicBaseUrl?: string

  constructor(config: FileMediaProviderConfig) {
    this.rootDirectory = config.rootDirectory
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, '')
  }

  private resolveKey(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '')
    return path.join(this.rootDirectory, normalized)
  }

  private async ensureParentDirectory(fullPath: string): Promise<void> {
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
  }

  private log(action: string, metadata?: Record<string, unknown>): void {
    console.log(`[FileMediaProvider] ${action}`, metadata || '')
  }

  async put(input: MediaPutObjectInput): Promise<MediaPutObjectOutput> {
    const fullPath = this.resolveKey(input.key)
    const start = performance.now()
    await this.ensureParentDirectory(fullPath)

    const body = input.body instanceof Readable ? input.body : Readable.from(input.body)

    await pipeline(body, createWriteStream(fullPath))
    const stat = await fs.stat(fullPath)

    const duration = performance.now() - start
    monitoring.logPerformance('media.storage.file.put', duration, {
      key: input.key,
      bytes: stat.size
    })
    this.log('Stored media object', { key: input.key, bytes: stat.size, durationMs: Math.round(duration) })

    return { size: stat.size }
  }

  async get(input: MediaGetObjectInput): Promise<MediaGetObjectOutput> {
    const fullPath = this.resolveKey(input.key)
    const stat = await fs.stat(fullPath)
    const stream = createReadStream(fullPath)

    this.log('Read media object', { key: input.key, bytes: stat.size })

    return {
      stream,
      contentLength: stat.size
    }
  }

  async delete(input: MediaDeleteObjectInput): Promise<void> {
    const fullPath = this.resolveKey(input.key)
    try {
      await fs.unlink(fullPath)
      this.log('Deleted media object', { key: input.key })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.log('Delete skipped; file missing', { key: input.key })
        return
      }
      monitoring.logError('media.storage.file.delete', error as Error, { key: input.key })
      throw error
    }
  }

  async getPublicUrl(input: MediaGetPublicUrlInput): Promise<string | null> {
    if (!this.publicBaseUrl) {
      return null
    }
    const encodedKey = input.key.split('/').map(encodeURIComponent).join('/')
    return `${this.publicBaseUrl}/${encodedKey}`
  }

  async getSignedUrl(input: MediaGetSignedUrlInput): Promise<string> {
    const publicUrl = await this.getPublicUrl({ key: input.key })
    if (!publicUrl) {
      throw new Error('FileMediaProvider requires publicBaseUrl for signed URLs')
    }
    return publicUrl
  }
}
