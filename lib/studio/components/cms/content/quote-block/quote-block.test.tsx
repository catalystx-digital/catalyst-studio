import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuoteBlock } from './index';
import type { QuoteBlockProps } from './quote-block.types';

const mockContent: QuoteBlockProps['content'] = {
  heading: 'Customer Testimonial',
  subheading: 'What our clients say',
  quote:
    'This product has transformed our business. The results have been exceptional and exceeded all our expectations.',
  attribution: {
    author: 'Jane Smith',
    title: 'CEO',
    organization: 'Tech Corp',
    image: '/images/jane.jpg',
    date: 'January 2024',
  },
  style: 'testimonial',
  align: 'center',
  size: 'large',
};

describe('CMSComponent: QuoteBlock', () => {
  beforeEach(() => {
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    (window.open as jest.Mock).mockRestore();
  });

  it('renders with required props', () => {
    render(<QuoteBlock content={{ quote: 'Test quote' }} />);

    expect(screen.getByText('Test quote')).toBeInTheDocument();
  });

  it('renders heading and subheading', () => {
    render(<QuoteBlock content={mockContent} />);

    expect(screen.getByText('Customer Testimonial')).toBeInTheDocument();
    expect(screen.getByText('What our clients say')).toBeInTheDocument();
  });

  it('renders quote content correctly', () => {
    render(<QuoteBlock content={mockContent} />);

    const quote = screen.getByText(/This product has transformed our business/);
    expect(quote).toBeInTheDocument();
  });

  it('renders attribution information', () => {
    render(<QuoteBlock content={mockContent} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('January 2024')).toBeInTheDocument();
  });

  it('sanitizes HTML in quote content', () => {
    const contentWithHTML = {
      quote: 'This is <b>bold</b> and <script>alert("xss")</script> safe.',
    };

    const { container } = render(<QuoteBlock content={contentWithHTML} />);

    expect(screen.getByText(/This is/)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('applies quote style classes', () => {
    render(<QuoteBlock content={mockContent} />);

    const wrapper = screen.getByTestId('cms-quote-block');
    expect(wrapper).toHaveClass('shadow-lg');
    expect(wrapper).toHaveAttribute('data-style', 'testimonial');
  });

  it('applies alignment classes', () => {
    render(<QuoteBlock content={mockContent} />);

    const wrapper = screen.getByTestId('cms-quote-block');
    expect(wrapper).toHaveAttribute('data-align', 'center');
  });

  it('applies size classes', () => {
    render(<QuoteBlock content={mockContent} />);

    const wrapper = screen.getByTestId('cms-quote-block');
    const quote = wrapper.querySelector('blockquote p');

    expect(wrapper).toHaveAttribute('data-size', 'large');
    expect(quote?.className ?? '').toContain('text-2xl');
  });

  it('renders quote icon by default', () => {
    render(<QuoteBlock content={mockContent} />);

    expect(screen.getByTestId('cms-quote-icon')).toBeInTheDocument();
  });

  it('hides icon when icon is none', () => {
    const contentNoIcon = { ...mockContent, icon: 'none' as const };
    render(<QuoteBlock content={contentNoIcon} />);

    expect(screen.queryByTestId('cms-quote-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cms-quote-icon-custom')).not.toBeInTheDocument();
  });

  it('renders custom icon', () => {
    const contentCustomIcon = {
      ...mockContent,
      icon: 'custom' as const,
      customIcon: '💬',
    };
    render(<QuoteBlock content={contentCustomIcon} />);

    expect(screen.getByTestId('cms-quote-icon-custom')).toHaveTextContent('💬');
  });

  it('shows share menu on click in detailed variant', () => {
    render(<QuoteBlock content={mockContent} variant="detailed" />);

    const shareButton = screen.getByLabelText('Share quote');
    fireEvent.click(shareButton);

    expect(screen.getByText('Share on Twitter')).toBeInTheDocument();
    expect(screen.getByText('Share on LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Share on Facebook')).toBeInTheDocument();
  });

  it('handles share actions', () => {
    const onShare = jest.fn();

    render(
      <QuoteBlock content={mockContent} variant="detailed" onShare={onShare} />,
    );

    const shareButton = screen.getByLabelText('Share quote');
    fireEvent.click(shareButton);

    const twitterButton = screen.getByText('Share on Twitter');
    fireEvent.click(twitterButton);

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'noopener',
    );
    expect(onShare).toHaveBeenCalledWith('twitter');
  });

  it('applies different quote styles', () => {
    const styles = [
      'default',
      'bordered',
      'highlighted',
      'testimonial',
      'pullquote',
    ] as const;

    styles.forEach((style) => {
      const { getByTestId, unmount } = render(
        <QuoteBlock content={{ ...mockContent, style }} />,
      );
      const wrapper = getByTestId('cms-quote-block');

      expect(wrapper).toHaveAttribute('data-style', style);

      if (style === 'bordered') {
        expect(wrapper).toHaveClass('border-l-4');
      } else if (style === 'testimonial') {
        expect(wrapper).toHaveClass('shadow-lg');
      } else if (style === 'pullquote') {
        expect(wrapper).toHaveClass('bg-background-secondary/70');
      }

      unmount();
    });
  });

  it('applies theme and variant classes', () => {
    const { container } = render(
      <QuoteBlock
        content={mockContent}
        theme="dark"
        variant="expanded"
        className="custom-class"
      />,
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-variant', 'expanded');
  });

  it('meets accessibility standards', () => {
    render(<QuoteBlock content={mockContent} />);

    const blockquote = screen.getByRole('blockquote');
    expect(blockquote).toBeInTheDocument();

    const cite = screen.getByText('Jane Smith').closest('cite');
    expect(cite).toBeInTheDocument();
  });

  it('performs within 50ms threshold', () => {
    const startTime = performance.now();
    render(<QuoteBlock content={mockContent} />);
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('handles highlight prop', () => {
    const highlightedContent = { ...mockContent, highlight: true };
    render(<QuoteBlock content={highlightedContent} />);

    const wrapper = screen.getByTestId('cms-quote-block');
    const quote = wrapper.querySelector('blockquote p');
    expect(wrapper).toHaveAttribute('data-highlight', 'true');
    expect(quote).toHaveClass('text-accent-orange');
  });

  it('renders without attribution', () => {
    const contentNoAttribution = { quote: 'Anonymous quote' };
    render(<QuoteBlock content={contentNoAttribution} />);

    expect(screen.getByText('Anonymous quote')).toBeInTheDocument();
    expect(document.querySelector('cite')).not.toBeInTheDocument();
  });
});
