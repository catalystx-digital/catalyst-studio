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
        label: 'Get Started',
        href: { type: 'internal', pageId: 'start', path: '/start' },
      },
      secondaryButton: {
        label: 'Contact Sales',
        href: { type: 'internal', pageId: 'contact', path: '/contact' },
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

  it('renders structured SmartLink button defaults', () => {
    render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          primaryButton: {
            label: 'Sign Up Now',
            href: { type: 'internal', pageId: 'signup', path: '/signup' },
            variant: 'primary',
          },
          secondaryButton: {
            label: 'Learn More',
            href: { type: 'external', url: 'https://example.com/features' },
            variant: 'outline',
          },
        }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Sign Up Now' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute('href', 'https://example.com/features');
  });

  it('applies background image styles when provided', () => {
    const { container } = render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          backgroundImage: 'https://example.com/banner.png',
        }}
      />,
    );

    const card = container.querySelector('.cms-cta-banner .rounded-xl') as HTMLElement;
    expect(card.style.backgroundImage).toContain('banner.png');
  });

  it('adds a contrast overlay for image-backed banners', () => {
    const { container } = render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          backgroundImage: 'https://example.com/banner.png',
        }}
      />,
    );

    expect(container.querySelector('.bg-gradient-to-r.from-black\\/70')).toBeInTheDocument();
  });

  it('does not render object-shaped background images', () => {
    const { container } = render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          backgroundImage: {
            url: {
              url: 'https://example.com/media-banner.png',
              mediaId: 'media-1',
              mediaType: 'image',
            },
          } as any,
        }}
      />,
    );

    const card = container.querySelector('.cms-cta-banner .rounded-xl') as HTMLElement;
    expect(card.style.backgroundImage).not.toContain('[object Object]');
    expect(card.style.backgroundImage).toBe('');
  });

  it('omits links when no buttons are provided', () => {
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

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not render legacy text/url buttons', () => {
    render(
      <CTABanner
        {...baseProps}
        content={{
          ...baseProps.content,
          primaryButton: {
            text: 'Legacy',
            url: '/legacy',
          } as any,
          secondaryButton: undefined,
        }}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Legacy' })).not.toBeInTheDocument();
  });
});
