import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroSimple } from '.';
import { ComponentCategory, ComponentType } from '../../_core/types';

class MockImage {
  private loadHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;

  addEventListener(event: string, handler: EventListenerOrEventListenerObject) {
    if (event === 'load' && typeof handler === 'function') {
      this.loadHandler = handler;
    }
    if (event === 'error' && typeof handler === 'function') {
      this.errorHandler = handler;
    }
  }

  removeEventListener() {
    // no-op for tests
  }

  set src(_value: string) {
    this.loadHandler?.();
  }
}

Object.defineProperty(window, 'Image', {
  configurable: true,
  writable: true,
  value: MockImage,
});

describe('HeroSimple component', () => {
  const defaultProps = {
    id: 'hero-simple',
    type: ComponentType.HeroSimple,
    category: ComponentCategory.Heroes,
    content: {
      eyebrow: 'Featured',
      heading: 'Launch better experiences faster',
      subheading:
        'Combine reusable blocks, AI guidance, and instant publishing for your team.',
      body: 'Catalyst Studio gives every team the tools to ship confidently with guardrails.',
      alignment: 'center' as const,
      ctaButtons: [
        { label: 'Get Started', href: '/start', variant: 'primary' as const },
        { label: 'See pricing', href: '/pricing', variant: 'outline' as const },
      ],
      supportingLinks: [
        { label: 'Talk to sales', href: '/contact' },
        { label: 'View documentation', href: '/docs' },
      ],
      background: {
        image: {
          src: 'https://example.com/hero.jpg',
          focalPoint: 'center' as const,
        },
        overlayColor: 'rgba(15, 23, 42, 0.65)',
      },
    },
  };

  it('renders primary fields', () => {
    render(<HeroSimple {...defaultProps} />);
    expect(
      screen.getByText('Launch better experiences faster'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Combine reusable blocks, AI guidance, and instant publishing for your team.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Catalyst Studio gives every team the tools to ship confidently with guardrails.',
      ),
    ).toBeInTheDocument();
  });

  it('renders CTA buttons with correct hrefs', () => {
    render(<HeroSimple {...defaultProps} />);
    const primaryCTA = screen.getByRole('link', { name: 'Get Started' });
    const secondaryCTA = screen.getByRole('link', { name: 'See pricing' });
    expect(primaryCTA).toHaveAttribute('href', '/start');
    expect(secondaryCTA).toHaveAttribute('href', '/pricing');
  });

  it('invokes interaction handler for CTA clicks', () => {
    const onInteraction = jest.fn();
    render(<HeroSimple {...defaultProps} onInteraction={onInteraction} />);

    const primaryCTA = screen.getByRole('link', { name: 'Get Started' });
    fireEvent.click(primaryCTA);

    expect(onInteraction).toHaveBeenCalledWith('cta-click', {
      href: '/start',
      index: 0,
      label: 'Get Started',
    });
  });

  it('invokes interaction handler for supporting links', () => {
    const onInteraction = jest.fn();
    render(<HeroSimple {...defaultProps} onInteraction={onInteraction} />);

    const salesLink = screen.getByRole('link', { name: 'Talk to sales' });
    fireEvent.click(salesLink);

    expect(onInteraction).toHaveBeenCalledWith('link-click', {
      href: '/contact',
      index: 0,
      label: 'Talk to sales',
    });
  });

  it('resolves structured supporting link hrefs at render time', () => {
    const onInteraction = jest.fn();
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        supportingLinks: [
          { label: 'Case studies', href: { type: 'internal', path: '/case-studies' } },
          { label: 'Email us', href: { type: 'email', href: 'hello@example.com' } },
          { label: 'Missing href', href: undefined },
        ],
      },
    };

    render(<HeroSimple {...props} onInteraction={onInteraction} />);

    const caseStudiesLink = screen.getByRole('link', { name: 'Case studies' });
    const emailLink = screen.getByRole('link', { name: 'Email us' });
    expect(caseStudiesLink).toHaveAttribute('href', '/case-studies');
    expect(emailLink).toHaveAttribute('href', 'mailto:hello@example.com');
    expect(screen.queryByRole('link', { name: 'Missing href' })).not.toBeInTheDocument();

    fireEvent.click(caseStudiesLink);
    expect(onInteraction).toHaveBeenCalledWith('link-click', {
      href: '/case-studies',
      index: 0,
      label: 'Case studies',
    });
  });

  it('filters CTA buttons without resolved hrefs', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        ctaButtons: [
          { label: 'Missing href', variant: 'primary' as const },
          { label: 'Valid CTA', href: { type: 'external', url: 'https://example.com' }, variant: 'secondary' as const },
        ],
      },
    };

    render(<HeroSimple {...props} />);

    expect(screen.queryByRole('link', { name: 'Missing href' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Valid CTA' })).toHaveAttribute('href', 'https://example.com');
  });

  it('calls onLoad after background image resolves', () => {
    const onLoad = jest.fn();
    const { container } = render(<HeroSimple {...defaultProps} onLoad={onLoad} />);
    const backgroundImage = container.querySelector('img');
    expect(backgroundImage).toBeInTheDocument();
    fireEvent.load(backgroundImage as HTMLImageElement);
    expect(onLoad).toHaveBeenCalled();
  });

  it('applies alignment classes', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        alignment: 'left' as const,
      },
    };
    const { container } = render(<HeroSimple {...props} />);
    const wrapper = container.querySelector('.justify-start');
    expect(wrapper).toBeInTheDocument();
  });

  it('respects custom className and style props', () => {
    const { container } = render(
      <HeroSimple
        {...defaultProps}
        className="custom-class"
        style={{ marginTop: '24px' }}
      />,
    );
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-class');
    expect(section).toHaveStyle({ marginTop: '24px' });
  });

  it('sets component data attributes', () => {
    const { container } = render(<HeroSimple {...defaultProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute(
      'data-component-type',
      ComponentType.HeroSimple,
    );
    expect(section).toHaveAttribute('data-component-id', defaultProps.id);
  });
});
