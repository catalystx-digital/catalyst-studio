import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { adjustDetectedComponents } from '../detection-post-processor'

describe('content feed importer mapping', () => {
  it('does not promote tagged news card grids into content feed components', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.88,
        content: {
          heading: 'Latest news',
          cards: [
            { id: 'a', title: 'Story A', link: '/news/story-a', publishDate: '2024-01-01' },
            { id: 'b', title: 'Story B', link: '/news/story-b', publishDate: '2024-01-02' },
            { id: 'c', title: 'Story C', link: '/news/story-c', publishDate: '2024-01-03' }
          ]
        },
        metadata: { contentTypeTag: 'news' }
      } as DetectedComponent
    ]

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/news' })
    const listing = result[0]

    expect(listing.type).toBe(ComponentType.CardGrid)
    expect(listing.metadata?.contentTypeTag).toBe('news')
    expect((listing.content as any).source).toBeUndefined()
    expect((listing.content as any).pinned).toBeUndefined()
  })

  it('does not promote tagged blog lists into content feed components', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.BlogList,
        type: ComponentType.BlogList,
        confidence: 0.78,
        content: {
          title: 'Latest updates',
          posts: [
            { id: 'p1', title: 'Post 1', href: 'https://example.com/blog/post-1', publishDate: '2023-01-01' },
            { id: 'p2', title: 'Post 2', href: 'https://example.com/blog/post-2', publishDate: '2023-01-02' },
            { id: 'p3', title: 'Post 3', href: '/blog/post-3?ref=home', publishDate: '2023-01-03' }
          ]
        },
        metadata: { contentTypeTag: 'blog' }
      } as DetectedComponent
    ]

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/' })
    const listing = result[0]

    expect(listing.type).toBe(ComponentType.BlogList)
    expect((listing.content as any).source).toBeUndefined()
    expect((listing.content as any).pinned).toBeUndefined()
  })

  it('does not inject a content feed from resource anchors', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.NavBar,
        type: ComponentType.NavBar,
        confidence: 0.9,
        content: {}
      } as DetectedComponent,
      {
        component: ComponentType.HeroCarousel,
        type: ComponentType.HeroCarousel,
        confidence: 0.92,
        content: {}
      } as DetectedComponent,
      {
        component: ComponentType.Footer,
        type: ComponentType.Footer,
        confidence: 0.95,
        content: {}
      } as DetectedComponent
    ]

    const resourcesSummary = {
      anchors: [
        { href: 'https://blogs.rch.org.au/news/emmas-story/', textPreview: 'Emma story', pathId: 'n000001' },
        { href: 'https://blogs.rch.org.au/news/chief-of-medicine/', textPreview: 'Chief of Medicine', pathId: 'n000002' },
        { href: 'https://blogs.rch.org.au/news/hazel-update/', textPreview: 'Hazel update', pathId: 'n000003' }
      ],
      images: [],
      videos: [],
      forms: [],
      links: []
    }

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://www.rch.org.au/',
      resourcesSummary
    })

    expect(result.some(component => component.type === ComponentType.ContentFeed)).toBe(false)
    expect(result).toHaveLength(3)
  })

  it('still tags article detail pages without promoting related listings', () => {
    const pageMetadata: Record<string, any> = {}
    const components: DetectedComponent[] = [
      {
        component: ComponentType.ArticleHeader,
        type: ComponentType.ArticleHeader,
        confidence: 0.86,
        content: {
          title: 'Emma story',
          breadcrumbs: [
            { label: 'Home', href: '/' },
            { label: 'News', href: '/news/' },
            { label: 'Emma story', href: '/news/emmas-story/' }
          ]
        }
      } as DetectedComponent,
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.8,
        content: {
          heading: 'More news stories',
          cards: [
            { id: 'n1', title: 'Story 1', href: 'https://blogs.rch.org.au/news/story-1/' },
            { id: 'n2', title: 'Story 2', href: 'https://blogs.rch.org.au/news/story-2/' },
            { id: 'n3', title: 'Story 3', href: 'https://blogs.rch.org.au/news/story-3/' }
          ]
        }
      } as DetectedComponent
    ]

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://blogs.rch.org.au/news/emmas-story/',
      pageMetadata
    })

    expect(result[0].metadata?.contentTypeTag).toBe('news')
    expect(result[0].metadata?.pageTag).toBe('news')
    expect(pageMetadata.contentTypeTag).toBe('news')
    expect(result[1].type).toBe(ComponentType.CardGrid)
  })
})
