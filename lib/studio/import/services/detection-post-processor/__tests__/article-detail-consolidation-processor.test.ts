import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { consolidateArticleDetailFragments } from '../article-detail-consolidation-processor'

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

describe('article-detail-consolidation-processor', () => {
  it('consolidates source-backed article detail fragments into one blog post', () => {
    const result = consolidateArticleDetailFragments([
      component(ComponentType.NavBar, {}, 'header'),
      component(ComponentType.ArticleHeader, {
        title: '10 Biggest Thinkers',
        author: { name: 'Jakob Nielsen' },
        publishDate: '1999-12-29'
      }, 'header'),
      component(ComponentType.TextBlock, {
        body: 'Summary: This article introduces a curated list of influential thinkers and explains why the list is intentionally unordered.'
      }),
      component(ComponentType.Accordion, {
        items: [
          {
            question: 'Vannevar Bush',
            answer: 'Invented the foundation for the Web in 1945 and founded much early thinking about human-centered computing.'
          },
          {
            question: 'Albert Einstein',
            answer: 'Included as one of the century most famous scientists because his ideas reshaped modern thought.'
          }
        ]
      }),
      component(ComponentType.RelatedPosts, { title: 'Related Articles', posts: [{ title: 'Other article' }] }),
      component(ComponentType.Footer, {}, 'footer')
    ], {
      pageUrl: 'https://example.com/articles/10-biggest-thinkers/'
    })

    expect(result.map(entry => entry.type)).toEqual([
      ComponentType.NavBar,
      ComponentType.ArticleHeader,
      ComponentType.BlogPost,
      ComponentType.RelatedPosts,
      ComponentType.Footer
    ])
    expect(result[1].location).toBe('hero')
    expect(result[1].metadata?.region).toBe('hero')

    const blogPost = result.find(entry => entry.type === ComponentType.BlogPost)
    expect(blogPost).toMatchObject({
      location: 'main',
      content: {
        title: '10 Biggest Thinkers',
        author: { name: 'Jakob Nielsen' },
        publishDate: '1999-12-29',
        sourceUrl: 'https://example.com/articles/10-biggest-thinkers/'
      },
      metadata: {
        source: 'article-detail-consolidation'
      }
    })
    expect(blogPost?.content.bodyHtml).toContain('<p>Summary: This article introduces')
    expect(blogPost?.content.bodyHtml).toContain('<h2>Vannevar Bush</h2>')
    expect(blogPost?.content.bodyHtml).not.toContain('Related Articles')
  })

  it('preserves an existing blog post unchanged', () => {
    const existing = component(ComponentType.BlogPost, {
      title: 'Existing',
      bodyHtml: '<p>Already canonical.</p>'
    })

    const result = consolidateArticleDetailFragments([
      component(ComponentType.ArticleHeader, { title: 'Existing' }, 'header'),
      existing,
      component(ComponentType.TextBlock, {
        body: 'This fragment should not be merged because a canonical post already exists.'
      })
    ], {
      pageUrl: 'https://example.com/articles/existing/'
    })

    expect(result).toHaveLength(3)
    expect(result[1]).toBe(existing)
    expect(result[0].location).toBe('hero')
    expect(result[0].metadata?.region).toBe('hero')
  })

  it('keeps strict validation available when article evidence is insufficient', () => {
    const result = consolidateArticleDetailFragments([
      component(ComponentType.ArticleHeader, { title: 'Thin article' }, 'header'),
      component(ComponentType.TextBlock, { body: 'Short note.' })
    ], {
      pageUrl: 'https://example.com/articles/thin/'
    })

    expect(result.map(entry => entry.type)).toEqual([
      ComponentType.ArticleHeader,
      ComponentType.TextBlock
    ])
  })

  it('does not run on editorial listing routes', () => {
    const result = consolidateArticleDetailFragments([
      component(ComponentType.ArticleHeader, { title: 'Listing Title' }, 'header'),
      component(ComponentType.TextBlock, {
        body: 'This copy is intentionally long enough that it would otherwise meet the article body threshold if the route were a detail route.'
      })
    ], {
      pageUrl: 'https://example.com/articles/'
    })

    expect(result.some(entry => entry.type === ComponentType.BlogPost)).toBe(false)
  })
})
