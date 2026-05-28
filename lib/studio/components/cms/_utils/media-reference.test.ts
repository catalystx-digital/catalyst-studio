import { normalizeImage } from './image-normalization'
import { normalizeCmsImage } from './media-reference'

describe('CMS media reference normalization', () => {
  it('normalizes canonical image media references', () => {
    expect(
      normalizeCmsImage({
        src: {
          mediaId: 'media-1',
          mediaType: 'image',
          url: 'https://example.com/card.jpg',
        },
        alt: 'Card',
        originalUrl: 'https://example.com/card.jpg',
      })
    ).toEqual({
      src: 'https://example.com/card.jpg',
      alt: 'Card',
      originalUrl: 'https://example.com/card.jpg',
    })
  })

  it('normalizes previously malformed nested url media references for rendering', () => {
    const malformed = {
      src: {
        mediaId: 'detected:card',
        mediaType: 'image',
        url: {
          src: 'https://example.com/card.jpg',
          mediaId: 'media-1',
          originalUrl: 'https://example.com/card.jpg',
        },
      },
      alt: 'Card',
    }

    expect(normalizeCmsImage(malformed)).toEqual({
      src: 'https://example.com/card.jpg',
      alt: 'Card',
      originalUrl: 'https://example.com/card.jpg',
    })
    expect(normalizeImage(malformed)).toMatchObject({
      src: 'https://example.com/card.jpg',
      alt: 'Card',
      originalUrl: 'https://example.com/card.jpg',
    })
  })

  it('normalizes media references that only carry originalUrl', () => {
    const image = {
      src: {
        mediaId: 'media-1',
        mediaType: 'image',
        originalUrl: 'https://example.com/original.jpg',
      },
      alt: 'Original only',
    }

    expect(normalizeCmsImage(image)).toEqual({
      src: 'https://example.com/original.jpg',
      alt: 'Original only',
      originalUrl: 'https://example.com/original.jpg',
    })
    expect(normalizeImage(image)).toMatchObject({
      src: 'https://example.com/original.jpg',
      alt: 'Original only',
      originalUrl: 'https://example.com/original.jpg',
    })
  })

  it('prefers resolved nested media URL over stale relative originalUrl', () => {
    const image = {
      src: {
        mediaId: 'detected:hero',
        mediaType: 'image',
        url: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
        originalUrl: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
      },
      alt: 'Hero',
      originalUrl: '/uploadedImages/Main/hero.jpg',
    }

    expect(normalizeCmsImage(image)).toEqual({
      src: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
      alt: 'Hero',
      originalUrl: '/uploadedImages/Main/hero.jpg',
    })
    expect(normalizeImage(image)).toMatchObject({
      src: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
      alt: 'Hero',
      originalUrl: 'https://www.rch.org.au/uploadedImages/Main/hero.jpg',
    })
  })

  it('strips clearly truncated tiny transform dimensions from image URLs', () => {
    expect(
      normalizeCmsImage({
        src: {
          url: 'https://assets.example.com/article.jpg?h=3&fm=webp',
        },
        alt: 'Article',
      })
    ).toEqual({
      src: 'https://assets.example.com/article.jpg?fm=webp',
      alt: 'Article',
    })
  })
})
