import { registerContentProvider, resetContentProviders, ContentResource } from '../../_core/data-providers';
import type { ContentFeedContent, ContentFeedItem } from './content-feed.types';
import { resolveContentFeed } from './content-feed.resolver';

const providerItems: ContentFeedItem[] = Array.from({ length: 12 }).map((_, index) => {
  const id = `auto-${index + 1}`;
  const date = new Date(2024, 0, index + 1).toISOString();
  return {
    id,
    title: `Auto item ${index + 1}`,
    publishDate: date,
    metadata: { publishDate: date },
    href: `/news/${id}`,
    categories: ['News'],
  };
});

describe('resolveContentFeed', () => {
  beforeEach(() => {
    resetContentProviders();
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: query => {
        const limit = query.limit ?? providerItems.length;
        const items = providerItems.slice(0, limit);
        return {
          items,
          total: providerItems.length,
        };
      },
    });
  });

  it('dedupes pinned items and orders them before fetched content', () => {
    const content: ContentFeedContent = {
      layout: 'card-grid',
      limit: 4,
      pinned: [
        { id: 'auto-1', title: 'Pinned overlap', publishDate: '2024-01-02', href: '/news/auto-1' },
        { id: 'pinned-extra', title: 'Pinned only', publishDate: '2024-01-10', href: '/news/pinned-extra' },
      ],
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['news'], pathPrefix: '/news' },
    };

    const resolved = resolveContentFeed(content);

    expect(resolved.items.map(item => item.id)).toEqual(['pinned-extra', 'auto-1', 'auto-6', 'auto-5']);
    expect(resolved.pinned.map(item => item.id)).toEqual(['pinned-extra', 'auto-1']);
  });

  it('applies sorting to merged results', () => {
    const content: ContentFeedContent = {
      sorting: { field: 'updatedAt', direction: 'asc' },
      source: { contentTypes: ['news'], pathPrefix: '/news' },
      pinned: [
        { id: 'pinned', title: 'Pinned latest', publishDate: '2024-02-01', updatedAt: '2024-02-05' },
      ],
      limit: 3,
    };

    const resolved = resolveContentFeed(content);
    const ids = resolved.items.map(item => item.id);
    expect(ids[0]).toBe('pinned');
    expect(ids[1]).toBe('auto-1');
  });

  it('paginates after merging and sorting', () => {
    const content: ContentFeedContent = {
      sorting: { field: 'publishDate', direction: 'asc' },
      source: { contentTypes: ['news'], pathPrefix: '/news' },
      pagination: { pageSize: 3, currentPage: 2 },
    };

    const resolved = resolveContentFeed(content);

    expect(resolved.items).toHaveLength(3);
    expect(resolved.items.map(item => item.id)).toEqual(['auto-4', 'auto-5', 'auto-6']);
    expect(resolved.page).toEqual({ currentPage: 2, pageSize: 3 });
  });

  it('returns empty items when provider yields none', () => {
    resetContentProviders();
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: () => ({ items: [], total: 0 }),
    });

    const content: ContentFeedContent = {
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['news'] },
    };

    const resolved = resolveContentFeed(content);
    expect(resolved.items).toEqual([]);
    expect(resolved.error).toBeUndefined();
  });

  it('surfaces provider errors without injecting mock data', () => {
    resetContentProviders();
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: () => {
        throw new Error('provider failed');
      },
    });

    const content: ContentFeedContent = {
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { contentTypes: ['news'] },
      pinned: [{ id: 'pinned', title: 'Pinned item' }],
    };

    const resolved = resolveContentFeed(content);
    expect(resolved.error).toBe('provider failed');
    expect(resolved.items[0]?.id).toBe('pinned');
  });
});
