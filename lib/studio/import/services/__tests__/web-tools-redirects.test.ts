import { isExternalUrl } from '../web-tools'

describe('web-tools redirect URL classification', () => {
  it('treats apex-to-www canonical redirects as same-site', () => {
    expect(isExternalUrl('https://www.levo.com.au/', 'https://levo.com.au/')).toBe(false)
  })

  it('treats www-to-apex canonical redirects as same-site', () => {
    expect(isExternalUrl('https://example.com/about', 'https://www.example.com/')).toBe(false)
  })

  it('keeps unrelated hosts external', () => {
    expect(isExternalUrl('https://other.example.com/', 'https://example.com/')).toBe(true)
  })
})
