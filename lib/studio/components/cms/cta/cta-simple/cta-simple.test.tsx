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
        text: 'Get Started',
        url: '/start',
      },
      secondaryButton: {
        text: 'Learn More',
        url: '/learn',
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

  it('supports button URLs provided as asset reference objects', () => {
    render(
      <CTASimple
        {...baseProps}
        content={{
          ...baseProps.content,
          primaryButton: {
            text: 'Get Started',
            url: { originalUrl: 'https://example.com/join' },
          },
          secondaryButton: undefined,
        }}
      />,
    );

    const link = screen.getByRole('link', { name: 'Get Started' });
    expect(link).toHaveAttribute('href', 'https://example.com/join');
  });
});
