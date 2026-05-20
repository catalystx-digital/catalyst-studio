import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import RelatedPosts from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { RelatedPostsProps, RelatedPost } from './related-posts.types';

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

describe('RelatedPosts Component', () => {
  const mockPosts: RelatedPost[] = [
    {
      id: '1',
      title: 'Getting Started with React',
      thumbnail: '/react-post.jpg',
      excerpt: 'Learn the basics of React and build your first component.',
      author: { name: 'John Doe', avatar: '/john.jpg' },
      publishDate: '2024-01-10',
      readingTime: 5,
      categories: ['React', 'JavaScript'],
      slug: 'getting-started-react'
    },
    {
      id: '2',
      title: 'Advanced TypeScript Patterns',
      thumbnail: '/typescript-post.jpg',
      excerpt: 'Explore advanced TypeScript patterns for better type safety.',
      author: { name: 'Jane Smith', avatar: '/jane.jpg' },
      publishDate: '2024-01-12',
      readingTime: 8,
      categories: ['TypeScript'],
      slug: 'advanced-typescript'
    },
    {
      id: '3',
      title: 'State Management with Redux',
      thumbnail: '/redux-post.jpg',
      excerpt: 'Master state management in React applications with Redux.',
      author: { name: 'Bob Johnson' },
      publishDate: '2024-01-14',
      readingTime: 6,
      categories: ['React', 'Redux'],
      slug: 'state-management-redux'
    },
    {
      id: '4',
      title: 'Testing React Components',
      thumbnail: '/testing-post.jpg',
      excerpt: 'Best practices for testing React components.',
      publishDate: '2024-01-16',
      readingTime: 7,
      categories: ['React', 'Testing'],
      slug: 'testing-react'
    }
  ];

  const defaultProps: RelatedPostsProps = {
    id: 'related-posts-1',
    type: ComponentType.RelatedPosts,
    category: ComponentCategory.Blog,
    content: {
      title: 'You May Also Like',
      posts: mockPosts,
      displayMode: 'grid',
      maxPosts: 3,
      showExcerpt: true,
      showAuthor: true,
      showDate: true,
      showReadingTime: true,
      showCategories: true,
      selectionMode: 'automatic',
      relatedBy: 'categories'
    }
  };

  it('renders with required props', () => {
    render(<RelatedPosts {...defaultProps} />);
    
    expect(screen.getByText('You May Also Like')).toBeInTheDocument();
    expect(screen.getByText('Getting Started with React')).toBeInTheDocument();
    expect(screen.getByText('Advanced TypeScript Patterns')).toBeInTheDocument();
    expect(screen.getByText('State Management with Redux')).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<RelatedPosts {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('passes accessibility audit', async () => {
    const { container } = render(<RelatedPosts {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content properly', () => {
    const postsWithXSS: RelatedPost[] = [{
      ...mockPosts[0],
      title: '<script>alert("XSS")</script>Malicious Title',
      excerpt: '<img src=x onerror=alert("XSS")>Bad excerpt',
      author: { name: '<b>John</b> Doe' }
    }];
    
    const propsWithXSS: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Related',
        posts: postsWithXSS
      }
    };
    
    render(<RelatedPosts {...propsWithXSS} />);
    
    expect(screen.queryByText(/script/)).not.toBeInTheDocument();
    expect(screen.getByText('Related')).toBeInTheDocument();
    expect(screen.getByText('Malicious Title')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('limits posts to maxPosts', () => {
    render(<RelatedPosts {...defaultProps} />);
    
    // maxPosts is 3, so only 3 posts should be displayed
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
    
    // Fourth post should not be displayed
    expect(screen.queryByText('Testing React Components')).not.toBeInTheDocument();
  });

  it('displays posts in grid mode', () => {
    const { container } = render(<RelatedPosts {...defaultProps} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('gap-6');
  });

  it('displays posts in list mode', () => {
    const listProps: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        displayMode: 'list'
      }
    };
    
    const { container } = render(<RelatedPosts {...listProps} />);
    
    const wrapper = container.querySelector('[data-display-mode=\"list\"] > div');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('flex-col');
    expect(wrapper).toHaveClass('gap-4');
  });

  it('displays posts in carousel mode', () => {
    const carouselProps: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        displayMode: 'carousel'
      }
    };
    
    const { container } = render(<RelatedPosts {...carouselProps} />);
    
    const carousel = container.querySelector('.overflow-x-auto');
    expect(carousel).toBeInTheDocument();
  });

  it('handles post click events', () => {
    const onPostClick = jest.fn();
    const propsWithClick: RelatedPostsProps = {
      ...defaultProps,
      onPostClick
    };
    
    render(<RelatedPosts {...propsWithClick} />);
    
    const firstPost = screen.getAllByRole('article')[0];
    fireEvent.click(firstPost);
    
    expect(onPostClick).toHaveBeenCalledWith(mockPosts[0]);
  });

  it('renders CTA button that links to the normalized slug', () => {
    const onPostClick = jest.fn();
    render(<RelatedPosts {...defaultProps} onPostClick={onPostClick} />);

    const cta = screen.getByRole('link', {
      name: `Read ${mockPosts[0].title}`,
    });
    expect(cta).toHaveAttribute('href', '/getting-started-react');

    fireEvent.click(cta);
    expect(onPostClick).toHaveBeenCalledWith(mockPosts[0]);
  });

  it('shows/hides excerpt based on showExcerpt prop', () => {
    const propsWithoutExcerpt: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showExcerpt: false
      }
    };
    
    const { rerender } = render(<RelatedPosts {...defaultProps} />);
    expect(screen.getByText(/Learn the basics of React/)).toBeInTheDocument();
    
    rerender(<RelatedPosts {...propsWithoutExcerpt} />);
    expect(screen.queryByText(/Learn the basics of React/)).not.toBeInTheDocument();
  });

  it('shows/hides author based on showAuthor prop', () => {
    const { rerender } = render(<RelatedPosts {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    const propsWithoutAuthor: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showAuthor: false,
      },
    };

    rerender(<RelatedPosts {...propsWithoutAuthor} />);
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('shows/hides date based on showDate prop', () => {
    const { rerender } = render(<RelatedPosts {...defaultProps} />);
    expect(screen.getByText('Jan 10, 2024')).toBeInTheDocument();

    const propsWithoutDate: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showDate: false,
      },
    };

    rerender(<RelatedPosts {...propsWithoutDate} />);
    expect(screen.queryByText('Jan 10, 2024')).not.toBeInTheDocument();
  });

  it('shows/hides reading time based on showReadingTime prop', () => {
    const { rerender } = render(<RelatedPosts {...defaultProps} />);
    expect(screen.getByText('5 min read')).toBeInTheDocument();

    const propsWithoutReadingTime: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showReadingTime: false,
      },
    };

    rerender(<RelatedPosts {...propsWithoutReadingTime} />);
    expect(screen.queryByText('5 min read')).not.toBeInTheDocument();
  });

  it('shows/hides categories based on showCategories prop', () => {
    const initialRender = render(<RelatedPosts {...defaultProps} />);
    const firstArticle = initialRender.getAllByRole('article')[0];
    expect(within(firstArticle).getByText('React')).toBeInTheDocument();

    const propsWithoutCategories: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showCategories: false,
      },
    };

    const { rerender } = initialRender;
    rerender(<RelatedPosts {...propsWithoutCategories} />);
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('displays selection mode indicator', () => {
    render(<RelatedPosts {...defaultProps} />);
    expect(screen.getByText('Based on similar categories')).toBeInTheDocument();
    
    const propsWithTags: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        relatedBy: 'tags'
      }
    };
    
    const { rerender } = render(<RelatedPosts {...propsWithTags} />);
    rerender(<RelatedPosts {...propsWithTags} />);
    expect(screen.getByText('Based on similar tags')).toBeInTheDocument();
  });

  it('handles different column counts', () => {
    const columnCounts: Array<2 | 3 | 4> = [2, 3, 4];
    
    columnCounts.forEach(columns => {
      const { container } = render(
        <RelatedPosts {...defaultProps} columns={columns} />
      );
      
      const grid = container.querySelector('.grid');
      const expectedClass = columns === 2 
        ? 'md:grid-cols-2' 
        : columns === 3
        ? 'lg:grid-cols-3'
        : 'xl:grid-cols-4';
        
      expect(grid).toHaveClass(expectedClass);
    });
  });

  it('handles different image aspect ratios', () => {
    const aspectRatios: Array<'16:9' | '4:3' | '1:1' | '3:2'> = ['16:9', '4:3', '1:1', '3:2'];
    
    aspectRatios.forEach(ratio => {
      const { container } = render(
        <RelatedPosts {...defaultProps} imageAspectRatio={ratio} />
      );
      
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it('handles empty posts array gracefully', () => {
    const emptyProps: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        posts: []
      }
    };
    
    const { container } = render(<RelatedPosts {...emptyProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays correct ARIA attributes', () => {
    const { container } = render(<RelatedPosts {...defaultProps} />);
    
    const section = container.querySelector('[role="complementary"]');
    expect(section).toHaveAttribute('aria-label', 'Related articles');
    
    const articles = screen.getAllByRole('article');
    articles.forEach(article => {
      expect(article).toHaveAttribute('aria-labelledby');
    });
  });

  it('truncates long excerpts', () => {
    const longExcerpt = 'Lorem ipsum '.repeat(50);
    const postsWithLongExcerpt: RelatedPost[] = [{
      ...mockPosts[0],
      excerpt: longExcerpt
    }];
    
    const propsWithLongExcerpt: RelatedPostsProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        posts: postsWithLongExcerpt
      }
    };
    
    render(<RelatedPosts {...propsWithLongExcerpt} />);
    
    const excerpt = screen.getByText(/Lorem ipsum/);
    expect(excerpt.textContent).toMatch(/…$/);
    expect(excerpt.textContent?.length).toBeLessThanOrEqual(101);
  });
});
