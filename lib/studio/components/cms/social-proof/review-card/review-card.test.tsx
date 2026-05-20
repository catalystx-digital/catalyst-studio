import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ReviewCard } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { ReviewCardContent } from './review-card.types';

describe('ReviewCard', () => {
  const mockContent: ReviewCardContent = {
    rating: 4.5,
    reviewText:
      'This product exceeded my expectations. The quality is outstanding and the customer service was exceptional. I would definitely recommend this to anyone looking for a reliable solution. Even after several months, the experience continues to impress our entire team with reliable performance and thoughtful design.',
    author: 'John Smith',
    date: new Date('2024-01-15'),
    verified: true,
    platform: 'google',
    helpful: {
      yes: 42,
      no: 3,
    },
  };

  const defaultProps = {
    id: 'review-card-1',
    type: ComponentType.Reviews,
    category: ComponentCategory.SocialProof,
    content: mockContent,
  };

  it('renders with required props and shows rating tooltip trigger', () => {
    render(<ReviewCard {...defaultProps} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByLabelText('4.5 out of 5 stars')).toBeInTheDocument();
  });

  it('handles minimal content gracefully', () => {
    const minimalContent: ReviewCardContent = {
      rating: 3,
      reviewText: 'Good product',
      author: 'Test User',
      date: new Date(),
    };

    render(<ReviewCard {...defaultProps} content={minimalContent} />);

    expect(screen.getByText('Good product')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders star count equal to the scale', () => {
    render(<ReviewCard {...defaultProps} />);

    const starGroup = screen.getByTestId('review-rating-stars');
    expect(within(starGroup).getAllByTestId('review-rating-star')).toHaveLength(
      5,
    );
  });

  it('toggles expansion state when read more is clicked', async () => {
    const user = userEvent.setup();
    render(<ReviewCard {...defaultProps} />);

    const readMore = screen.getByRole('button', { name: 'Read more' });
    await user.click(readMore);

    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    expect(
      screen.getByText(/I would definitely recommend this/i),
    ).toBeInTheDocument();
  });

  it('renders verified badge when verified is true', () => {
    render(<ReviewCard {...defaultProps} />);

    expect(screen.getByLabelText('Verified purchase')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('omits verified badge when flag is false', () => {
    render(
      <ReviewCard
        {...defaultProps}
        content={{ ...mockContent, verified: false }}
      />,
    );

    expect(screen.queryByLabelText('Verified purchase')).not.toBeInTheDocument();
  });

  it('displays platform badge text when platform provided', () => {
    render(<ReviewCard {...defaultProps} />);

    expect(screen.getByText('google')).toBeInTheDocument();
  });

  it('renders platform logo when provided', () => {
    render(
      <ReviewCard
        {...defaultProps}
        content={{
          ...mockContent,
          platform: undefined,
          platformName: 'Custom Platform',
          platformLogo: 'https://example.com/logo.png',
        }}
      />,
    );

    expect(screen.getByAltText('Custom Platform')).toHaveAttribute(
      'src',
      'https://example.com/logo.png',
    );
  });

  it('shows helpful actions when counts provided and fires interaction events', async () => {
    const user = userEvent.setup();
    const onInteraction = jest.fn();

    render(<ReviewCard {...defaultProps} onInteraction={onInteraction} />);

    expect(screen.getByText('Was this helpful?')).toBeInTheDocument();
    const yesButton = screen.getByRole('button', { name: /42/ });
    await user.click(yesButton);
    expect(onInteraction).toHaveBeenCalledWith('helpful-click', {
      reviewId: 'review-card-1',
      vote: 'yes',
    });
  });

  it('sanitizes review HTML content', () => {
    render(
      <ReviewCard
        {...defaultProps}
        content={{
          ...mockContent,
          reviewText: 'Great <strong>product</strong>! <script>alert("XSS")</script>',
        }}
      />,
    );

    const reviewElement = screen.getByText((_, element) =>
      Boolean(element?.innerHTML === 'Great <strong>product</strong>! '),
    );
    expect(reviewElement).toBeInTheDocument();
    expect(screen.queryByText('alert("XSS")')).not.toBeInTheDocument();
  });

  it('applies theme classes to the wrapper', () => {
    const { rerender } = render(<ReviewCard {...defaultProps} theme="dark" />);

    const card = screen.getByTestId('review-card');
    expect(card.className).toContain('theme-dark');

    rerender(<ReviewCard {...defaultProps} theme="light" />);
    expect(card.className).toContain('theme-light');
  });

  it('exposes component metadata attributes and sizing utility', () => {
    render(<ReviewCard {...defaultProps} />);

    const card = screen.getByTestId('review-card');
    expect(card).toHaveAttribute('data-component-type', ComponentType.Reviews);
    expect(card).toHaveAttribute('data-category', ComponentCategory.SocialProof);
    expect(card.className).toContain('max-w-sm');
  });
});
