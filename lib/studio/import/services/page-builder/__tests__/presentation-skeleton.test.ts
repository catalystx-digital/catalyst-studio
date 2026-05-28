import { selectPresentationSkeleton } from '../presentation-skeleton'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ImportDetectionResult } from '../../../detection/types'

function detection(overrides: Partial<ImportDetectionResult>): ImportDetectionResult {
  return {
    pageUrl: 'https://example.com/',
    processingTime: 1,
    modelUsed: 'test',
    components: [],
    ...overrides,
  }
}

describe('selectPresentationSkeleton', () => {
  it('selects agency-home for homepage agency signals', () => {
    const selection = selectPresentationSkeleton({
      pageUrl: 'https://example.com/',
      detection: detection({
        pageMetadata: { pageType: 'home', visualStyle: 'Digital agency portfolio' },
        components: [{
          component: ComponentType.HeroWithImage,
          type: ComponentType.HeroWithImage,
          confidence: 0.9,
          content: { heading: 'Build better digital products' },
        }],
      }),
    })

    expect(selection.key).toBe('agency-home')
    expect(selection.reason).toContain('agency')
  })

  it('selects agency-home from component evidence even when page metadata is sparse', () => {
    const selection = selectPresentationSkeleton({
      pageUrl: 'https://example.com/',
      detection: detection({
        components: [
          {
            component: ComponentType.CardGrid,
            type: ComponentType.CardGrid,
            confidence: 0.9,
            content: {
              heading: 'What we deliver',
              cards: [
                { title: 'Digital strategy' },
                { title: 'UX design' },
                { title: 'Web development' },
              ],
            },
          },
          {
            component: ComponentType.LogoCloud,
            type: ComponentType.LogoCloud,
            confidence: 0.9,
            content: { logos: [{ id: 'award', src: { url: 'https://example.com/award.png' }, alt: 'Award' }] },
          },
        ],
      }),
    })

    expect(selection.key).toBe('agency-home')
  })

  it('does not classify generic content feeds as institutional without institutional evidence', () => {
    const selection = selectPresentationSkeleton({
      pageUrl: 'https://example.com/',
      detection: detection({
        components: [{
          component: ComponentType.ContentFeed,
          type: ComponentType.ContentFeed,
          confidence: 0.9,
          content: {
            heading: 'Latest posts',
            pinned: [{ title: 'How to choose the right CMS' }],
          },
        }],
      }),
    })

    expect(selection.key).toBe('unknown')
  })

  it('does not force homepage skeletons on non-home paths', () => {
    const selection = selectPresentationSkeleton({
      pageUrl: 'https://example.com/about',
      detection: detection({
        components: [{
          component: ComponentType.CardGrid,
          type: ComponentType.CardGrid,
          confidence: 0.9,
          content: { cards: [{ title: 'A' }] },
        }],
      }),
    })

    expect(selection.key).toBe('unknown')
    expect(selection.confidence).toBe(0)
  })
})
