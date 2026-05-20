import { resolveBlogListContent, resolveRelatedPostsContent } from './content-resolver';
import type { BlogListContent } from '../blog-list/blog-list.types';
import type { RelatedPostsContent } from '../related-posts/related-posts.types';
import { resetContentProviders, registerContentProvider, ContentResource } from '../../_core/data-providers';
import { mockBlogContentProvider, mockTeamContentProvider } from '../../_core/providers/mock';

describe('content resolvers', () => {
  beforeEach(() => {
    resetContentProviders();
    registerContentProvider(ContentResource.BlogPosts, mockBlogContentProvider);
    registerContentProvider(ContentResource.TeamMembers, mockTeamContentProvider);
  });

  it('auto-fills blog list content when manual posts are missing', () => {
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

  it('backfills related posts up to the requested max', () => {
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
});
