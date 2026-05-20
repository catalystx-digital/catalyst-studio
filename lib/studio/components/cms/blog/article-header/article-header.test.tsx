import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import ArticleHeader from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { ArticleHeaderProps } from './article-header.types';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, ...props }: any) => {
    return <img {...props} />;
  },
}));

// Mock performance tracking HOC
jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

// Mock window.open for share buttons
global.open = jest.fn();

describe('ArticleHeader Component', () => {
  const defaultProps: ArticleHeaderProps = {
    id: 'article-header-1',
    type: ComponentType.ArticleHeader,
    category: ComponentCategory.Blog,
    content: {
      title: 'Understanding React Hooks',
      subtitle: 'A comprehensive guide to modern React development',
      author: {
        name: 'Jane Developer',
        avatar: '/jane-avatar.jpg',
        title: 'Senior React Developer'
      },
      publishDate: '2024-01-15',
      updatedDate: '2024-01-20',
      readingTime: 10,
      categories: ['React', 'JavaScript', 'Web Development'],
      tags: ['hooks', 'useState', 'useEffect'],
      featuredImage: {
        src: '/featured-image.jpg',
        alt: 'React Hooks Diagram',
        caption: 'Visual representation of React Hooks',
        credit: 'Jane Developer'
      },
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/blog' },
        { label: 'React', href: '/blog/react' }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with required props', () => {
    render(<ArticleHeader {...defaultProps} />);
    
    expect(screen.getByText('Understanding React Hooks')).toBeInTheDocument();
    expect(screen.getByText('A comprehensive guide to modern React development')).toBeInTheDocument();
    expect(screen.getByText('Jane Developer')).toBeInTheDocument();
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('10 min read')).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<ArticleHeader {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('passes accessibility audit', async () => {
    const { container } = render(<ArticleHeader {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes user content properly', () => {
    const propsWithXSS: ArticleHeaderProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>React Hooks',
        subtitle: '<img src=x onerror=alert("XSS")>Guide',
        author: {
          ...defaultProps.content.author,
          name: '<b>Jane</b> Developer'
        }
      }
    };
    
    render(<ArticleHeader {...propsWithXSS} />);
    
    expect(screen.queryByText(/script/)).not.toBeInTheDocument();
    expect(screen.getByText('React Hooks')).toBeInTheDocument();
    expect(screen.getByText('Guide')).toBeInTheDocument();
    expect(screen.getByText('Jane Developer')).toBeInTheDocument();
  });

  it('displays breadcrumbs when showBreadcrumbs is true', () => {
    render(<ArticleHeader {...defaultProps} showBreadcrumbs={true} />);

    const navs = screen.getAllByLabelText('Breadcrumb');
    expect(navs.length).toBeGreaterThan(0);

    navs.forEach(nav => {
      const utils = within(nav);
      expect(utils.getByText('Home')).toBeInTheDocument();
      expect(utils.getByText('Blog')).toBeInTheDocument();
      expect(utils.getByText('React')).toBeInTheDocument();
    });
  });

  it('hides breadcrumbs when showBreadcrumbs is false', () => {
    render(<ArticleHeader {...defaultProps} showBreadcrumbs={false} />);
    
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Blog')).not.toBeInTheDocument();
  });

  it('displays featured image with correct position', () => {
    const positions: Array<'above' | 'below' | 'background'> = ['above', 'below', 'background'];
    
    positions.forEach(position => {
      const { container } = render(
        <ArticleHeader {...defaultProps} imagePosition={position} />
      );
      
      const image = container.querySelector('img[alt="React Hooks Diagram"]');
      expect(image).toBeInTheDocument();
    });
  });

  it('displays image caption and credit', () => {
    render(<ArticleHeader {...defaultProps} />);
    
    expect(screen.getByText('Visual representation of React Hooks')).toBeInTheDocument();
    expect(screen.getByText('Credit: Jane Developer')).toBeInTheDocument();
  });

  it('handles category click events', () => {
    const onCategoryClick = jest.fn();
    const propsWithClick: ArticleHeaderProps = {
      ...defaultProps,
      onCategoryClick
    };
    
    render(<ArticleHeader {...propsWithClick} />);
    
    const reactCategory = screen.getByRole('button', { name: /React/i });
    fireEvent.click(reactCategory);
    
    expect(onCategoryClick).toHaveBeenCalledWith('React');
  });

  it('handles tag click events', () => {
    const onTagClick = jest.fn();
    const propsWithClick: ArticleHeaderProps = {
      ...defaultProps,
      onTagClick
    };
    
    render(<ArticleHeader {...propsWithClick} />);
    
    const hooksTag = screen.getByRole('button', { name: /#hooks/i });
    fireEvent.click(hooksTag);
    
    expect(onTagClick).toHaveBeenCalledWith('hooks');
  });

  it('displays share buttons when showShareButtons is true', () => {
    render(<ArticleHeader {...defaultProps} showShareButtons={true} />);
    
    expect(screen.getByLabelText('Share on Twitter')).toBeInTheDocument();
    expect(screen.getByLabelText('Share on LinkedIn')).toBeInTheDocument();
    expect(screen.getByLabelText('Share on Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy link')).toBeInTheDocument();
  });

  it('handles share button clicks', () => {
    const onShare = jest.fn();
    const propsWithShare: ArticleHeaderProps = {
      ...defaultProps,
      onShare,
      showShareButtons: true
    };
    
    render(<ArticleHeader {...propsWithShare} />);
    
    const twitterButton = screen.getByLabelText('Share on Twitter');
    fireEvent.click(twitterButton);
    
    expect(onShare).toHaveBeenCalledWith('twitter');
    expect(global.open).toHaveBeenCalled();
  });

  it('formats dates correctly', () => {
    render(<ArticleHeader {...defaultProps} />);
    
    expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('Updated January 20, 2024')).toBeInTheDocument();
  });

  it('does not display updated date when same as publish date', () => {
    const propsWithoutUpdate: ArticleHeaderProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        updatedDate: '2024-01-15' // Same as publishDate
      }
    };
    
    render(<ArticleHeader {...propsWithoutUpdate} />);
    
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalProps: ArticleHeaderProps = {
      ...defaultProps,
      content: {
        title: 'Minimal Article',
        author: { name: 'Author' },
        publishDate: '2024-01-01'
      }
    };
    
    render(<ArticleHeader {...minimalProps} />);
    
    expect(screen.getByText('Minimal Article')).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
  });

  it('displays correct ARIA attributes', () => {
    render(<ArticleHeader {...defaultProps} />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('aria-label', 'Article header');
    
    const breadcrumbNav = screen.getByLabelText('Breadcrumb');
    expect(breadcrumbNav).toBeInTheDocument();
  });

  it('applies correct theme classes', () => {
    const themes = ['light', 'dark', 'auto', 'inverted'] as const;
    
    themes.forEach(theme => {
      const { container } = render(
        <ArticleHeader {...defaultProps} theme={theme} />
      );
      
      const expectedTheme = theme === 'auto' ? 'light' : theme;
      expect(container.querySelector('[data-theme="' + expectedTheme + '"]')).toBeInTheDocument();
    });
  });

  it('handles background image positioning correctly', () => {
    const propsWithBackground: ArticleHeaderProps = {
      ...defaultProps,
      imagePosition: 'background'
    };
    
  const { container } = render(<ArticleHeader {...propsWithBackground} />);
  
  // Check for background image overlay
  expect(container.querySelector('.bg-gradient-to-t')).toBeInTheDocument();
  const heading = container.querySelector('h1');
  expect(heading).toHaveClass('ds-heading-1', 'theme-dark', 'text-text-primary');
  });

  it('calculates default reading time when not provided', () => {
    const propsWithoutReadingTime: ArticleHeaderProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        readingTime: undefined
      }
    };
    
    render(<ArticleHeader {...propsWithoutReadingTime} />);
    
    // Should default to 5 minutes
    expect(screen.getByText('5 min read')).toBeInTheDocument();
  });
});
