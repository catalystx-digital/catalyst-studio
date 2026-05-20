import { normalizeAssetUrl } from '../snapshot-builder'

describe('normalizeAssetUrl', () => {
  const origin = 'https://example.com'

  it('converts root-relative paths using the provided origin', () => {
    expect(normalizeAssetUrl('/themes/custom/tio/logo.svg', origin)).toBe(
      'https://example.com/themes/custom/tio/logo.svg'
    )
  })

  it('converts host-relative asset paths without a leading slash', () => {
    expect(normalizeAssetUrl('sites/default/files/image.jpg', origin)).toBe(
      'https://example.com/sites/default/files/image.jpg'
    )
  })

  it('normalizes protocol-relative URLs against the origin scheme', () => {
    expect(normalizeAssetUrl('//cdn.example.com/asset.png', origin)).toBe(
      'https://cdn.example.com/asset.png'
    )
  })

  it('leaves absolute URLs untouched', () => {
    const absolute = 'https://media.example.com/image.png'
    expect(normalizeAssetUrl(absolute, origin)).toBe(absolute)
  })

  it('returns the original value when no origin is available', () => {
    const relative = '/sites/default/files/icon.png'
    expect(normalizeAssetUrl(relative, undefined)).toBe(relative)
  })
})

