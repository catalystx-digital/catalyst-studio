import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentType, ComponentCategory } from '../../_core/types';

jest.mock('../../_factory/renderer.server', () => ({
  renderCMSComponents: jest.fn(async (components: unknown[]) => {
    if (!Array.isArray(components)) {
      return [];
    }

    return components.map((_, index) => (
      <div data-testid="mock-cms-component" key={`mock-${index}`} />
    ));
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img {...rest} />
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TwoColumn } = require('./index');

describe('TwoColumn Component', () => {
  const defaultProps = {
    id: 'test-two-column',
    type: ComponentType.TwoColumn,
    category: ComponentCategory.Content,
    content: {
      leftColumn: {
        type: 'text' as const,
        heading: 'Left Heading',
        body: '<p>Left column text content</p>'
      },
      rightColumn: {
        type: 'text' as const,
        heading: 'Right Heading',
        body: '<p>Right column text content</p>'
      },
      columnRatio: '50-50' as const
    }
  };

  it('renders both columns with text content', () => {
    render(<TwoColumn {...defaultProps} />);
    expect(screen.getByText('Left Heading')).toBeInTheDocument();
    expect(screen.getByText('Right Heading')).toBeInTheDocument();
    expect(screen.getByText('Left column text content')).toBeInTheDocument();
    expect(screen.getByText('Right column text content')).toBeInTheDocument();
  });

  it('renders text and image columns', () => {
    const mixedProps = {
      ...defaultProps,
      content: {
        leftColumn: {
          type: 'text' as const,
          heading: 'Text Column',
          body: '<p>Text content</p>'
        },
        rightColumn: {
          type: 'image' as const,
          imageUrl: '/test-image.jpg',
          imageAlt: 'Test image'
        }
      }
    };
    
    render(<TwoColumn {...mixedProps} />);
    expect(screen.getByText('Text Column')).toBeInTheDocument();
    expect(screen.getByAltText('Test image')).toBeInTheDocument();
  });

  it('applies correct column ratio classes', () => {
    render(<TwoColumn {...defaultProps} />);
    expect(screen.getByTestId('two-column-grid')).toHaveClass('lg:grid-cols-2');
  });

  it('applies theme classes correctly', () => {
    const { container, rerender } = render(<TwoColumn {...defaultProps} />);
    expect(container.firstChild).toHaveClass('cms-card');

    rerender(<TwoColumn {...defaultProps} theme="dark" />);
    expect(container.firstChild).toHaveClass('theme-dark');
  });

  it('applies gap classes based on gap prop', () => {
    const { rerender } = render(
      <TwoColumn {...defaultProps} content={{ ...defaultProps.content, gap: 'small' }} />
    );
    expect(screen.getByTestId('two-column-grid')).toHaveClass('ds-gap-md');

    rerender(
      <TwoColumn {...defaultProps} content={{ ...defaultProps.content, gap: 'large' }} />
    );
    expect(screen.getByTestId('two-column-grid')).toHaveClass('ds-gap-2xl');
  });

  it('applies vertical alignment classes', () => {
    const { rerender } = render(
      <TwoColumn {...defaultProps} content={{ ...defaultProps.content, verticalAlignment: 'center' }} />
    );
    expect(screen.getByTestId('two-column-grid')).toHaveClass('items-center');

    rerender(
      <TwoColumn {...defaultProps} content={{ ...defaultProps.content, verticalAlignment: 'bottom' }} />
    );
    expect(screen.getByTestId('two-column-grid')).toHaveClass('items-end');
  });

  it('sanitizes HTML in text columns', () => {
    const dangerousProps = {
      ...defaultProps,
      content: {
        leftColumn: {
          type: 'text' as const,
          body: '<p>Safe content</p><script>alert("XSS")</script>'
        },
        rightColumn: {
          type: 'text' as const,
          body: '<p>Also safe</p>'
        }
      }
    };
    
    render(<TwoColumn {...dangerousProps} />);
    expect(screen.getByText('Safe content')).toBeInTheDocument();
    expect(screen.queryByText('alert("XSS")')).not.toBeInTheDocument();
  });

  it('renders video column correctly', () => {
    const videoProps = {
      ...defaultProps,
      content: {
        leftColumn: {
          type: 'text' as const,
          heading: 'Text'
        },
        rightColumn: {
          type: 'video' as const,
          videoUrl: '/test-video.mp4'
        }
      }
    };
    
    const { container } = render(<TwoColumn {...videoProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.querySelector('source')).toHaveAttribute('src', '/test-video.mp4');
  });

  it('applies custom className and styles', () => {
    const { container } = render(
      <TwoColumn {...defaultProps} className="custom-class" style={{ padding: '20px' }} />
    );
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveStyle({ padding: '20px' });
  });

  it('includes analytics data attributes', () => {
    const { container } = render(<TwoColumn {...defaultProps} analyticsId="two-col-001" />);
    expect(container.firstChild).toHaveAttribute('data-analytics-id', 'two-col-001');
    expect(container.firstChild).toHaveAttribute('data-component-type', 'two-column');
  });
});
