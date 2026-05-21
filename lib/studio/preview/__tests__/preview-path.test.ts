import {
  normalizePreviewPath,
  resolvePreviewPathInput,
  slugSegmentsToPreviewPath,
} from '@/lib/studio/preview/preview-path'

describe('preview path helpers', () => {
  it('keeps the homepage distinct from a real /home path', () => {
    expect(resolvePreviewPathInput({ page: 'home' })).toBe('/')
    expect(resolvePreviewPathInput({ path: '/home' })).toBe('/home')
  })

  it('normalizes nested paths and trims query strings', () => {
    expect(normalizePreviewPath(' /about/team/?utm=1#bio ')).toBe('/about/team')
    expect(slugSegmentsToPreviewPath(['about', 'team'])).toBe('/about/team')
  })

  it('encodes path segments deterministically', () => {
    expect(normalizePreviewPath('/about us/R&D')).toBe('/about%20us/R%26D')
    expect(normalizePreviewPath('/already%20encoded')).toBe('/already%20encoded')
  })
})

