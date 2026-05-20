import { normalizeImportUrl } from '../import-run-service'

describe('normalizeImportUrl', () => {
  it('normalizes host casing, fragments, tracking params, query order, and trailing slash', () => {
    expect(
      normalizeImportUrl('https://Example.com/About/?b=2&utm_source=test&a=1#team')
    ).toBe('https://example.com/About?a=1&b=2')
  })

  it('keeps root trailing slash', () => {
    expect(normalizeImportUrl('https://Example.com/')).toBe('https://example.com/')
  })

  it('returns trimmed input when parsing fails', () => {
    expect(normalizeImportUrl(' not a url ')).toBe('not a url')
  })
})
