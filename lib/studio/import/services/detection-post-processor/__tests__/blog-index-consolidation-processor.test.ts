import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { consolidateBlogIndexListings } from '../blog-index-consolidation-processor'

function component(
  type: ComponentType,
  content: Record<string, unknown>,
  location: DetectedComponent['location'] = 'main'
): DetectedComponent {
  return {
    component: type,
    type,
    confidence: 0.9,
    location,
    content
  }
}

describe('blog-index-consolidation-processor', () => {
  it('merges split blog-list sections into one blog-list on blog index pages', () => {
    const result = consolidateBlogIndexListings([
      component(ComponentType.NavBar, {}, 'header'),
      component(ComponentType.BlogList, {
        title: 'News',
        posts: [
          { title: 'First article', excerpt: 'First summary', href: { type: 'internal', pageId: 'first', path: '/first' } }
        ]
      }),
      component(ComponentType.BlogList, {
        posts: [
          { title: 'Second article', excerpt: 'Second summary', href: { type: 'internal', pageId: 'second', path: '/second' } }
        ]
      })
    ], {
      pageTemplate: { templateKey: 'blog/index-standard', confidence: 0.9, source: 'model' }
    })

    expect(result.map(entry => entry.type)).toEqual([ComponentType.NavBar, ComponentType.BlogList])
    expect(result[1]).toMatchObject({
      type: ComponentType.BlogList,
      content: {
        title: 'News',
        posts: [
          { title: 'First article', excerpt: 'First summary' },
          { title: 'Second article', excerpt: 'Second summary' }
        ],
        showPagination: true
      },
      metadata: {
        region: 'main',
        sourceEvidence: {
          blogIndexConsolidation: {
            source: 'merge-blog-list',
            mergedPostCount: 2
          }
        }
      }
    })
  })

  it('converts listing-shaped content-feed when blog-list is missing', () => {
    const result = consolidateBlogIndexListings([
      component(ComponentType.ContentFeed, {
        heading: 'News',
        pinned: [
          { title: 'Feed article', excerpt: 'Feed summary', href: { type: 'internal', pageId: 'feed', path: '/feed' } }
        ]
      })
    ], {
      pageTemplate: { templateKey: 'blog/index-standard', confidence: 0.9, source: 'model' }
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: ComponentType.BlogList,
      component: ComponentType.BlogList,
      content: {
        title: 'News',
        posts: [
          { title: 'Feed article', excerpt: 'Feed summary', slug: '/feed' }
        ]
      },
      metadata: {
        sourceEvidence: {
          blogIndexConsolidation: {
            source: 'convert-content-feed'
          }
        }
      }
    })
  })

  it('converts editorial card grids on blog index pages when article evidence is present', () => {
    const result = consolidateBlogIndexListings([
      component(ComponentType.CardGrid, {
        cards: [
          {
            title: 'Policy update',
            description: 'A public-sector article summary',
            href: { type: 'internal', pageId: 'policy-update', path: '/news/policy-update' },
            date: '2026-01-15'
          }
        ]
      })
    ], {
      pageTemplate: { templateKey: 'blog/index-standard', confidence: 0.9, source: 'model' }
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: ComponentType.BlogList,
      content: {
        posts: [
          {
            title: 'Policy update',
            excerpt: 'A public-sector article summary',
            slug: '/news/policy-update',
            date: '2026-01-15'
          }
        ]
      }
    })
  })

  it('does not convert non-index card grids', () => {
    const source = [
      component(ComponentType.CardGrid, {
        cards: [
          { title: 'Service', description: 'Service summary', href: { type: 'internal', pageId: 'service', path: '/service' } }
        ]
      })
    ]

    const result = consolidateBlogIndexListings(source, {
      pageUrl: 'https://example.com/services'
    })

    expect(result).toBe(source)
    expect(result[0].type).toBe(ComponentType.CardGrid)
  })

  it('does not convert generic service card grids on blog index pages', () => {
    const source = [
      component(ComponentType.CardGrid, {
        cards: [
          { title: 'Service', description: 'Service summary', href: { type: 'internal', pageId: 'service', path: '/service' } }
        ]
      })
    ]

    const result = consolidateBlogIndexListings(source, {
      pageTemplate: { templateKey: 'blog/index-standard', confidence: 0.9, source: 'model' }
    })

    expect(result).toBe(source)
    expect(result[0].type).toBe(ComponentType.CardGrid)
  })
})
