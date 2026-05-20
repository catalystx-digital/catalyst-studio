import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureGrid } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { FeatureGridProps } from './feature-grid.types';

describe('Component: FeatureGrid', () => {
  const mockProps: FeatureGridProps = {
    id: 'feature-grid-1',
    type: ComponentType.FeatureGrid,
    category: ComponentCategory.Features,
    content: {
      heading: 'Our Features',
      subheading: 'Discover what we can do for you',
      features: [
        {
          icon: '🚀',
          title: 'Fast Performance',
          description: 'Lightning fast load times',
          link: { text: 'Learn more', url: '/features/performance' },
          highlighted: true,
          highlightLabel: 'Top pick',
        },
        {
          icon: '🔒',
          title: 'Secure',
          description: 'Enterprise-grade security',
          link: { text: 'Learn more', url: '/features/security' }
        },
        {
          icon: '📱',
          title: 'Responsive',
          description: 'Works on all devices'
        }
      ],
      columns: 3
    }
  };

  it('renders with required props', () => {
    render(<FeatureGrid {...mockProps} />);
    expect(screen.getByText('Our Features')).toBeInTheDocument();
    expect(screen.getByText('Discover what we can do for you')).toBeInTheDocument();
  });

  it('displays correct number of columns on desktop', () => {
    render(<FeatureGrid {...mockProps} />);
    const grid = screen.getByTestId('feature-grid-items');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('stacks to single column on mobile', () => {
    render(<FeatureGrid {...mockProps} />);
    const grid = screen.getByTestId('feature-grid-items');
    expect(grid).toHaveClass('grid-cols-1');
  });

  it('handles missing optional props gracefully', () => {
    const minimalProps: FeatureGridProps = {
      ...mockProps,
      content: {
        features: mockProps.content.features
      }
    };
    render(<FeatureGrid {...minimalProps} />);
    expect(screen.getByText('Fast Performance')).toBeInTheDocument();
  });

  it('renders feature links when provided', () => {
    render(<FeatureGrid {...mockProps} />);
    const learnMoreLinks = screen.getAllByRole('link', { name: 'Learn more' });
    expect(learnMoreLinks).toHaveLength(2);
  });

  it('renders highlight badges when features are flagged', () => {
    render(<FeatureGrid {...mockProps} />);
    expect(screen.getByText('Top pick')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<FeatureGrid {...mockProps} />);
    const firstLink = screen.getAllByRole('link', { name: 'Learn more' })[0];
    firstLink.focus();
    expect(firstLink).toHaveFocus();
  });

  it('meets accessibility standards', () => {
    const { container } = render(<FeatureGrid {...mockProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'Features section');
    expect(section).toHaveAttribute('data-component-type', ComponentType.FeatureGrid);
  });

  it('handles interaction tracking', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<FeatureGrid {...mockProps} />);
    
    const firstLink = screen.getAllByRole('link', { name: 'Learn more' })[0];
    fireEvent.click(firstLink);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Interaction:',
      'feature-link-click',
      '/features/performance'
    );
    consoleSpy.mockRestore();
  });

  it('applies custom className and style', () => {
    const { container } = render(
      <FeatureGrid
        {...mockProps}
        className="custom-class"
        style={{ backgroundColor: 'red' }}
      />
    );
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-class');
    expect(section).toHaveAttribute('style', expect.stringContaining('background-color'));
  });

  it('renders different column configurations', () => {
    const { rerender } = render(<FeatureGrid {...mockProps} />);
    const grid = () => screen.getByTestId('feature-grid-items');
    
    const twoColProps = { ...mockProps, content: { ...mockProps.content, columns: 2 as const } };
    rerender(<FeatureGrid {...twoColProps} />);
    expect(grid()).toHaveClass('md:grid-cols-2');
    
    const fourColProps = { ...mockProps, content: { ...mockProps.content, columns: 4 as const } };
    rerender(<FeatureGrid {...fourColProps} />);
    expect(grid()).toHaveClass('lg:grid-cols-4');
  });
});
