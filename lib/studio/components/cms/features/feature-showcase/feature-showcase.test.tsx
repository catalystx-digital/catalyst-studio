import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureShowcase } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { FeatureShowcaseProps } from './feature-showcase.types';

describe('Component: FeatureShowcase', () => {
  const mockProps: FeatureShowcaseProps = {
    id: 'feature-showcase-1',
    type: ComponentType.FeatureShowcase,
    category: ComponentCategory.Features,
    content: {
      heading: 'Our Solutions',
      subheading: 'Powerful features for your business',
      sections: [
        {
          image: {
            src: '/images/feature1.jpg',
            alt: 'Feature 1'
          },
          title: 'Advanced Analytics',
          description: 'Get deep insights into your data',
          features: [
            { icon: '✓', text: 'Real-time dashboards', highlighted: true, highlightLabel: 'New' },
            { icon: '✓', text: 'Custom reports' }
          ],
          cta: { text: 'Learn More', url: '/features/analytics' },
          badge: 'Best value',
          imagePosition: 'left'
        },
        {
          image: {
            src: '/images/feature2.jpg',
            alt: 'Feature 2'
          },
          title: 'Automation Tools',
          description: 'Streamline your workflows',
          features: [
            { text: 'Workflow builder' },
            { text: 'API integrations' }
          ],
          cta: { text: 'Get Started', url: '/features/automation' },
          imagePosition: 'right'
        }
      ]
    }
  };

  it('renders with required props', () => {
    render(<FeatureShowcase {...mockProps} />);
    expect(screen.getByText('Our Solutions')).toBeInTheDocument();
    expect(screen.getByText('Powerful features for your business')).toBeInTheDocument();
  });

  it('renders all sections', () => {
    render(<FeatureShowcase {...mockProps} />);
    expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
    expect(screen.getByText('Automation Tools')).toBeInTheDocument();
  });

  it('alternates image position correctly', () => {
    const { container } = render(<FeatureShowcase {...mockProps} />);
    // Query by Card's structural classes (shadcn Card no longer uses cms-card class)
    const sections = container.querySelectorAll('.group.overflow-hidden');
    expect(sections[0]).not.toHaveClass('lg:flex-row-reverse');
    expect(sections[1]).toHaveClass('lg:flex-row-reverse');
  });

  it('handles missing optional props gracefully', () => {
    const minimalProps: FeatureShowcaseProps = {
      ...mockProps,
      content: {
        sections: [
          {
            image: { src: '/test.jpg', alt: 'Test' },
            title: 'Test Feature',
            description: 'Test description'
          }
        ]
      }
    };
    render(<FeatureShowcase {...minimalProps} />);
    expect(screen.getByText('Test Feature')).toBeInTheDocument();
  });

  it('renders feature lists when provided', () => {
    render(<FeatureShowcase {...mockProps} />);
    expect(screen.getByText('Real-time dashboards')).toBeInTheDocument();
    expect(screen.getByText('Custom reports')).toBeInTheDocument();
  });

  it('renders highlight badges for showcase features', () => {
    render(<FeatureShowcase {...mockProps} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Best value')).toBeInTheDocument();
  });

  it('renders CTA buttons when provided', () => {
    render(<FeatureShowcase {...mockProps} />);
    expect(screen.getByRole('link', { name: 'Learn More' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<FeatureShowcase {...mockProps} />);
    const firstCTA = screen.getByRole('link', { name: 'Learn More' });
    firstCTA.focus();
    expect(firstCTA).toHaveFocus();
  });

  it('meets accessibility standards', () => {
    const { container } = render(<FeatureShowcase {...mockProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'Feature showcase');
    expect(section).toHaveAttribute('data-component-type');
  });

  it('handles interaction tracking', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<FeatureShowcase {...mockProps} />);
    
    const ctaButton = screen.getByRole('link', { name: 'Learn More' });
    fireEvent.click(ctaButton);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Interaction:',
      'showcase-cta-click',
      '/features/analytics'
    );
    consoleSpy.mockRestore();
  });

  it('uses default checkmark icon when not specified', () => {
    const propsWithoutIcons = {
      ...mockProps,
      content: {
        ...mockProps.content,
        sections: [{
          ...mockProps.content.sections[0],
          features: [{ text: 'Feature without icon' }]
        }]
      }
    };
    render(<FeatureShowcase {...propsWithoutIcons} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });
});
