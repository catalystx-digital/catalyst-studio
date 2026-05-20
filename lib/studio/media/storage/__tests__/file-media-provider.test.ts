import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { FileMediaProvider } from '../file-media-provider'

const readStreamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })

describe('FileMediaProvider', () => {
  let tempRoot: string
  let provider: FileMediaProvider

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'file-media-provider-'))
    provider = new FileMediaProvider({
      rootDirectory: tempRoot,
      publicBaseUrl: 'http://localhost:3000/media'
    })
  })

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('writes, reads, signs, and deletes media objects', async () => {
    const key = 'site-123/assets/logo.png'
    const payload = Buffer.from('hello-world')

    const putResult = await provider.put({
      key,
      body: payload,
      contentType: 'image/png'
    })
    expect(putResult.size).toBe(payload.length)

    const storedPath = path.join(tempRoot, 'site-123', 'assets', 'logo.png')
    await expect(fs.stat(storedPath)).resolves.toHaveProperty('size', payload.length)

    const getResult = await provider.get({ key })
    expect(getResult.contentLength).toBe(payload.length)
    const buffer = await readStreamToBuffer(getResult.stream)
    expect(buffer.equals(payload)).toBe(true)

    const publicUrl = await provider.getPublicUrl({ key })
    expect(publicUrl).toBe('http://localhost:3000/media/site-123/assets/logo.png')

    const signedUrl = await provider.getSignedUrl({ key })
    expect(signedUrl).toBe(publicUrl)

    await provider.delete({ key })
    await expect(fs.stat(storedPath)).rejects.toThrow()
  })
})