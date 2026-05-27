import { summarizeSectionNodes } from '../section-summarizer'

describe('section summarizer', () => {
  it('returns the original nodes when disabled', () => {
    const nodes = [{ tag: 'a', attrs: { href: '/about' }, text: 'About' }]

    const result = summarizeSectionNodes(nodes, false)

    expect(result.enabled).toBe(false)
    expect(result.nodes).toBe(nodes)
    expect(result.reductionRatio).toBe(0)
  })

  it('preserves visible extraction evidence when enabled', () => {
    const result = summarizeSectionNodes([
      {
        tag: 'article',
        pathId: 'n000123',
        className: 'large noisy class list',
        bgColor: '#6f8434',
        bgImage: 'url(/hero.jpg)',
        attrs: {
          href: '/news/story',
          title: 'Story',
          'data-tracking-id': 'discard-me'
        },
        text: '  Story heading   with spacing  ',
        children: [
          {
            tag: 'img',
            attrs: {
              src: '/image.jpg',
              alt: 'Story image',
              width: '1200'
            }
          },
          {
            tag: 'time',
            attrs: { datetime: '2026-05-26' },
            text: '26 May 2026'
          }
        ]
      }
    ], true)

    expect(result.enabled).toBe(true)
    expect(result.nodes).toEqual([
      {
        tag: 'article',
        pathId: 'n000123',
        text: 'Story heading with spacing',
        bgColor: '#6f8434',
        bgImage: 'url(/hero.jpg)',
        attrs: {
          href: '/news/story',
          title: 'Story'
        },
        children: [
          {
            tag: 'img',
            attrs: {
              src: '/image.jpg',
              alt: 'Story image'
            }
          },
          {
            tag: 'time',
            text: '26 May 2026',
            attrs: { datetime: '2026-05-26' }
          }
        ]
      }
    ])
    expect(result.summarizedBytes).toBeLessThan(result.originalBytes)
  })
})
