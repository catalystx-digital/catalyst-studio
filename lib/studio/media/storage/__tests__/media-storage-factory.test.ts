import path from 'node:path'

import { getMediaStorageProvider, resetMediaStorageProvider } from '../media-storage-factory'
import { FileMediaProvider } from '../file-media-provider'
import { S3MediaProvider } from '../s3-media-provider'

describe('media storage factory', () => {
  const ORIGINAL_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    resetMediaStorageProvider()
  })

  it('returns file provider by default', () => {
    const { backend, provider } = getMediaStorageProvider()
    expect(backend).toBe('FILE')
    expect(provider).toBeInstanceOf(FileMediaProvider)
  })

  it('creates file provider with custom root', () => {
    process.env.STUDIO_MEDIA_STORAGE_PROVIDER = 'file'
    process.env.STUDIO_MEDIA_STORAGE_LOCAL_ROOT = path.join(process.cwd(), 'tmp', 'media')

    const { provider } = getMediaStorageProvider()
    expect(provider).toBeInstanceOf(FileMediaProvider)
  })

  it('throws when S3 provider missing configuration', () => {
    process.env.STUDIO_MEDIA_STORAGE_PROVIDER = 's3'
    expect(() => getMediaStorageProvider()).toThrow('S3 media storage requires')
  })

  it('returns S3 provider when configuration present', () => {
    process.env.STUDIO_MEDIA_STORAGE_PROVIDER = 's3'
    process.env.STUDIO_MEDIA_STORAGE_S3_BUCKET = 'test-bucket'
    process.env.STUDIO_MEDIA_STORAGE_S3_REGION = 'us-east-1'

    const { backend, provider } = getMediaStorageProvider()
    expect(backend).toBe('S3')
    expect(provider).toBeInstanceOf(S3MediaProvider)
  })
})
