import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { LogoStrip } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { LogoStripContent } from './logo-strip.types';

describe('LogoStrip', () => {
  const mockContent: LogoStripContent = {
    logos: [
      {
        id: '1',
        src: '/images/logo1.png',
        alt: 'Company A',
        link: 'https://company-a.com'
      },
      {
        id: '2',
        src: '/images/logo2.png',
        alt: 'Company B',
        caption: 'Studio Partner'
      },
      {
        id: '3',
        src: '/images/logo3.png',
        alt: 'Company C'
      },
      {
        id: '4',
        src: '/images/logo4.png',
        alt: 'Company D',
        link: 'https://company-d.com'
      }
    ],
    size: 'medium',
    grayscale: true,
    caption: 'Trusted by leading companies'
  };

  const defaultProps = {
    id: 'logo-strip-1',
    type: ComponentType.LogoCloud,
    category: ComponentCategory.SocialProof,
    content: mockContent
  };

  it('renders with required props', () => {
    render(<LogoStrip {...defaultProps} />);
    
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByAltText('Company A')).toBeInTheDocument();
    expect(screen.getByAltText('Company B')).toBeInTheDocument();
    expect(screen.getByAltText('Company C')).toBeInTheDocument();
    expect(screen.getByAltText('Company D')).toBeInTheDocument();
  });

  it('handles missing optional props gracefully', () => {
    const minimalContent = {
      logos: [
        {
          id: '1',
          src: '/images/test.png',
          alt: 'Test Company'
        }
      ]
    };
    
    render(
      <LogoStrip 
        {...defaultProps} 
        content={minimalContent}
      />
    );
    
    expect(screen.getByAltText('Test Company')).toBeInTheDocument();
  });

  it('renders logos as links when link is provided', () => {
    render(<LogoStrip {...defaultProps} />);
    
    const companyALink = screen.getByLabelText('Visit Company A website');
    expect(companyALink).toBeInTheDocument();
    expect(companyALink).toHaveAttribute('href', 'https://company-a.com');
    expect(companyALink).toHaveAttribute('target', '_blank');
    expect(companyALink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(
      <LogoStrip 
        {...defaultProps} 
        content={{ ...mockContent, size: 'small' }}
      />
    );
    
    let image = screen.getByAltText('Company A');
    expect(image).toHaveStyle({ maxHeight: '32px' });
    
    rerender(
      <LogoStrip 
        {...defaultProps} 
        content={{ ...mockContent, size: 'medium' }}
      />
    );
    image = screen.getByAltText('Company A');
    expect(image).toHaveStyle({ maxHeight: '48px' });
    
    rerender(
      <LogoStrip 
        {...defaultProps} 
        content={{ ...mockContent, size: 'large' }}
      />
    );
    image = screen.getByAltText('Company A');
    expect(image).toHaveStyle({ maxHeight: '64px' });
  });

  it('applies grayscale effect when enabled', () => {
    render(<LogoStrip {...defaultProps} />);
    
    const image = screen.getByAltText('Company A');
    expect(image.className).toContain('grayscale');
    expect(image.className).toContain('opacity-70');
    expect(image.className).toContain('group-hover:grayscale-0');
  });

  it('does not apply grayscale when disabled', () => {
    render(
      <LogoStrip 
        {...defaultProps} 
        content={{ ...mockContent, grayscale: false }}
      />
    );
    
    const image = screen.getByAltText('Company A');
    expect(image.className).not.toContain('grayscale');
  });

  it('displays caption when provided', () => {
    render(<LogoStrip {...defaultProps} />);
    
    expect(screen.getByText('Trusted by leading companies')).toBeInTheDocument();
  });

  it('sanitizes caption HTML', () => {
    const contentWithHTML = {
      logos: mockContent.logos,
      caption: 'Trusted by <strong>leading</strong> <script>alert("XSS")</script> companies'
    };
    
    render(
      <LogoStrip 
        {...defaultProps} 
        content={contentWithHTML}
      />
    );
    
    const captionElement = screen.getByTestId('logo-strip-caption');
    const normalizedText = captionElement.textContent
      ?.replace(/\s+/g, ' ')
      .trim();
    expect(normalizedText).toBe('Trusted by leading companies');
    expect(captionElement.innerHTML).toContain('<strong>leading</strong>');
    expect(captionElement.innerHTML).not.toContain('script');
  });

  it('returns null when no logos are provided', () => {
    const { container } = render(
      <LogoStrip 
        {...defaultProps} 
        content={{ logos: [] }}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('applies theme classes correctly', () => {
    const { rerender } = render(
      <LogoStrip {...defaultProps} theme="dark" />
    );
    
    let container = screen.getByRole('region');
    expect(container.className).toContain('theme-dark');
    
    rerender(<LogoStrip {...defaultProps} theme="light" />);
    container = screen.getByRole('region');
    expect(container.className).toContain('theme-light');
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<LogoStrip {...defaultProps} />);
    
    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('aria-label', 'Our partners and clients');
  });

  it('has correct data attributes', () => {
    render(<LogoStrip {...defaultProps} />);
    
    const container = screen.getByRole('region');
    expect(container).toHaveAttribute('data-component-type', ComponentType.LogoCloud);
    expect(container).toHaveAttribute('data-category', ComponentCategory.SocialProof);
  });

  it('shows scroll indicator for mobile when there are many logos', () => {
    const manyLogos = {
      logos: [
        ...mockContent.logos,
        { id: '5', src: '/images/logo5.png', alt: 'Company E' },
        { id: '6', src: '/images/logo6.png', alt: 'Company F' }
      ]
    };
    
    render(
      <LogoStrip 
        {...defaultProps} 
        content={manyLogos}
      />
    );
    
    expect(screen.getByText('Scroll to see more →')).toBeInTheDocument();
  });

  it('reveals sanitized caption tooltip on hover', async () => {
    const user = userEvent.setup();

    render(<LogoStrip {...defaultProps} />);

    const tile = screen.getByTestId('logo-tile-2');
    const trigger = within(tile).getByRole('button', { name: /company b/i });

    await user.hover(trigger);

    const tooltip = await screen.findByTestId('logo-tooltip-2');
    expect(tooltip).toHaveTextContent('Studio Partner');
  });

  it('fires onInteraction when a linked logo is clicked', async () => {
    const onInteraction = jest.fn();
    const user = userEvent.setup();
    render(<LogoStrip {...defaultProps} onInteraction={onInteraction} />);

    const link = screen.getByLabelText('Visit Company A website');
    await user.click(link);

    expect(onInteraction).toHaveBeenCalledWith(
      'logo-click',
      expect.objectContaining({
        logoId: '1',
        href: 'https://company-a.com',
      }),
    );
  });
});
