import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import AuthorBio from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { AuthorBioProps } from './author-bio.types';

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

// Mock window.open for social links
global.open = jest.fn();

describe('AuthorBio Component', () => {
  const defaultProps: AuthorBioProps = {
    id: 'author-bio-1',
    type: ComponentType.AuthorBio,
    category: ComponentCategory.Blog,
    content: {
      name: 'Jane Developer',
      title: 'Senior React Developer',
      bio: 'Passionate about building scalable web applications with React and TypeScript. Over 10 years of experience in frontend development.',
      photo: '/jane-photo.jpg',
      email: 'jane@example.com',
      website: 'https://janedeveloper.com',
      socialLinks: {
        twitter: 'https://twitter.com/janedev',
        linkedin: 'https://linkedin.com/in/janedev',
        github: 'https://github.com/janedev'
      },
      stats: {
        articlesCount: 42,
        followersCount: 1500,
        yearsExperience: 10
      },
      expertise: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      expandable: true,
      maxBioLength: 100
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with required props', () => {
    render(<AuthorBio {...defaultProps} />);
    
    expect(screen.getByText('Jane Developer')).toBeInTheDocument();
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText(/Passionate about building/)).toBeInTheDocument();
  });

  it('meets performance threshold (<50ms)', () => {
    const startTime = performance.now();
    render(<AuthorBio {...defaultProps} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('passes accessibility audit', async () => {
    const { container } = render(<AuthorBio {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sanitizes bio content properly', () => {
    const propsWithXSS: AuthorBioProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        name: '<script>alert("XSS")</script>Jane',
        bio: '<img src=x onerror=alert("XSS")>Malicious bio <b>with bold</b> text'
      }
    };
    
    render(<AuthorBio {...propsWithXSS} />);
    
    expect(screen.queryByText(/script/)).not.toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    // Bold tag should be preserved by sanitizeHtml
    const bioElement = screen.getByText(/Malicious bio/);
    expect(bioElement.innerHTML).toContain('<b>with bold</b>');
  });

  it('validates social media URLs', () => {
    const propsWithInvalidUrls: AuthorBioProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        website: 'not-a-valid-url',
        socialLinks: {
          twitter: 'javascript:alert("XSS")',
          linkedin: 'https://linkedin.com/in/janedev'
        }
      }
    };
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    render(<AuthorBio {...propsWithInvalidUrls} />);
    
    // Valid LinkedIn link should be present
    expect(screen.getByLabelText('Follow on linkedin')).toBeInTheDocument();
    
    // Invalid links should trigger warnings
    fireEvent.click(screen.getByLabelText('Visit website'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid URL'));
    
    consoleSpy.mockRestore();
  });

  it('displays stats when showStats is true', () => {
    render(<AuthorBio {...defaultProps} showStats={true} />);
    
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Articles')).toBeInTheDocument();
    expect(screen.getByText('1.5k')).toBeInTheDocument(); // 1500 followers formatted
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Years Exp.')).toBeInTheDocument();
  });

  it('hides stats when showStats is false', () => {
    render(<AuthorBio {...defaultProps} showStats={false} />);
    
    expect(screen.queryByText('Articles')).not.toBeInTheDocument();
    expect(screen.queryByText('Followers')).not.toBeInTheDocument();
  });

  it('displays expertise when showExpertise is true', () => {
    render(<AuthorBio {...defaultProps} showExpertise={true} />);
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();
  });

  it('handles expandable bio correctly', () => {
    const longBio = 'Lorem ipsum dolor sit amet, '.repeat(10); // Long bio text
    const propsWithLongBio: AuthorBioProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        bio: longBio,
        expandable: true,
        maxBioLength: 50
      }
    };
    
    render(<AuthorBio {...propsWithLongBio} />);
    
    // Bio should be truncated initially
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    expect(screen.getByText('Read more')).toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText('Read more'));
    
    // Bio should be expanded
    expect(screen.getByText('Show less')).toBeInTheDocument();
    expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
  });

  it('handles follow button click', () => {
    const onFollowClick = jest.fn();
    const propsWithFollow: AuthorBioProps = {
      ...defaultProps,
      onFollowClick
    };
    
    render(<AuthorBio {...propsWithFollow} />);
    
    fireEvent.click(screen.getByText('Follow'));
    expect(onFollowClick).toHaveBeenCalledTimes(1);
  });

  it('handles social link clicks', () => {
    const onSocialClick = jest.fn();
    const propsWithSocialClick: AuthorBioProps = {
      ...defaultProps,
      onSocialClick
    };
    
    render(<AuthorBio {...propsWithSocialClick} />);
    
    fireEvent.click(screen.getByLabelText('Follow on twitter'));
    
    expect(onSocialClick).toHaveBeenCalledWith('twitter', 'https://twitter.com/janedev');
    expect(global.open).toHaveBeenCalledWith(
      'https://twitter.com/janedev',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('displays different layouts correctly', () => {
    const layouts: Array<'horizontal' | 'vertical' | 'compact'> = ['horizontal', 'vertical', 'compact'];
    
    layouts.forEach(layout => {
      const { container } = render(
        <AuthorBio {...defaultProps} layout={layout} />
      );
      
      const root = container.querySelector(`[data-layout="${layout}"]`);
      expect(root).toBeInTheDocument();
    });
  });

  it('handles missing photo gracefully', () => {
    const propsWithoutPhoto: AuthorBioProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        photo: undefined
      }
    };
    
    render(<AuthorBio {...propsWithoutPhoto} />);
    
    expect(screen.getByText('Jane Developer')).toBeInTheDocument();
    expect(screen.queryByAltText('Jane Developer')).not.toBeInTheDocument();
  });

  it('formats follower count correctly', () => {
    const testCases = [
      { count: 999, expected: '999' },
      { count: 1000, expected: '1k' },
      { count: 1500, expected: '1.5k' },
      { count: 10000, expected: '10k' }
    ];
    
    testCases.forEach(({ count, expected }) => {
      const props: AuthorBioProps = {
        ...defaultProps,
        content: {
          ...defaultProps.content,
          stats: { followersCount: count }
        }
      };
      
      const { rerender } = render(<AuthorBio {...props} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      rerender(<></>); // Cleanup for next iteration
    });
  });

  it('displays email link when provided', () => {
    render(<AuthorBio {...defaultProps} />);
    
    const emailButton = screen.getByLabelText('Email author');
    fireEvent.click(emailButton);
    
    expect(global.open).toHaveBeenCalledWith(
      'mailto:jane@example.com',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('displays correct ARIA attributes', () => {
    const { container } = render(<AuthorBio {...defaultProps} />);
    
    const authorBio = container.querySelector('[role="complementary"]');
    expect(authorBio).toHaveAttribute('aria-label', 'Author information');
    
    const expandButton = screen.queryByText('Read more');
    if (expandButton) {
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('handles compact layout with smaller photo', () => {
    const { container } = render(
      <AuthorBio {...defaultProps} layout="compact" />
    );
    
    const avatar = container.querySelector('.cms-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('h-16', { exact: false });
    expect(avatar).toHaveClass('w-16', { exact: false });
  });

  it('centers content in vertical layout', () => {
    const { container } = render(
      <AuthorBio {...defaultProps} layout="vertical" />
    );
    
    const layoutDiv = container.querySelector('.flex.flex-col.items-center.text-center');
    expect(layoutDiv).toBeInTheDocument();
  });
});
