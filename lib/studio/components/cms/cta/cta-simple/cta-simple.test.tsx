import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CTASimple from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('CTASimple Component', () => {
  const baseProps = {
    id: 'cta-simple-test',
    type: ComponentType.CTASimple,
    category: ComponentCategory.CTA,
    content: {
      eyebrow: 'Limited Offer',
      heading: 'Join Catalyst today',
      body: 'Unlock studio templates and AI powered workflows.',
      primaryButton: {
        label: 'Get Started',
        href: { type: 'internal', pageId: 'start', path: '/start' },
      },
      secondaryButton: {
        label: 'Learn More',
        href: { type: 'internal', pageId: 'learn', path: '/learn' },
      },
      alignment: 'center' as const,
      backgroundVariant: 'accent' as const,
    },
  };

  it('renders heading and body content', () => {
    render(<CTASimple {...baseProps} />);

    expect(screen.getByText('Join Catalyst today')).toBeInTheDocument();
    expect(
      screen.getByText('Unlock studio templates and AI powered workflows.'),
    ).toBeInTheDocument();
  });

  it('forwards analytics events when buttons are clicked', () => {
    const onInteraction = jest.fn();
    render(<CTASimple {...baseProps} onInteraction={onInteraction} />);

    fireEvent.click(screen.getByRole('link', { name: 'Get Started' }));
    fireEvent.click(screen.getByRole('link', { name: 'Learn More' }));

    expect(onInteraction).toHaveBeenCalledWith('primary-cta-click', '/start');
    expect(onInteraction).toHaveBeenCalledWith('secondary-cta-click', '/learn');
    expect(onInteraction).toHaveBeenCalledTimes(2);
  });

  it('renders structured SmartLink button hrefs', () => {
    render(
      <CTASimple
        {...baseProps}
        content={{
          ...baseProps.content,
          primaryButton: {
            label: 'Get Started',
            href: { type: 'external', url: 'https://example.com/join' },
          },
          secondaryButton: undefined,
        }}
      />,
    );

    const link = screen.getByRole('link', { name: 'Get Started' });
    expect(link).toHaveAttribute('href', 'https://example.com/join');
  });

  it('does not render legacy text/url buttons', () => {
    render(
      <CTASimple
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
