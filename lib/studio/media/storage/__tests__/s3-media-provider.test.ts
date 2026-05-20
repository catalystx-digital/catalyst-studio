import { Readable } from 'node:stream'

import { S3MediaProvider } from '../s3-media-provider'

jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn()
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn().mockImplementation(input => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation(input => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation(input => ({ input })),
    sendMock
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn()
}))

const { sendMock } = jest.requireMock('@aws-sdk/client-s3') as { sendMock: jest.Mock }
const { getSignedUrl: getSignedUrlMock } = jest.requireMock('@aws-sdk/s3-request-presigner') as { getSignedUrl: jest.Mock }

describe('S3MediaProvider', () => {
  const provider = new S3MediaProvider({
    bucket: 'test-bucket',
    region: 'us-east-1',
    publicBaseUrl: 'https://cdn.example.com/media',
    credentials: { accessKeyId: 'abc', secretAccessKey: 'def' }
  })

  beforeEach(() => {
    sendMock.mockReset()
    getSignedUrlMock.mockReset()
  })

  it('puts objects with checksum metadata', async () => {
    sendMock.mockResolvedValueOnce({ ETag: '"etag-value"' })

    const result = await provider.put({
      key: 'assets/sample.png',
      body: Readable.from(['hello']),
      contentType: 'image/png',
      checksum: 'abc123'
    })

    expect(sendMock).toHaveBeenCalledTimes(1)
    const call = sendMock.mock.calls[0][0]
    expect(call.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'assets/sample.png',
      ContentType: 'image/png',
      Body: expect.any(Readable),
      Metadata: { checksum: 'abc123' }
    })
    expect(result.etag).toBe('etag-value')
  })

  it('retrieves objects and exposes metadata', async () => {
    const body = Readable.from(['data'])
    sendMock.mockResolvedValueOnce({
      Body: body,
      ContentType: 'image/png',
      ContentLength: 4,
      Metadata: { foo: 'bar' }
    })

    const result = await provider.get({ key: 'assets/sample.png' })

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ input: { Bucket: 'test-bucket', Key: 'assets/sample.png' } }))
    expect(result.stream).toBe(body)
    expect(result.contentType).toBe('image/png')
    expect(result.contentLength).toBe(4)
    expect(result.metadata).toEqual({ foo: 'bar' })
  })

  it('deletes objects', async () => {
    sendMock.mockResolvedValueOnce({})

    await provider.delete({ key: 'assets/sample.png' })

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ input: { Bucket: 'test-bucket', Key: 'assets/sample.png' } }))
  })

  it('generates public and signed URLs', async () => {
    getSignedUrlMock.mockResolvedValue('https://signed.example.com/object')

    const publicUrl = await provider.getPublicUrl({ key: 'cat photo.png' })
    expect(publicUrl).toBe('https://cdn.example.com/media/cat%20photo.png')

    const signedUrl = await provider.getSignedUrl({ key: 'cat photo.png', expiresInSeconds: 10 })
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1)
    expect(signedUrl).toBe('https://signed.example.com/object')
  })
})