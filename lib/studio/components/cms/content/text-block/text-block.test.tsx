import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextBlock } from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';

describe('TextBlock Component', () => {
  const defaultProps = {
    id: 'test-text-block',
    type: ComponentType.TextBlock,
    category: ComponentCategory.Content,
    content: {
      heading: 'Test Heading',
      subheading: 'Test Subheading',
      body: '<p>This is a test paragraph with <strong>bold text</strong> and <a href="#">a link</a>.</p>',
      alignment: 'left' as const,
    },
  };

  it('renders heading when provided', () => {
    render(<TextBlock {...defaultProps} />);
    expect(screen.getByTestId('cms-text-block-heading')).toHaveTextContent('Test Heading');
  });

  it('renders subheading when provided', () => {
    render(<TextBlock {...defaultProps} />);
    expect(screen.getByTestId('cms-text-block-subheading')).toHaveTextContent('Test Subheading');
  });

  it('renders sanitized HTML content', () => {
    render(<TextBlock {...defaultProps} />);
    expect(screen.getByText(/This is a test paragraph/)).toBeInTheDocument();
    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'a link' })).toBeInTheDocument();
  });

  it('strips dangerous HTML tags', () => {
    const dangerousProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        body: '<p>Safe content</p><script>alert("XSS")</script><iframe src="evil"></iframe>',
      },
    };
    render(<TextBlock {...dangerousProps} />);
    expect(screen.getByText('Safe content')).toBeInTheDocument();
    expect(screen.queryByText('alert("XSS")')).not.toBeInTheDocument();
    expect(screen.queryByText('evil')).not.toBeInTheDocument();
  });

  it('applies correct alignment classes', () => {
    const { rerender } = render(<TextBlock {...defaultProps} />);
    expect(screen.getByTestId('cms-text-block-body')).toHaveClass('text-left');

    rerender(
      <TextBlock
        {...defaultProps}
        content={{ ...defaultProps.content, alignment: 'center' }}
      />,
    );
    expect(screen.getByTestId('cms-text-block-body')).toHaveClass('text-center');
  });

  it('applies theme classes correctly', () => {
    const { container, rerender } = render(<TextBlock {...defaultProps} theme="light" />);
    expect(container.querySelector('.theme-light')).toBeInTheDocument();

    rerender(<TextBlock {...defaultProps} theme="dark" />);
    expect(container.querySelector('.theme-dark')).toBeInTheDocument();
  });

  it('applies column classes when specified', () => {
    const multiColumnProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        columns: 2 as const,
      },
    };
    render(<TextBlock {...multiColumnProps} />);
    const body = screen.getByTestId('cms-text-block-body');
    expect(body).toHaveClass('md:columns-2');
    expect(body).toHaveAttribute('data-columns', '2');
  });

  it('renders without heading or subheading', () => {
    const minimalProps = {
      ...defaultProps,
      content: {
        body: '<p>Just body text</p>',
      },
    };
    render(<TextBlock {...minimalProps} />);
    expect(screen.getByText('Just body text')).toBeInTheDocument();
    expect(screen.queryByTestId('cms-text-block-heading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cms-text-block-subheading')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<TextBlock {...defaultProps} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies custom styles', () => {
    const { container } = render(
      <TextBlock {...defaultProps} style={{ padding: '20px', borderRadius: '12px' }} />,
    );
    expect(container.firstChild).toHaveStyle({ padding: '20px', borderRadius: '12px' });
  });

  it('includes analytics data attributes', () => {
    const { container } = render(<TextBlock {...defaultProps} analyticsId="text-001" />);
    expect(container.firstChild).toHaveAttribute('data-analytics-id', 'text-001');
    expect(container.firstChild).toHaveAttribute('data-component-type', 'text-block');
    expect(container.firstChild).toHaveAttribute('data-variant', 'default');
  });
});
