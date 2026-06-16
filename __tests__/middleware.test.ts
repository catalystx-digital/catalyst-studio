import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

jest.mock('@/lib/auth/session-cookie.edge', () => ({
  AUTH_BYPASS_USER_HEADER: 'x-catalyst-auth-bypass-user',
  AUTH_SESSION_COOKIE: 'catalyst_session',
  AUTHENTICATED_HEADER: 'x-catalyst-authenticated',
  verifySessionCookieEdge: jest.fn().mockResolvedValue(false),
}))

describe('middleware static asset bypass', () => {
  it.each([
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-192x192.png',
    '/favicon-512x512.png',
    '/apple-touch-icon.png',
    '/site.webmanifest',
  ])('allows unauthenticated public asset request %s', async (path) => {
    const response = await middleware(new NextRequest(`http://localhost:3000${path}`))

    expect(response.status).toBe(200)
  })

  it('redirects unauthenticated private app routes', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/studio/site-builder'))

    expect(response.status).toBe(307)
  })
})
