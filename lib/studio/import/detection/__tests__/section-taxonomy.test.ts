import { classifyRouteIntent, classifySectionIntent } from '../section-taxonomy'

describe('section taxonomy', () => {
  it.each([
    'Some of our latest projects',
    'Latest work',
    'Client work',
    'Case studies',
    'Portfolio'
  ])('classifies "%s" as project grid', (heading) => {
    const result = classifySectionIntent({
      content: {
        heading,
        cards: [
          { title: 'Project A', href: '/projects/a' },
          { title: 'Project B', href: '/projects/b' }
        ]
      }
    })

    expect(result.intent).toBe('project_grid')
    expect(result.allowedTypes).toContain('card-grid')
    expect(result.allowedTypes).not.toContain('card-item')
    expect(result.deniedTypes).toContain('content-feed')
  })

  it('classifies dated news listings as editorial feeds', () => {
    const result = classifySectionIntent({
      content: {
        heading: 'Latest news',
        pinned: [
          { title: 'Story A', date: '2026-05-01', href: '/news/story-a' },
          { title: 'Story B', date: '2026-05-02', href: '/news/story-b' }
        ]
      }
    })

    expect(result.intent).toBe('editorial_feed')
    expect(result.allowedTypes).toContain('content-feed')
    expect(result.deniedTypes).not.toContain('content-feed')
  })

  it('classifies news article links without visible dates as editorial feeds', () => {
    const result = classifySectionIntent({
      content: {
        heading: 'Latest News',
        cards: [
          { title: 'Story A', href: 'https://blogs.example.com/news/story-a/' },
          { title: 'Story B', href: 'https://blogs.example.com/news/story-b/' }
        ]
      }
    })

    expect(result.intent).toBe('editorial_feed')
    expect(result.allowedTypes).toContain('content-feed')
    expect(result.deniedTypes).not.toContain('content-feed')
  })

  it('classifies article and video listings as editorial even with service wording elsewhere', () => {
    const result = classifySectionIntent({
      pageUrl: 'https://www.nngroup.com/',
      content: {
        heading: 'Recent Articles & Videos',
        pinned: [
          {
            title: 'The Four Design Jobs AI Created',
            excerpt: 'Practical UX guidance for service teams.',
            href: { type: 'internal', path: '/articles/design-jobs-ai-created/' }
          },
          {
            title: 'The 3 Sizes of UX Copy',
            excerpt: 'A short UX video.',
            href: { type: 'internal', path: '/videos/the-3-sizes-of-ux-copy/' }
          }
        ]
      }
    })

    expect(result.intent).toBe('editorial_feed')
    expect(result.allowedTypes).toContain('content-feed')
    expect(result.deniedTypes).not.toContain('content-feed')
  })

  it('does not classify latest project links as editorial feeds just because they say latest', () => {
    const result = classifySectionIntent({
      content: {
        heading: 'Latest projects',
        cards: [
          { title: 'Project A', href: '/projects/a' },
          { title: 'Project B', href: '/projects/b' }
        ]
      }
    })

    expect(result.intent).toBe('project_grid')
    expect(result.allowedTypes).toContain('card-grid')
    expect(result.deniedTypes).toContain('content-feed')
  })

  it('classifies services tiles as service grid and denies content feed', () => {
    const result = classifySectionIntent({
      content: {
        heading: 'Our services',
        cards: [
          { title: 'Strategy', href: '/services/strategy' },
          { title: 'Delivery', href: '/services/delivery' }
        ]
      }
    })

    expect(result.intent).toBe('service_grid')
    expect(result.allowedTypes).toEqual(expect.arrayContaining(['card-grid', 'feature-grid']))
    expect(result.allowedTypes).not.toContain('card-item')
    expect(result.deniedTypes).toContain('content-feed')
  })

  it('keeps service-heading sections as service grids despite incidental article and video links', () => {
    const result = classifySectionIntent({
      content: {
        heading: 'Our services',
        cards: [
          { title: 'Strategy', href: '/services/strategy' },
          { title: 'Training video', href: '/videos/service-training/' },
          { title: 'Implementation article', href: '/articles/implementation-guide/' }
        ]
      }
    })

    expect(result.intent).toBe('service_grid')
    expect(result.allowedTypes).toEqual(expect.arrayContaining(['card-grid', 'feature-grid']))
    expect(result.deniedTypes).toContain('content-feed')
  })

  it('classifies work routes as project grids', () => {
    const result = classifyRouteIntent('https://example.com/our-work')

    expect(result.intent).toBe('project_grid')
    expect(result.allowedTypes).toContain('card-grid')
    expect(result.allowedTypes).not.toContain('card-item')
    expect(result.deniedTypes).toContain('content-feed')
  })

  it('classifies blog routes with dates as editorial feeds', () => {
    const result = classifySectionIntent({
      pageUrl: 'https://example.com/blog',
      content: {
        heading: 'Latest articles',
        posts: [{ title: 'Post A', date: 'May 1, 2026', href: '/blog/post-a' }]
      }
    })

    expect(result.intent).toBe('editorial_feed')
    expect(result.allowedTypes).toContain('content-feed')
  })
})
