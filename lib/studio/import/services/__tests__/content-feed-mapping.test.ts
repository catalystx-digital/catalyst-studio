import { adjustDetectedComponents } from '../detection-post-processor';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';
import type { DetectedComponent } from '@/lib/studio/import/detection/types';

describe('content feed importer mapping', () => {
  it('promotes tagged news card grids into content feed components with content types', () => {
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
            { id: 'c', title: 'Story C', link: '/news/story-c', publishDate: '2024-01-03' },
          ],
        },
        metadata: { contentTypeTag: 'news' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/news' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    const content = feed.content as any;
    expect(content.limit).toBe(3);
    expect(content.layout).toBe('card-grid');
    expect(content.source.contentTypes).toEqual(['news']);
    expect(content.source.pathPrefix).toBe('/news');
    expect(content.sorting).toEqual({ field: 'publishDate', direction: 'desc' });
    expect(Array.isArray(content.pinned)).toBe(true);
    expect(content.pinned).toHaveLength(3);
    expect(feed.metadata?.contentTypeTag).toBe('news');
  });

  it('promotes tagged blog lists into list feeds and preserves pinned items', () => {
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
            { id: 'p3', title: 'Post 3', href: '/blog/post-3?ref=home', publishDate: '2023-01-03' },
            { id: 'p4', title: 'Post 4', href: '/blog/post-4', publishDate: '2023-01-04' },
          ],
        },
        metadata: { contentTypeTag: 'blog' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).layout).toBe('list');
    expect((feed.content as any).limit).toBe(4);
    expect((feed.content as any).source.pathPrefix).toBe('/blog');
    expect((feed.content as any).source.contentTypes).toEqual(['blog']);
    expect((feed.content as any).pinned).toHaveLength(4);
  });

  it('infers listing tags from headings and hrefs when metadata is missing', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.88,
        content: {
          heading: 'News and updates',
          cards: [
            { id: 'n1', title: 'Story 1', link: '/news/story-1', publishDate: '2024-02-01' },
            { id: 'n2', title: 'Story 2', link: '/news/story-2', publishDate: '2024-02-02' },
            { id: 'n3', title: 'Story 3', link: '/news/story-3', publishDate: '2024-02-03' },
          ],
        },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect(feed.metadata?.contentTypeTag).toBe('news');
    expect((feed.content as any).source.contentTypes).toEqual(['news']);
    expect((feed.content as any).source.pathPrefix).toBe('/news');
  });

  it('keeps untagged feature grids curated', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.FeatureGrid,
        type: ComponentType.FeatureGrid,
        confidence: 0.7,
        content: {
          heading: 'Product capabilities',
          features: [
            { id: 'f1', title: 'Feature A', href: '/features/a' },
            { id: 'f2', title: 'Feature B', href: '/features/b' },
            { id: 'f3', title: 'Feature C', href: '/features/c' },
          ],
        },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/' });
    const listing = result[0];

    expect(listing.type).toBe(ComponentType.FeatureGrid);
    expect((listing.content as any).source).toBeUndefined();
    expect(listing.metadata?.contentTypeTag).toBeUndefined();
  });

  it('falls back to a tag path prefix when links are scattered', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.85,
        content: {
          heading: 'Latest stories',
          cards: [
            { id: 's1', title: 'Story A', link: 'https://example.com/story-a', publishDate: '2024-03-01' },
            { id: 's2', title: 'Story B', link: 'https://example.com/press/story-b?ref=home', publishDate: '2024-03-02' },
            { id: 's3', title: 'Story C', link: 'https://example.com/updates/story-c', publishDate: '2024-03-03' },
          ],
        },
        metadata: { contentTypeTag: 'news' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/newsroom' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.pathPrefix).toBe('/news');
    expect((feed.content as any).source.contentTypes).toEqual(['news']);
    expect((feed.content as any).limit).toBe(3);
    expect((feed.content as any).pinned).toHaveLength(3);
  });

  it('promotes tagged listings without hrefs using a pageUrl fallback', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.BlogList,
        type: ComponentType.BlogList,
        confidence: 0.82,
        content: {
          heading: 'Latest news',
          posts: [
            { id: 'n1', title: 'Story one' },
            { id: 'n2', title: 'Story two' },
            { id: 'n3', title: 'Story three' },
          ],
        },
        metadata: { contentTypeTag: 'news' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://www.rch.org.au/' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.contentTypes).toEqual(['news']);
    expect((feed.content as any).source.pathPrefix).toBe('/news');
    expect((feed.content as any).limit).toBe(3);
    expect((feed.content as any).pinned).toHaveLength(3);
    expect(feed.metadata?.pinnedCount).toBe(3);
  });

  it('relaxes coverage requirements for tagged events listings with sparse hrefs', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.8,
        content: {
          heading: 'Upcoming events',
          cards: [
            { id: 'e1', title: 'Open day', href: 'https://example.com/events/open-day?ref=home' },
            { id: 'e2', title: 'Careers night' },
            { id: 'e3', title: 'Family fun', url: '/events/family-fun' },
          ],
        },
        metadata: { contentTypeTag: 'events' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/events' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.contentTypes).toEqual(['events']);
    expect((feed.content as any).source.pathPrefix).toBe('/events');
    expect((feed.content as any).limit).toBe(3);
    expect((feed.content as any).pinned).toHaveLength(3);
  });

  it('derives path prefixes from absolute URLs with queries', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.9,
        content: {
          heading: 'Our blog',
          cards: [
            { id: 'b1', title: 'Post 1', href: 'https://example.com/blog/post-1?ref=cta' },
            { id: 'b2', title: 'Post 2', href: 'https://example.com/blog/post-2?utm=1' },
            { id: 'b3', title: 'Post 3', href: '/blog/post-3?campaign=test' },
          ],
        },
        metadata: { contentTypeTag: 'blog' },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, { pageUrl: 'https://example.com/' });
    const feed = result[0];

    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.pathPrefix).toBe('/blog');
    expect((feed.content as any).source.contentTypes).toEqual(['blog']);
  });

  it('tags news detail pages and promotes on-page listings with path prefixes', () => {
    const pageMetadata: Record<string, any> = {};
    const components: DetectedComponent[] = [
      {
        component: ComponentType.ArticleHeader,
        type: ComponentType.ArticleHeader,
        confidence: 0.86,
        content: {
          title: 'Emma’s story',
          breadcrumbs: [
            { label: 'Home', href: '/' },
            { label: 'News', href: '/news/' },
            { label: 'Emma’s story', href: '/news/emmas-story/' },
          ],
        },
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
            { id: 'n3', title: 'Story 3', href: 'https://blogs.rch.org.au/news/story-3/' },
          ],
        },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://blogs.rch.org.au/news/emmas-story/',
      pageMetadata,
    });
    const header = result[0];
    const feed = result[1];

    expect(header.metadata?.contentTypeTag).toBe('news');
    expect(header.metadata?.pageTag).toBe('news');
    expect(pageMetadata.contentTypeTag).toBe('news');
    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.contentTypes).toEqual(['news']);
    expect((feed.content as any).source.pathPrefix).toBe('/news');
  });

  it('handles other allowlisted detail pages and promotes listings', () => {
    const pageMetadata: Record<string, any> = {};
    const components: DetectedComponent[] = [
      {
        component: ComponentType.BlogPost,
        type: ComponentType.BlogPost,
        confidence: 0.85,
        content: {
          heading: 'Annual Summit 2024',
          category: 'Events',
        },
      } as DetectedComponent,
      {
        component: ComponentType.FeatureGrid,
        type: ComponentType.FeatureGrid,
        confidence: 0.77,
        content: {
          heading: 'Related events',
          features: [
            { id: 'e1', title: 'Session 1', href: '/events/session-1' },
            { id: 'e2', title: 'Session 2', href: '/events/session-2' },
            { id: 'e3', title: 'Session 3', href: '/events/session-3' },
          ],
        },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://www.example.com/events/annual-summit',
      pageMetadata,
    });
    const feed = result[1];

    expect(result[0].metadata?.contentTypeTag).toBe('events');
    expect(pageMetadata.pageTag).toBe('events');
    expect(feed.type).toBe(ComponentType.ContentFeed);
    expect((feed.content as any).source.contentTypes).toEqual(['events']);
    expect((feed.content as any).source.pathPrefix).toBe('/events');
  });

  it('keeps unrelated grids curated even when the page is tagged', () => {
    const pageMetadata: Record<string, any> = {};
    const components: DetectedComponent[] = [
      {
        component: ComponentType.ArticleHeader,
        type: ComponentType.ArticleHeader,
        confidence: 0.84,
        content: { title: 'Support the foundation' },
      } as DetectedComponent,
      {
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        confidence: 0.8,
        content: {
          heading: 'Learn more',
          cards: [
            { id: 's1', title: 'About us', href: '/about/mission' },
            { id: 's2', title: 'Donate', href: '/support/donate' },
            { id: 's3', title: 'Volunteer', href: '/get-involved/volunteer' },
          ],
        },
      } as DetectedComponent,
    ];

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://blogs.rch.org.au/news/emmas-story/',
      pageMetadata,
    });

    expect(result[0].metadata?.contentTypeTag).toBe('news');
    expect(result[1].type).toBe(ComponentType.CardGrid);
    expect((result[1].content as any).source).toBeUndefined();
  });

  it('injects a content feed when resources show a news cluster but no listing was detected', () => {
    const components: DetectedComponent[] = [
      {
        component: ComponentType.NavBar,
        type: ComponentType.NavBar,
        confidence: 0.9,
        content: {},
      } as DetectedComponent,
      {
        component: ComponentType.HeroCarousel,
        type: ComponentType.HeroCarousel,
        confidence: 0.92,
        content: {},
      } as DetectedComponent,
      {
        component: ComponentType.Footer,
        type: ComponentType.Footer,
        confidence: 0.95,
        content: {},
      } as DetectedComponent,
    ];

    const resourcesSummary = {
      anchors: [
        { href: 'https://blogs.rch.org.au/news/emmas-story/', textPreview: 'Emma’s story', pathId: 'n000001' },
        { href: 'https://blogs.rch.org.au/news/chief-of-medicine/', textPreview: 'Chief of Medicine', pathId: 'n000002' },
        { href: 'https://blogs.rch.org.au/news/hazel-update/', textPreview: 'Hazel update', pathId: 'n000003' },
        { href: 'https://blogs.rch.org.au/news/eddies-story/', textPreview: 'Eddie', pathId: 'n000004' },
      ],
      images: [],
      videos: [],
      forms: [],
      links: [],
    };

    const result = adjustDetectedComponents(components, {
      pageUrl: 'https://www.rch.org.au/',
      resourcesSummary,
    });

    const feedIndex = result.findIndex(component => component.type === ComponentType.ContentFeed);
    const footerIndex = result.findIndex(component => component.type === ComponentType.Footer);
    const feed = result[feedIndex];

    expect(feedIndex).toBeGreaterThanOrEqual(0);
    expect(feedIndex).toBeLessThan(footerIndex);
    expect(feed?.location).toBe('main');
    expect((feed?.content as any).source.pathPrefix).toBe('/news');
    expect((feed?.content as any).source.contentTypes).toEqual(['news']);
    expect((feed?.content as any).limit).toBe(4);
    expect(feed?.metadata?.source).toBe('resources-summary');
    expect(feed?.metadata?.contentTypeTag).toBe('news');
  });
});
