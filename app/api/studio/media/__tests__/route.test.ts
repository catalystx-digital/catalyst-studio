import { NextRequest } from 'next/server'
import { GET } from '../route'
import { MediaRepository } from '@/lib/studio/media/media-repository'
import { UniversalMediaService } from '@/lib/studio/media/universal-media-service'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn()
}))

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn()
}))

jest.mock('@/lib/studio/media/media-repository')
jest.mock('@/lib/studio/media/universal-media-service')

const mockGetAuthContext = require('@/lib/auth/context').getAuthContext as jest.Mock
const mockAssertWebsiteOwnership = require('@/lib/auth/ownership').assertWebsiteOwnership as jest.Mock

const mockedRepository = MediaRepository as unknown as jest.Mock
const mockedMediaService = UniversalMediaService as unknown as jest.Mock

let listMediaForWebsiteMock: jest.Mock
let getAssetsForWebsiteByIdsMock: jest.Mock

describe('GET /api/studio/media', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAuthContext.mockResolvedValue({ userId: 'user-1', accountId: 'account-1' })
    mockAssertWebsiteOwnership.mockResolvedValue(true)

    listMediaForWebsiteMock = jest.fn().mockResolvedValue({
        items: [
          {
            id: 'media-1',
            websiteId: 'site-1',
            provider: 'FILE',
            storageKey: 'uploads/image.jpg',
            checksum: 'abc123',
            contentType: 'image/jpeg',
            width: 1200,
            height: 800,
            duration: null,
            metadata: { altText: 'Sample image' },
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-02T00:00:00Z')
          }
        ],
        nextCursor: 'cursor-2'
      })
    mockedRepository.mockImplementation(() => ({
      listMediaForWebsite: listMediaForWebsiteMock
    }))

    getAssetsForWebsiteByIdsMock = jest.fn().mockResolvedValue(new Map([
        ['media-1', {
          id: 'media-1',
          signedUrl: 'https://signed-url',
          publicUrl: 'https://public-url',
          originalUrl: 'https://origin/image.jpg',
          altText: 'Signed image'
        }]
      ]))
    mockedMediaService.mockImplementation(() => ({
      getAssetsForWebsiteByIds: getAssetsForWebsiteByIdsMock
    }))
  })

  it('returns 400 when websiteId missing', async () => {
    const request = new NextRequest('http://localhost/api/studio/media')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 401 when auth fails', async () => {
    mockGetAuthContext.mockRejectedValueOnce(new Error('Unauthorized'))
    const request = new NextRequest('http://localhost/api/studio/media?websiteId=site-1')
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('returns media items with signed URLs', async () => {
    const request = new NextRequest('http://localhost/api/studio/media?websiteId=site-1&search=hero&limit=10')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.items).toHaveLength(1)
    expect(json.nextCursor).toBe('cursor-2')
    expect(json.items[0]).toMatchObject({
      id: 'media-1',
      signedUrl: 'https://signed-url',
      originalUrl: 'https://origin/image.jpg',
      altText: 'Signed image'
    })

    expect(listMediaForWebsiteMock).toHaveBeenCalledWith('site-1', expect.objectContaining({ search: 'hero', limit: 10 }))
  })

  it('handles empty results', async () => {
    listMediaForWebsiteMock.mockResolvedValueOnce({ items: [], nextCursor: undefined })

    const request = new NextRequest('http://localhost/api/studio/media?websiteId=site-1')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.items).toEqual([])
    expect(json.nextCursor).toBeNull()
  })
})
