import { resolveBlogListContent, resolveRelatedPostsContent } from './content-resolver';
import type { BlogListContent } from '../blog-list/blog-list.types';
import type { RelatedPostsContent } from '../related-posts/related-posts.types';
import { resetContentProviders, registerContentProvider, ContentResource } from '../../_core/data-providers';
import { mockBlogContentProvider } from '../../_core/providers/mock';

describe('content resolvers', () => {
  beforeEach(() => {
    resetContentProviders();
  });

  it('does not inject blog posts when no blog provider is registered', () => {
    const content: BlogListContent = {
      autoFill: {
        strategy: 'latest',
        desiredCount: 3
      },
      showPagination: false
    };

    const resolved = resolveBlogListContent(content);

    expect(resolved.posts).toEqual([]);
    expect(resolved.manualPosts).toEqual([]);
  });

  it('auto-fills blog list content when a provider is explicitly registered', () => {
    registerContentProvider(ContentResource.BlogPosts, mockBlogContentProvider);

    const content: BlogListContent = {
      manualPosts: [
        {
          id: 'manual-1',
          title: 'Pinned launch announcement',
          excerpt: 'Our editors want this one first.',
          author: { name: 'Editorial Team' },
          publishDate: '2024-01-10',
          categories: ['Announcements'],
          tags: ['launch'],
          slug: 'pinned-launch',
          readingTime: 3
        }
      ],
      autoFill: {
        strategy: 'latest',
        desiredCount: 3
      },
      showPagination: false
    };

    const resolved = resolveBlogListContent(content);

    expect(resolved.posts).toHaveLength(3);
    expect(resolved.posts?.[0]?.id).toBe('manual-1');
    const autoIds = resolved.posts?.slice(1).map(post => post.id) ?? [];
    expect(autoIds.length).toBeGreaterThan(0);
    expect(autoIds).toEqual(expect.arrayContaining(['mock-blog-1', 'mock-blog-2']));
  });

  it('normalizes imported blog posts without ids before deduping', () => {
    const content = {
      posts: [
        {
          title: 'Introducing the Section508.gov Content Library',
          excerpt: 'A new content library is available.',
          slug: '/news/section508-content-library/',
          date: '2026-01-15',
          image: {
            src: {
              url: 'https://digital.gov/assets/section508-library.webp',
            },
            alt: 'Content library preview',
          },
          category: 'Accessibility',
          author: 'Digital.gov Team',
        },
        {
          title: 'Designing services with public participation',
          excerpt: 'A second imported article.',
          slug: '/news/public-participation/',
          date: '2026-02-20',
          category: 'Service Design',
          tags: ['research'],
        },
      ],
      showPagination: false,
    } as unknown as BlogListContent;

    const resolved = resolveBlogListContent(content);

    expect(resolved.posts).toHaveLength(2);
    expect(resolved.posts?.[0]).toEqual(
      expect.objectContaining({
        id: 'news-section508-content-library',
        slug: '/news/section508-content-library/',
        publishDate: '2026-01-15',
        categories: ['Accessibility'],
        author: { name: 'Digital.gov Team' },
      }),
    );
    expect(resolved.posts?.[0]?.thumbnail).toEqual({
      src: {
        url: 'https://digital.gov/assets/section508-library.webp',
      },
      alt: 'Content library preview',
    });
    expect(resolved.posts?.[1]).toEqual(
      expect.objectContaining({
        id: 'news-public-participation',
        publishDate: '2026-02-20',
        categories: ['Service Design'],
        tags: ['research'],
      }),
    );
  });

  it('dedupes imported blog posts by stable slug-derived ids', () => {
    const content = {
      posts: [
        {
          title: 'First copy',
          slug: '/news/duplicate/',
        },
        {
          title: 'Second copy',
          slug: '/news/duplicate/',
        },
        {
          title: 'Distinct title without slug',
        },
      ],
      showPagination: false,
    } as unknown as BlogListContent;

    const resolved = resolveBlogListContent(content);

    expect(resolved.posts).toHaveLength(2);
    expect(resolved.posts?.map(post => post.id)).toEqual([
      'news-duplicate',
      'distinct-title-without-slug',
    ]);
  });

  it('does not backfill related posts when no blog provider is registered', () => {
    const content: RelatedPostsContent = {
      manualPosts: [
        {
          id: 'manual-related-1',
          title: 'Pinned related post',
          slug: 'pinned-related',
          categories: ['Product']
        }
      ],
      maxPosts: 4,
      relatedBy: 'both'
    };

    const resolved = resolveRelatedPostsContent(content);

    expect(resolved.posts).toEqual([
      expect.objectContaining({ id: 'manual-related-1' })
    ]);
  });

  it('backfills related posts up to the requested max when a provider is explicitly registered', () => {
    registerContentProvider(ContentResource.BlogPosts, mockBlogContentProvider);

    const content: RelatedPostsContent = {
      manualPosts: [
        {
          id: 'manual-related-1',
          title: 'Pinned related post',
          slug: 'pinned-related',
          categories: ['Product']
        }
      ],
      maxPosts: 4,
      relatedBy: 'both'
    };

    const resolved = resolveRelatedPostsContent(content);

    expect(resolved.posts).toHaveLength(3);
    expect(resolved.posts?.[0]?.id).toBe('manual-related-1');
    // Ensure there are no duplicates in the auto-filled portion
    const uniqueIds = new Set(resolved.posts?.map(post => post.id));
    expect(uniqueIds.size).toBe(resolved.posts?.length);
  });

  it('surfaces registered blog provider errors', () => {
    registerContentProvider(ContentResource.BlogPosts, {
      fetch: () => {
        throw new Error('blog provider failed');
      }
    });

    const content: BlogListContent = {
      autoFill: {
        strategy: 'latest',
        desiredCount: 2
      },
      showPagination: false
    };

    expect(() => resolveBlogListContent(content)).toThrow('blog provider failed');
  });
});
