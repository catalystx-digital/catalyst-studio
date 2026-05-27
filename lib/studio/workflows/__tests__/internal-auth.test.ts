import { NextRequest } from 'next/server'
import { isAuthorizedInternalWorkflowRequest } from '../internal-auth'

const ORIGINAL_ENV = process.env

function makeRequest(url: string) {
  const { host } = new URL(url)
  return new NextRequest(url, { headers: { host } })
}

function makeRequestWithHost(host: string) {
  return new NextRequest('https://example.com/api/internal/import-job', { headers: { host } })
}

describe('isAuthorizedInternalWorkflowRequest', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.WORKFLOW_INTERNAL_SECRET
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    delete process.env.VERCEL_URL
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('allows localhost internal workflow calls when running locally with NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production'

    expect(isAuthorizedInternalWorkflowRequest(makeRequest('http://localhost:3000/api/internal/import-job'))).toBe(true)
  })

  it.each(['127.0.0.1:3000', '[::1]:3000', '::1'])(
    'allows loopback host %s when running locally with NODE_ENV=production',
    (host) => {
      process.env.NODE_ENV = 'production'

      expect(isAuthorizedInternalWorkflowRequest(makeRequestWithHost(host))).toBe(true)
    },
  )

  it.each(['notlocalhost.com', 'localhost.evil.com', '127.0.0.1.evil.com'])(
    'rejects host spoofing for %s when no Vercel runtime is present',
    (host) => {
      process.env.NODE_ENV = 'production'

      expect(isAuthorizedInternalWorkflowRequest(makeRequestWithHost(host))).toBe(false)
    },
  )

  it('does not treat localhost as implicitly authorized in a Vercel runtime', () => {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL_URL = 'example.vercel.app'

    expect(isAuthorizedInternalWorkflowRequest(makeRequest('http://localhost:3000/api/internal/import-job'))).toBe(false)
  })

  it('allows matching workflow secret headers', () => {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL_URL = 'example.vercel.app'
    process.env.WORKFLOW_INTERNAL_SECRET = 'secret'

    expect(
      isAuthorizedInternalWorkflowRequest(
        new NextRequest('https://example.vercel.app/api/internal/import-job', {
          headers: { 'x-workflow-internal': 'secret' },
        }),
      ),
    ).toBe(true)
  })
})
