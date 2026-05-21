import { buildPreviewUrl } from '@/lib/studio/components/preview/SandboxPreview'

describe('buildPreviewUrl', () => {
  it('encodes the resolved preview path into the sandbox iframe URL', () => {
    const url = buildPreviewUrl(
      'https://sandbox.example.test',
      'modern',
      'ignored-page',
      '/about%20us/team'
    )

    expect(url).toBe(
      'https://sandbox.example.test/?designConcept=modern&path=%2Fabout%2520us%2Fteam&page=about%2520us%2Fteam'
    )
  })

  it('preserves existing page query behavior when no preview path is available', () => {
    const url = buildPreviewUrl('https://sandbox.example.test', undefined, 'about')

    expect(url).toBe('https://sandbox.example.test/?page=about')
  })
})
