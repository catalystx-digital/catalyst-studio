import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CTABanner from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';

describe('CTABanner Component', () => {
  const baseProps = {
    id: 'cta-banner-test',
    type: ComponentType.CTABanner,
    category: ComponentCategory.CTA,
    content: {
      heading: 'Ready to launch?',
      subheading: 'Deploy your Catalyst site with a single click.',
      primaryButton: {
        text: 'Get Started',
        url: '/start',
      },
      secondaryButton: {
        text: 'Contact Sales',
        url: '/contact',
      },
      alignment: 'center' as const,
    },
  };

  it('renders heading and subheading copy', () => {
    render(<CTABanner {...baseProps} />);

    expect(screen.getByText('Ready to launch?')).toBeInTheDocument();
    expect(
      screen.getByText('Deploy your Catalyst site with a single click.'),
    ).toBeInTheDocument();
  });

  it('fires interaction callbacks for primary and secondary buttons', () => {
    const onInteraction = jest.fn();
    render(
      <CTABanner
        {...baseProps}
        onInteraction={onInteraction}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Get Started' }));
    fireEvent.click(screen.getByRole('link', { name: 'Contact Sales' }));

    expect(onInteraction).toHaveBeenCalledWith('primary-cta-click', '/start');
    expect(onInteraction).toHaveBeenCalledWith('secondary-cta-click', '/contact');
    expect(onInteraction).toHaveBeenCalledTimes(2);
  });

  it('applies background image styles when provided', () => {
    render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          backgroundImage: 'https://example.com/banner.png',
        }}
      />,
    );

    const card = screen.getByTestId('cta-banner-card');
    expect(card.style.backgroundImage).toContain('banner.png');
  });

  it('renders fallback alert when no buttons are provided', () => {
    render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          primaryButton: undefined as any,
          secondaryButton: undefined,
        }}
      />,
    );

    expect(
      screen.getByText(
        'Configure primary or secondary buttons to display call-to-action links.',
      ),
    ).toBeInTheDocument();
  });
});
