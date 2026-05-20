import path from 'node:path'

import { MediaStorageProvider } from './media-storage-provider'
import { FileMediaProvider } from './file-media-provider'
import { S3MediaProvider } from './s3-media-provider'

export type MediaStorageBackend = 'FILE' | 'S3'

let cachedProvider: MediaStorageProvider | null = null
let cachedBackend: MediaStorageBackend | null = null

function getBackend(): MediaStorageBackend {
  const raw = (process.env.STUDIO_MEDIA_STORAGE_PROVIDER || 'FILE').toUpperCase()
  if (raw === 'S3') return 'S3'
  return 'FILE'
}

function createProvider(): { backend: MediaStorageBackend; provider: MediaStorageProvider } {
  const backend = getBackend()
  if (backend === 'S3') {
    const bucket = process.env.STUDIO_MEDIA_STORAGE_S3_BUCKET
    const region = process.env.STUDIO_MEDIA_STORAGE_S3_REGION
    if (!bucket || !region) {
      throw new Error('S3 media storage requires STUDIO_MEDIA_STORAGE_S3_BUCKET and STUDIO_MEDIA_STORAGE_S3_REGION')
    }
    const provider = new S3MediaProvider({
      bucket,
      region,
      endpoint: process.env.STUDIO_MEDIA_STORAGE_S3_ENDPOINT,
      forcePathStyle: process.env.STUDIO_MEDIA_STORAGE_S3_FORCE_PATH_STYLE === 'true',
      publicBaseUrl: process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL,
      credentials: process.env.STUDIO_MEDIA_STORAGE_S3_ACCESS_KEY_ID && process.env.STUDIO_MEDIA_STORAGE_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.STUDIO_MEDIA_STORAGE_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.STUDIO_MEDIA_STORAGE_S3_SECRET_ACCESS_KEY,
            sessionToken: process.env.STUDIO_MEDIA_STORAGE_S3_SESSION_TOKEN
          }
        : undefined
    })
    return { backend, provider }
  }

  const rootDirectory = process.env.STUDIO_MEDIA_STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STUDIO_MEDIA_STORAGE_LOCAL_ROOT)
    : path.join(process.cwd(), 'media-storage')

  const provider = new FileMediaProvider({
    rootDirectory,
    publicBaseUrl: process.env.STUDIO_MEDIA_STORAGE_LOCAL_PUBLIC_URL
  })

  return { backend, provider }
}

export function getMediaStorageProvider(): { backend: MediaStorageBackend; provider: MediaStorageProvider } {
  if (!cachedProvider || !cachedBackend) {
    const { backend, provider } = createProvider()
    cachedProvider = provider
    cachedBackend = backend
  }
  return { backend: cachedBackend!, provider: cachedProvider! }
}

export function resetMediaStorageProvider(): void {
  cachedBackend = null
  cachedProvider = null
}
