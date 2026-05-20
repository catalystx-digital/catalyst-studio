import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import BlogCard from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { BlogCardProps } from './blog-card.types';

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

describe('BlogCard Component', () => {
  const defaultProps: BlogCardProps = {
    id: 'blog-card-1',
    type: ComponentType.BlogCard,
    category: ComponentCategory.Blog,
    content: {
      title: 'Test Blog Post',
      excerpt: 'This is a test blog post excerpt that provides a preview of the content.',
      thumbnail: '/test-image.jpg',
      author: {
        name: 'John Doe',
        avatar: '/avatar.jpg'
      },
      publishDate: '2024-01-15',
      readingTime: 5,
      categories: ['Technology', 'React'],
      tags: ['javascript', 'frontend'],
      slug: 'test-blog-post',
      featured: false,
      likes: 42,
      comments: 10,
      views: 150
    }
  };

  it('renders with required props', () => {
    render(<BlogCard {...defaultProps} />);
    
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.getByText(/This is a test blog post excerpt/)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('5 min read')).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<BlogCard {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('passes accessibility audit', async () => {
    const { container } = render(<BlogCard {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content properly', () => {
    const propsWithXSS: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Malicious Title',
        excerpt: '<img src=x onerror=alert("XSS")>Bad excerpt',
        author: {
          name: '<b>John</b> Doe',
          avatar: '/avatar.jpg'
        }
      }
    };
    
    render(<BlogCard {...propsWithXSS} />);
    
    // Check that scripts are not executed
    expect(
      screen.queryByText('<script>alert("XSS")</script>Malicious Title')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Malicious Title')).toBeInTheDocument();
    expect(screen.getByText('Bad excerpt')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('truncates excerpt correctly', () => {
    const longExcerpt = 'Lorem ipsum '.repeat(50);
    const propsWithLongExcerpt: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        excerpt: longExcerpt
      },
      truncateExcerpt: 50
    };
    
    render(<BlogCard {...propsWithLongExcerpt} />);
    
    const excerpt = screen.getByText(/Lorem ipsum/);
    expect(excerpt.textContent).toBeTruthy();
    expect(excerpt.textContent?.endsWith('…')).toBe(true);
    expect((excerpt.textContent ?? '').length).toBeLessThanOrEqual(51);
  });

  it('displays featured badge when featured', () => {
    const featuredProps: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        featured: true
      }
    };
    
    render(<BlogCard {...featuredProps} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('handles onClick event', () => {
    const onClick = jest.fn();
    const propsWithClick: BlogCardProps = {
      ...defaultProps,
      onClick
    };
    
    render(<BlogCard {...propsWithClick} />);
    
    const card = screen.getByRole('article');
    fireEvent.click(card);
    
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('displays stats when showStats is true', () => {
    const propsWithStats: BlogCardProps = {
      ...defaultProps,
      showStats: true
    };
    
    render(<BlogCard {...propsWithStats} />);
    
    expect(screen.getByText('150')).toBeInTheDocument(); // views
    expect(screen.getByText('42')).toBeInTheDocument(); // likes
    expect(screen.getByText('10')).toBeInTheDocument(); // comments
  });

  it('hides author avatar when showAuthorAvatar is false', () => {
    const propsWithoutAvatar: BlogCardProps = {
      ...defaultProps,
      showAuthorAvatar: false
    };
    
    render(<BlogCard {...propsWithoutAvatar} />);
    
    const avatar = screen.queryByAltText('John Doe');
    expect(avatar).not.toBeInTheDocument();
  });

  it('displays categories when showCategories is true', () => {
    const propsWithCategories: BlogCardProps = {
      ...defaultProps,
      showCategories: true
    };
    
    render(<BlogCard {...propsWithCategories} />);
    
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('handles different image aspect ratios', () => {
    const aspectRatios: Array<'16:9' | '4:3' | '1:1' | '3:2'> = ['16:9', '4:3', '1:1', '3:2'];
    
    aspectRatios.forEach(ratio => {
      const { container } = render(
        <BlogCard {...defaultProps} imageAspectRatio={ratio} />
      );
      
      const image = container.querySelector('img');
      expect(image).toBeInTheDocument();
    });
  });

  it('formats dates correctly', () => {
    const recentProps: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        publishDate: new Date().toISOString()
      }
    };
    
    render(<BlogCard {...recentProps} />);
    const timeElement = screen.getByText((content, element) => {
      return element?.tagName === 'TIME' && content.trim() === 'Today';
    });
    expect(timeElement).toBeInTheDocument();
  });

  it('displays updated date when different from publish date', () => {
    const propsWithUpdate: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        publishDate: '2024-01-01',
        updatedDate: '2024-01-15'
      }
    };
    
    render(<BlogCard {...propsWithUpdate} />);
    expect(screen.getByText(/Updated\s/)).toBeInTheDocument();
  });

  it('handles missing thumbnail gracefully', () => {
    const propsWithoutImage: BlogCardProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        thumbnail: undefined
      }
    };
    
    render(<BlogCard {...propsWithoutImage} />);
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('applies hover effects', () => {
    const { container } = render(<BlogCard {...defaultProps} />);
    const card = container.querySelector('.blog-card');
    
    expect(card).toHaveClass('group');
    expect(card).toHaveClass('transition-shadow');
    expect(card).toHaveAttribute('data-layout', 'grid');
  });

  it('displays correct ARIA attributes', () => {
    render(<BlogCard {...defaultProps} />);
    
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-labelledby', 'blog-card-1-title');
    
    const title = screen.getByText('Test Blog Post');
    expect(title).toHaveAttribute('id', 'blog-card-1-title');
  });

  it('handles different variants correctly', () => {
    const variants = ['default', 'minimal', 'detailed', 'compact'] as const;
    
    variants.forEach(variant => {
      const { container } = render(
        <BlogCard {...defaultProps} variant={variant} />
      );
      
      expect(container.querySelector(`.blog-card--${variant}`)).toBeInTheDocument();
    });
  });

  it('supports list layout', () => {
    const { container } = render(
      <BlogCard {...defaultProps} layout="list" />
    );

    const card = container.querySelector('.blog-card');
    expect(card).toHaveAttribute('data-layout', 'list');
  });

  it('renders a read more link when slug is provided', () => {
    render(<BlogCard {...defaultProps} />);
    const cta = screen.getByRole('link', { name: /Read more about Test Blog Post/i });
    expect(cta).toHaveAttribute('href', 'test-blog-post');
  });
});
