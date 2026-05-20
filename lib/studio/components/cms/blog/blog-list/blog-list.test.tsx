import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import BlogList from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { BlogListProps } from './blog-list.types';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} />;
  },
}));

// Mock performance tracking HOC
jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('BlogList Component', () => {
  const mockPosts = [
    {
      id: '1',
      title: 'First Blog Post',
      excerpt: 'This is the first blog post excerpt.',
      thumbnail: '/image1.jpg',
      author: { name: 'John Doe', avatar: '/avatar1.jpg' },
      publishDate: '2024-01-01',
      readingTime: 5,
      categories: ['Technology', 'React'],
      tags: ['javascript', 'frontend'],
      slug: 'first-blog-post',
      views: 100
    },
    {
      id: '2',
      title: 'Second Blog Post',
      excerpt: 'This is the second blog post excerpt.',
      thumbnail: '/image2.jpg',
      author: { name: 'Jane Smith', avatar: '/avatar2.jpg' },
      publishDate: '2024-01-02',
      readingTime: 3,
      categories: ['Design', 'UX'],
      tags: ['design', 'ux'],
      slug: 'second-blog-post',
      views: 50
    },
    {
      id: '3',
      title: 'Third Blog Post',
      excerpt: 'This is the third blog post excerpt.',
      thumbnail: '/image3.jpg',
      author: { name: 'Bob Johnson', avatar: '/avatar3.jpg' },
      publishDate: '2024-01-03',
      readingTime: 7,
      categories: ['Technology'],
      tags: ['backend', 'nodejs'],
      slug: 'third-blog-post',
      views: 75
    }
  ];

  const defaultProps: BlogListProps = {
    id: 'blog-list-1',
    type: ComponentType.BlogList,
    category: ComponentCategory.Blog,
    content: {
      posts: mockPosts,
      title: 'Latest Articles',
      description: 'Read our latest blog posts',
      viewMode: 'grid',
      columns: 3,
      showPagination: true,
      postsPerPage: 2,
      showFilters: true
    }
  };

  it('renders with required props', () => {
    render(<BlogList {...defaultProps} />);
    
    expect(screen.getByRole('heading', { name: 'Latest Articles' })).toBeInTheDocument();
    expect(screen.getByText('Read our latest blog posts')).toBeInTheDocument();
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Third Blog Post');
    expect(articles[1]).toHaveTextContent('Second Blog Post');
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<BlogList {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('passes accessibility audit', async () => {
    const { container } = render(<BlogList {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content properly', () => {
    const propsWithXSS: BlogListProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Blog Posts',
        posts: [{
          ...mockPosts[0],
          title: '<img src=x onerror=alert("XSS")>Test Post'
        }]
      }
    };
    
    render(<BlogList {...propsWithXSS} />);
    
    // Check that scripts are not executed
    expect(
      screen.queryByText('<script>alert("XSS")</script>Blog Posts')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Blog Posts')).toBeInTheDocument();
  });

  it('responds to breakpoints correctly', () => {
    const { container } = render(<BlogList {...defaultProps} />);
    const grid = container.querySelector('[data-view-mode="grid"]');
    
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('calculates reading time accurately', () => {
    render(<BlogList {...defaultProps} />);
    
    expect(screen.getByText('7 min read')).toBeInTheDocument();
    expect(screen.getByText('3 min read')).toBeInTheDocument();
  });

  it('filters by category correctly', async () => {
    render(<BlogList {...defaultProps} />);
    
    const techButton = screen.getByRole('button', { name: /Technology/i });
    fireEvent.click(techButton);
    
    // Only posts with Technology category should be visible
    await waitFor(() => {
      expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      expect(screen.queryByText('Second Blog Post')).not.toBeInTheDocument();
    });
  });

  it('handles pagination correctly', () => {
    render(<BlogList {...defaultProps} />);
    
    // First page should show 2 posts (postsPerPage is 2)
    const firstPageArticles = screen.getAllByRole('article');
    expect(firstPageArticles[0]).toHaveTextContent('Third Blog Post');
    expect(firstPageArticles[1]).toHaveTextContent('Second Blog Post');
    
    // Navigate to second page
    const pageTwoButton = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageTwoButton);
    
    // Second page should show the remaining post
    return waitFor(() => {
      expect(screen.getByText('First Blog Post')).toBeInTheDocument();
      expect(screen.queryByText('Third Blog Post')).not.toBeInTheDocument();
      expect(screen.queryByText('Second Blog Post')).not.toBeInTheDocument();
    });
  });

  it('respects popularity sort configuration', () => {
    const popularityProps: BlogListProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        sortBy: 'popularity',
        sortOrder: 'desc',
      },
    };

    render(<BlogList {...popularityProps} />);

    const posts = screen.getAllByRole('article');
    expect(posts[0]).toHaveTextContent('First Blog Post');
    expect(posts[1]).toHaveTextContent('Third Blog Post');
  });

  it('handles empty posts array gracefully', () => {
    const emptyProps: BlogListProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        posts: []
      }
    };
    
  render(<BlogList {...emptyProps} />);
  expect(screen.getByRole('heading', { name: 'Latest Articles' })).toBeInTheDocument();
  expect(
    screen.getByText('No posts match the selected filters yet.')
  ).toBeInTheDocument();
});

  it('calls onPostClick when post is clicked', () => {
    const onPostClick = jest.fn();
    const propsWithClick: BlogListProps = {
      ...defaultProps,
      onPostClick
    };
    
    render(<BlogList {...propsWithClick} />);
    
    const [firstPost] = screen.getAllByRole('article');
    fireEvent.click(firstPost);

    const expectedFirstPost = [...mockPosts].sort((a, b) =>
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    )[0];

    expect(onPostClick).toHaveBeenCalledWith(expectedFirstPost);
  });

  it('displays in list view mode', () => {
    const listProps: BlogListProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        viewMode: 'list'
      }
    };
    
    const { container } = render(<BlogList {...listProps} />);
    const layout = container.querySelector('[data-view-mode="list"]');
    expect(layout).toHaveClass('flex');
    expect(layout).not.toHaveClass('grid');
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<BlogList {...defaultProps} />);
    
    const nextButton = screen.getByRole('button', { name: 'Next' });
    nextButton.focus();
    
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    });
  });

  it('displays correct ARIA attributes', () => {
    const { container } = render(<BlogList {...defaultProps} />);

    const section = container.querySelector('section#blog-list-1');
    expect(section).toHaveAttribute('aria-label', 'Blog posts list');

    const feed = container.querySelector('[role="feed"]');
    expect(feed).toHaveAttribute('aria-live', 'polite');

    const articles = screen.getAllByRole('article');
    articles.forEach(article => {
      expect(article).toHaveAttribute('aria-labelledby');
    });
  });
});
