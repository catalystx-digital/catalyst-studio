import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TestimonialSlider } from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';
import type { TestimonialSliderContent } from './testimonial-slider.types';

describe('TestimonialSlider', () => {
  const baseContent: TestimonialSliderContent = {
    testimonials: [
      {
        id: '1',
        quote: 'Great product! Highly recommend.',
        author: 'John Doe',
        role: 'CEO',
        company: 'Tech Corp',
        avatar: 'https://example.com/avatar.jpg',
        rating: 4.5,
      },
      {
        id: '2',
        quote: 'Excellent service and support.',
        author: 'Jane Smith',
        role: 'CTO',
        company: 'StartupCo',
      },
      {
        id: '3',
        quote: 'Best solution in the market.',
        author: 'Bob Johnson',
        company: 'Enterprise Inc',
      },
    ],
    autoPlayInterval: 5000,
    showNavigation: true,
    showDots: true,
    pauseOnHover: true,
  };

  const defaultProps = {
    id: 'testimonial-slider-1',
    type: ComponentType.Testimonials,
    category: ComponentCategory.SocialProof,
    analyticsId: 'slider-analytics-1',
    content: baseContent,
  };

  it('renders the first testimonial with author and quote', () => {
    render(<TestimonialSlider {...defaultProps} />);

    const container = screen.getByRole('region', {
      name: 'Customer testimonials',
    });

    expect(container).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(
      screen.getByText('Great product! Highly recommend.'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Rated 4.5 out of 5'),
    ).toBeInTheDocument();
  });

  it('navigates between testimonials when controls are used', () => {
    const onInteraction = jest.fn();
    render(<TestimonialSlider {...defaultProps} onInteraction={onInteraction} />);

    fireEvent.click(screen.getByLabelText('Next testimonial'));
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous testimonial'));
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    expect(onInteraction).toHaveBeenCalledWith(
      'testimonial-slide-change',
      expect.objectContaining({
        previousIndex: 0,
        nextIndex: 1,
        source: 'next',
      }),
    );
    expect(onInteraction).toHaveBeenCalledWith(
      'testimonial-slide-change',
      expect.objectContaining({
        previousIndex: 1,
        nextIndex: 0,
        source: 'previous',
      }),
    );
  });

  it('supports keyboard navigation', () => {
    const onInteraction = jest.fn();
    render(<TestimonialSlider {...defaultProps} onInteraction={onInteraction} />);

    const region = screen.getByRole('region');

    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    expect(onInteraction).toHaveBeenCalledWith(
      'testimonial-slide-change',
      expect.objectContaining({
        source: 'keyboard',
        nextIndex: 1,
      }),
    );
  });

  it('renders pagination buttons and changes slide when a button is clicked', () => {
    const onInteraction = jest.fn();
    render(<TestimonialSlider {...defaultProps} onInteraction={onInteraction} />);

    const tablist = screen.getByRole('tablist', { name: /pagination/i });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    fireEvent.click(screen.getByLabelText('Go to testimonial 3'));
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(onInteraction).toHaveBeenCalledWith(
      'testimonial-slide-change',
      expect.objectContaining({
        source: 'dot',
        nextIndex: 2,
      }),
    );
  });

  it('sanitizes rich text content in quotes', () => {
    const unsafeContent: TestimonialSliderContent = {
      testimonials: [
        {
          id: 'unsafe',
          quote: 'Hello <strong>World</strong><script>alert("xss")</script>',
          author: 'Security Tester',
        },
      ],
    };

    const { container } = render(
      <TestimonialSlider {...defaultProps} content={unsafeContent} />,
    );

    const quote = container.querySelector('blockquote');
    expect(quote?.innerHTML).toContain('<strong>World</strong>');
    expect(quote?.innerHTML).not.toContain('<script>');
  });

  it('falls back gracefully when optional fields are missing', () => {
    const minimalContent: TestimonialSliderContent = {
      testimonials: [
        {
          id: 'minimal',
          quote: 'Just a simple quote.',
          author: 'Anonymous',
        },
      ],
      showNavigation: false,
      showDots: false,
    };

    render(<TestimonialSlider {...defaultProps} content={minimalContent} />);

    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Previous testimonial'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: /pagination/i }),
    ).not.toBeInTheDocument();
  });

  it('returns null when there are no testimonials', () => {
    const { container } = render(
      <TestimonialSlider
        {...defaultProps}
        content={{ testimonials: [] }}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('applies theme and variant classes from props', () => {
    const { rerender } = render(
      <TestimonialSlider {...defaultProps} theme="dark" variant="minimal" />,
    );

    let region = screen.getByRole('region');
    expect(region).toHaveClass('theme-dark');

    rerender(<TestimonialSlider {...defaultProps} theme="light" variant="default" />);
    region = screen.getByRole('region');
    expect(region).toHaveClass('theme-light');
  });

  it('sets expected data attributes for analytics and metadata', () => {
    render(<TestimonialSlider {...defaultProps} />);

    const region = screen.getByRole('region');
    expect(region).toHaveAttribute(
      'data-component-type',
      ComponentType.Testimonials,
    );
    expect(region).toHaveAttribute(
      'data-category',
      ComponentCategory.SocialProof,
    );
    expect(region).toHaveAttribute('data-component-id', defaultProps.id);
    expect(region).toHaveAttribute('data-total-slides', '3');
  });
});
