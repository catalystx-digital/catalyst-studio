import { NextRequest } from 'next/server'

const mockVerifySessionCookieEdge = jest.fn()

jest.mock('@/lib/auth/session-cookie.edge', () => ({
  AUTH_BYPASS_USER_HEADER: 'x-auth-bypass-user',
  AUTH_SESSION_COOKIE: 'auth_session',
  AUTHENTICATED_HEADER: 'x-authenticated',
  verifySessionCookieEdge: (...args: unknown[]) => mockVerifySessionCookieEdge(...args),
}))

import { middleware } from './middleware'

describe('middleware QA preview token pass-through', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifySessionCookieEdge.mockResolvedValue(false)
  })

  it('allows unauthenticated GET preview page requests with previewToken', async () => {
    const response = await middleware(
      new NextRequest('http://localhost/studio/preview/site/website-1/about?previewToken=token-1')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('allows unauthenticated GET preview data requests with previewToken', async () => {
    const response = await middleware(
      new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/about&previewToken=token-1')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('does not allow token pass-through to mutation or unrelated API routes', async () => {
    const mutation = await middleware(
      new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&previewToken=token-1', {
        method: 'POST',
      })
    )
    const unrelated = await middleware(
      new NextRequest('http://localhost/api/studio/websites?previewToken=token-1')
    )

    expect(mutation.status).toBe(401)
    expect(unrelated.status).toBe(401)
  })
})
