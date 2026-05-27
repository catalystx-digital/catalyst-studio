import {
  createQaPreviewToken,
  normalizePreviewPath,
  QaPreviewTokenError,
  verifyQaPreviewToken,
} from '../qa-preview-token'

describe('QA preview tokens', () => {
  const secret = 'test-secret'
  const now = Date.parse('2026-05-27T00:00:00.000Z')

  it('creates and verifies a path-scoped token', () => {
    const token = createQaPreviewToken({
      websiteId: 'website-1',
      path: '/about/',
      now,
      ttlSeconds: 900,
    }, secret)

    const payload = verifyQaPreviewToken(token, {
      websiteId: 'website-1',
      path: 'about',
      now: now + 1000,
    }, secret)

    expect(payload).toEqual(expect.objectContaining({
      purpose: 'qa-preview',
      websiteId: 'website-1',
      path: '/about',
      issuedAt: now,
      expiresAt: now + 900000,
    }))
  })

  it('normalizes preview paths', () => {
    expect(normalizePreviewPath(null)).toBe('/')
    expect(normalizePreviewPath('about/team/')).toBe('/about/team')
    expect(normalizePreviewPath('//about///team?previewToken=x')).toBe('/about/team')
  })

  it('rejects malformed tokens', () => {
    expect(() => verifyQaPreviewToken('not-a-token', {
      websiteId: 'website-1',
      path: '/',
      now,
    }, secret)).toThrow(QaPreviewTokenError)
  })

  it('rejects tokens signed with a different secret', () => {
    const token = createQaPreviewToken({
      websiteId: 'website-1',
      path: '/',
      now,
      ttlSeconds: 900,
    }, secret)

    expect(() => verifyQaPreviewToken(token, {
      websiteId: 'website-1',
      path: '/',
      now: now + 1000,
    }, 'different-secret')).toThrow('signature is invalid')
  })

  it('rejects expired tokens', () => {
    const token = createQaPreviewToken({
      websiteId: 'website-1',
      path: '/',
      now,
      ttlSeconds: 1,
    }, secret)

    expect(() => verifyQaPreviewToken(token, {
      websiteId: 'website-1',
      path: '/',
      now: now + 1001,
    }, secret)).toThrow('has expired')
  })

  it('rejects wrong website or path scope', () => {
    const token = createQaPreviewToken({
      websiteId: 'website-1',
      path: '/about',
      now,
      ttlSeconds: 900,
    }, secret)

    expect(() => verifyQaPreviewToken(token, {
      websiteId: 'website-2',
      path: '/about',
      now: now + 1000,
    }, secret)).toThrow('scope does not match')

    expect(() => verifyQaPreviewToken(token, {
      websiteId: 'website-1',
      path: '/contact',
      now: now + 1000,
    }, secret)).toThrow('scope does not match')
  })

  it('requires a configured secret', () => {
    expect(() => createQaPreviewToken({
      websiteId: 'website-1',
      path: '/',
      now,
      ttlSeconds: 900,
    }, '')).toThrow('secret is not configured')
  })

  it('rejects tokens with more than a 60 minute TTL', () => {
    expect(() => createQaPreviewToken({
      websiteId: 'website-1',
      path: '/',
      now,
      ttlSeconds: 3601,
    }, secret)).toThrow('cannot exceed 60 minutes')
  })
})
