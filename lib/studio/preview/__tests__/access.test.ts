const mockGetAuthContext = jest.fn()
const mockAssertWebsiteOwnership = jest.fn()

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: (...args: unknown[]) => mockAssertWebsiteOwnership(...args),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    accountMembership: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Headers()),
}))

import { authorizePreviewRead } from '../access'
import { createQaPreviewToken } from '../qa-preview-token'

describe('preview read access', () => {
  const secret = 'access-test-secret'
  const previousSecret = process.env.QA_PREVIEW_TOKEN_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.QA_PREVIEW_TOKEN_SECRET = secret
  })

  afterAll(() => {
    process.env.QA_PREVIEW_TOKEN_SECRET = previousSecret
  })

  it('validates QA preview tokens without invoking session ownership checks', async () => {
    const token = createQaPreviewToken({
      websiteId: 'website-1',
      path: '/about',
      now: Date.now(),
      ttlSeconds: 900,
    }, secret)

    await expect(authorizePreviewRead(undefined, 'website-1', {
      previewToken: token,
      path: '/about',
    })).resolves.toEqual({ mode: 'qa-token' })

    expect(mockGetAuthContext).not.toHaveBeenCalled()
    expect(mockAssertWebsiteOwnership).not.toHaveBeenCalled()
  })

  it('fails closed for invalid QA preview tokens instead of falling back to session access', async () => {
    await expect(authorizePreviewRead(undefined, 'website-1', {
      previewToken: 'invalid',
      path: '/',
    })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    })

    expect(mockGetAuthContext).not.toHaveBeenCalled()
    expect(mockAssertWebsiteOwnership).not.toHaveBeenCalled()
  })
})
