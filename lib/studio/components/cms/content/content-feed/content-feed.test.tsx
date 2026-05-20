import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ComponentCategory, ComponentType } from '../../_core/types';
import { ContentFeed } from './index';
import type { ContentFeedContent } from './content-feed.types';
import { ContentResource, registerContentProvider, resetContentProviders } from '../../_core/data-providers';

describe('ContentFeed component', () => {
  beforeEach(() => {
    resetContentProviders();
  });

  it('renders pinned items before fetched items in card grid layout', () => {
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: () => ({
        items: [
          { id: 'auto-1', title: 'Auto Item 1', publishDate: '2024-01-01' },
          { id: 'auto-2', title: 'Auto Item 2', publishDate: '2024-01-02' },
        ],
        total: 2,
      }),
    });

    const content: ContentFeedContent = {
      heading: 'News',
      layout: 'card-grid',
      limit: 3,
      sorting: { field: 'publishDate', direction: 'desc' },
      source: { pathPrefix: '/news', contentTypes: ['news'] },
      pinned: [{ id: 'pinned-1', title: 'Pinned Story', publishDate: '2024-02-01' }],
    };

    const { container } = render(
      <ContentFeed
        id="feed-test"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );
    const cards = container.querySelectorAll('.cms-card-grid-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]).toHaveTextContent('Pinned Story');
  });

  it('shows empty state when no items are available', () => {
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: () => ({ items: [], total: 0 }),
    });

    const content: ContentFeedContent = {
      layout: 'card-grid',
      source: { pathPrefix: '/news' },
      emptyCopy: 'No items available',
    };

    render(
      <ContentFeed
        id="feed-empty"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    expect(screen.getByText('No items available')).toBeInTheDocument();
  });

  it('renders error state when provider throws', () => {
    registerContentProvider(ContentResource.ContentFeed, {
      fetch: () => {
        throw new Error('provider failed');
      },
    });

    const content: ContentFeedContent = {
      heading: 'Errors',
      layout: 'list',
      source: { pathPrefix: '/news' },
      pinned: [],
    };

    render(
      <ContentFeed
        id="feed-error"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('provider failed');
  });
});
