import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ComponentCategory, ComponentType } from '../../_core/types';
import { Footer } from './index';
import type { FooterProps } from './footer.types';

describe('Footer Component', () => {
  const defaultProps: FooterProps = {
    id: 'test-footer',
    type: ComponentType.Footer,
    category: ComponentCategory.Navigation,
    content: {
      columns: [
        {
          title: 'Products',
          links: [
            { label: 'Features', href: '/features' },
            { label: 'Pricing', href: '/pricing' },
          ],
        },
        {
          title: 'Company',
          links: [
            { label: 'About', href: '/about' },
            { label: 'Contact', href: '/contact' },
          ],
        },
      ],
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com' },
        { platform: 'github', url: 'https://github.com' },
      ],
      copyright: '© 2024 Test Company',
      legalLinks: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ],
    },
  };

  it('renders without crashing', () => {
    render(<Footer {...defaultProps} />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders footer columns', () => {
    render(<Footer {...defaultProps} />);

    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('renders social links inside button wrappers', () => {
    render(<Footer {...defaultProps} />);

    const twitterLink = screen.getByLabelText('Visit our twitter');
    expect(twitterLink).toHaveAttribute('href', 'https://twitter.com');
    expect(twitterLink.closest('button')).toBeNull();
    expect(twitterLink).toHaveClass('cms-button');
  });

  it('renders copyright text', () => {
    render(<Footer {...defaultProps} />);
    expect(screen.getByText('© 2024 Test Company')).toBeInTheDocument();
  });

  it('does not render fabricated organization fallback text', () => {
    render(
      <Footer
        {...defaultProps}
        content={{
          columns: [
            {
              title: 'Resources',
              links: [{ label: 'Help', href: '/help' }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByText(/Organization Name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All rights reserved/i)).not.toBeInTheDocument();
  });

  it('renders nothing when only empty arrays and styling are provided', () => {
    const { container } = render(
      <Footer
        {...defaultProps}
        content={{
          columns: [],
          socialLinks: [],
          legalLinks: [],
          backgroundColor: '#577581',
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('does not derive copyright from an imported site name when explicit copyright is absent', () => {
    render(
      <Footer
        {...defaultProps}
        content={{
          siteName: 'Healthdirect',
          columns: [
            {
              title: 'Support',
              links: [{ label: 'Contact', href: '/contact' }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.queryByText(/Healthdirect\. All rights reserved/i)).not.toBeInTheDocument();
  });

  it('renders legal links', () => {
    render(<Footer {...defaultProps} />);

    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
  });

  it('renders newsletter form when provided', () => {
    const propsWithNewsletter: FooterProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        newsletter: {
          heading: 'Subscribe',
          description: 'Get updates',
          placeholder: 'Enter email',
          buttonText: 'Subscribe',
        },
      },
    };

    render(<Footer {...propsWithNewsletter} />);

    expect(screen.getByRole('heading', { name: 'Subscribe' })).toBeInTheDocument();
    expect(screen.getByText('Get updates')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
  });

  it('handles newsletter submission', async () => {
    const onInteraction = jest.fn();
    const propsWithNewsletter: FooterProps = {
      ...defaultProps,
      onInteraction,
      content: {
        ...defaultProps.content,
        newsletter: {
          heading: 'Subscribe',
          description: 'Get updates',
          placeholder: 'Enter email',
          buttonText: 'Subscribe',
        },
      },
    };

    render(<Footer {...propsWithNewsletter} />);

    const emailInput = screen.getByPlaceholderText('Enter email');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(emailInput.closest('form')!);

    await waitFor(() =>
      expect(onInteraction).toHaveBeenCalledWith('newsletter-submit', {
        email: 'test@example.com',
      }),
    );
  });

  it('applies custom className to root footer', () => {
    const propsWithClass: FooterProps = {
      ...defaultProps,
      className: 'custom-footer',
    };

    render(<Footer {...propsWithClass} />);
    expect(screen.getByRole('contentinfo')).toHaveClass('custom-footer');
  });

  it('applies imported background color and resolves nested media logo references', () => {
    render(
      <Footer
        {...defaultProps}
        content={{
          ...defaultProps.content,
          backgroundColor: '#300a44',
          logo: {
            alt: 'Example Agency Digital',
            src: {
              url: 'https://example.com/example-agency-logo-full-inline-white.svg',
              mediaId: 'logo-media',
              mediaType: 'image',
            },
          } as any,
        }}
      />,
    );

    expect(screen.getByRole('contentinfo')).toHaveStyle({ backgroundColor: '#300a44' });
    expect(screen.getByRole('img', { name: 'Example Agency Digital' })).toHaveAttribute(
      'src',
      'https://example.com/example-agency-logo-full-inline-white.svg',
    );
    expect(screen.getByRole('img', { name: 'Example Agency Digital' })).toHaveClass(
      'self-center',
      'md:self-start',
      'object-contain',
    );
  });

  it('does not duplicate social links already present in footer columns', () => {
    render(
      <Footer
        {...defaultProps}
        content={{
          ...defaultProps.content,
          columns: [
            {
              title: 'Follow',
              links: [
                { label: 'Twitter', href: 'https://twitter.com' },
              ],
            },
          ],
          socialLinks: [
            { platform: 'twitter', url: 'https://twitter.com' },
          ],
        }}
      />,
    );

    expect(screen.getAllByRole('link', { name: /twitter/i })).toHaveLength(1);
  });
});
