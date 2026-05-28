import { normalizeImage } from './image-normalization'

describe('normalizeImage', () => {
  it('normalizes media reference objects without leaking object values', () => {
    const image = normalizeImage({
      src: {
        url: 'https://example.com/hero.png',
        mediaId: 'media-1',
        mediaType: 'image',
      },
      originalUrl: {
        url: 'https://origin.example.com/hero.png',
        mediaId: 'media-1',
        mediaType: 'image',
      },
      alt: 'Hero',
    } as any)

    expect(image).toMatchObject({
      src: 'https://example.com/hero.png',
      originalUrl: 'https://origin.example.com/hero.png',
      alt: 'Hero',
    })
    expect(image?.originalUrl).not.toBe('[object Object]')
  })
})
