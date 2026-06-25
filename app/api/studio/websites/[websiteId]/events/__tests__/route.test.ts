import { ReadableStream } from 'node:stream/web'
import { NextRequest } from 'next/server'

Object.defineProperty(globalThis, 'ReadableStream', {
  value: ReadableStream,
  configurable: true,
})
import { GET } from '../route'
import { getAuthorizedContext } from '@/lib/auth/authorization'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'
import { ImportActivityReadService } from '@/lib/studio/import/services/import-activity-read-service'
import { studioEventBus } from '@/lib/studio/activity/studio-event-bus'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: { findUnique: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('@/lib/auth/authorization', () => {
  const actual = jest.requireActual('@/lib/auth/authorization')
  return {
    ...actual,
    getAuthorizedContext: jest.fn(),
  }
})

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn(),
}))

jest.mock('@/lib/studio/import/services/import-activity-read-service', () => ({
  ImportActivityReadService: jest.fn().mockImplementation(() => ({
    listForAccount: jest.fn().mockResolvedValue([]),
  })),
}))

jest.mock('@/lib/studio/activity/studio-event-bus', () => ({
  studioEventBus: {
    listAfter: jest.fn().mockResolvedValue([]),
  },
}))

const mockGetAuthorizedContext = getAuthorizedContext as jest.MockedFunction<typeof getAuthorizedContext>
const mockAssertWebsiteOwnership = assertWebsiteOwnership as jest.MockedFunction<typeof assertWebsiteOwnership>
const mockListAfter = studioEventBus.listAfter as jest.Mock

function requestFor(websiteId: string) {
  return new NextRequest(`http://localhost:3000/api/studio/websites/${websiteId}/events`)
}

describe('GET /api/studio/websites/[websiteId]/events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAssertWebsiteOwnership.mockResolvedValue(undefined)
    mockListAfter.mockResolvedValue([])
  })

  it('rejects same-account members without access to the requested website', async () => {
    mockGetAuthorizedContext.mockResolvedValue({
      accountId: 'account-1',
      userId: 'user-1',
      role: 'member',
      websiteAccess: 'specific',
      websiteIds: ['site-allowed'],
      isSystemAdmin: false,
      isImpersonating: false,
      membershipId: 'membership-1',
    })

    const response = await GET(requestFor('site-victim'), {
      params: Promise.resolve({ websiteId: 'site-victim' }),
    })

    expect(response.status).toBe(403)
    expect(mockAssertWebsiteOwnership).toHaveBeenCalledWith(expect.anything(), 'account-1', 'site-victim')
    expect(ImportActivityReadService).not.toHaveBeenCalled()
    expect(mockListAfter).not.toHaveBeenCalled()
  })

  it('allows members with specific access to stream an assigned website', async () => {
    mockGetAuthorizedContext.mockResolvedValue({
      accountId: 'account-1',
      userId: 'user-1',
      role: 'member',
      websiteAccess: 'specific',
      websiteIds: ['site-allowed'],
      isSystemAdmin: false,
      isImpersonating: false,
      membershipId: 'membership-1',
    })

    const response = await GET(requestFor('site-allowed'), {
      params: Promise.resolve({ websiteId: 'site-allowed' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    await response.body?.cancel()
  })
})
