import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ComponentCategory, ComponentType } from '../../_core/types';
import { ContentFeed } from './index';
import type { ContentFeedContent } from './content-feed.types';
import { ContentResource, registerContentProvider, resetContentProviders } from '../../_core/data-providers';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

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

  it('renders feed card grids without first-card feature spanning', () => {
    const content: ContentFeedContent = {
      heading: 'Resources',
      layout: 'card-grid',
      pinned: Array.from({ length: 5 }).map((_, index) => ({
        id: `resource-${index}`,
        title: `Resource ${index + 1}`,
        excerpt: 'Useful resource summary.',
        image: `https://example.com/resource-${index}.jpg`,
      })),
    };

    const { container } = render(
      <ContentFeed
        id="feed-no-feature"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card');
    expect(firstCard).not.toHaveClass('md:col-span-2');
  });

  it('uses the shared section container and header rhythm', () => {
    const content: ContentFeedContent = {
      heading: 'Resources',
      subheading: 'Latest useful updates',
      layout: 'list',
      pinned: [
        {
          id: 'resource-1',
          title: 'Resource 1',
          excerpt: 'Useful resource summary.',
        },
      ],
    };

    const { container } = render(
      <ContentFeed
        id="feed-section-rhythm"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    const section = container.querySelector('section.cms-content-feed');
    const inner = section?.firstElementChild;
    expect(inner).toHaveClass('mx-auto', 'max-w-7xl', 'ds-gap-lg');
    expect(section?.querySelector('header')).toHaveClass('max-w-3xl');
    expect(screen.getByText('Latest useful updates')).toHaveClass('max-w-2xl');
  });

  it('renders card-grid feed images eagerly for reliable previews', () => {
    const content: ContentFeedContent = {
      heading: 'Latest posts',
      layout: 'card-grid',
      pinned: [
        {
          id: 'post-1',
          title: 'Post with image',
          image: 'https://example.com/post.jpg',
        },
      ],
    };

    render(
      <ContentFeed
        id="feed-eager-images"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    expect(screen.getByRole('img', { name: 'Post with image' })).toHaveAttribute('loading', 'eager');
  });

  it('renders card-grid feeds with compact feed density', () => {
    const content: ContentFeedContent = {
      heading: 'Latest posts',
      layout: 'card-grid',
      pinned: [
        {
          id: 'post-compact',
          title: 'Compact feed post',
          excerpt: 'A feed summary should stay compact in repeated news sections.',
          image: 'https://example.com/post-compact.jpg',
          date: '2026-05-18',
        },
      ],
    };

    const { container } = render(
      <ContentFeed
        id="feed-density"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    const mediaWrapper = container.querySelector('.cms-card-grid-card img')?.parentElement;
    expect(mediaWrapper).toHaveClass('aspect-[5/2]', 'sm:aspect-[16/9]');
    expect(screen.getByText('Compact feed post')).toHaveClass('text-base', 'sm:text-lg');
    expect(screen.getByText('A feed summary should stay compact in repeated news sections.')).toHaveClass('ds-body-sm', 'line-clamp-2');
    expect(screen.getByText('2026-05-18')).toHaveClass('text-[11px]');
    expect(screen.getByText('2026-05-18').closest('div')).toHaveClass(
      'px-2',
      'py-0',
      'text-[11px]',
      'bg-muted/40',
      'text-muted-foreground',
      'border-border/50',
    );
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

  it('renders list feed image renditions with responsive srcset', () => {
    const content: ContentFeedContent = {
      heading: 'Latest posts',
      layout: 'list',
      pinned: [
        {
          id: 'post-renditions',
          title: 'Post with responsive image',
          image: {
            src: 'https://cdn.example.com/post',
            alt: 'Post image',
            renditions: [
              { src: 'https://cdn.example.com/post?w=400', width: 400, height: 225 },
              { src: 'https://cdn.example.com/post?w=800', width: 800, height: 450 },
            ],
          },
        },
      ],
    };

    render(
      <ContentFeed
        id="feed-list-renditions"
        type={ComponentType.ContentFeed}
        category={ComponentCategory.Content}
        content={content}
      />,
    );

    expect(screen.getByRole('img', { name: 'Post image' })).toHaveAttribute(
      'srcset',
      'https://cdn.example.com/post?w=400 400w, https://cdn.example.com/post?w=800 800w',
    );
    expect(screen.getByRole('img', { name: 'Post image' })).toHaveAttribute('sizes', '(min-width: 768px) 33vw, 100vw');
  });
});
