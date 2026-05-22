import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureList } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { FeatureListProps } from './feature-list.types';

describe('Component: FeatureList', () => {
  const mockProps: FeatureListProps = {
    id: 'feature-list-1',
    type: ComponentType.FeatureList,
    category: ComponentCategory.Features,
    content: {
      heading: 'Key Benefits',
      subheading: 'Why choose our solution',
      items: [
        {
          icon: '✅',
          title: 'Easy to Use',
          description: 'Intuitive interface that anyone can master',
          link: { text: 'Learn more', url: '/features/ease' },
          highlighted: true,
          highlightLabel: 'Popular',
        },
        {
          icon: '🚀',
          title: 'High Performance',
          description: 'Optimized for speed and efficiency'
        },
        {
          icon: '🔧',
          title: 'Customizable',
          description: 'Adapt to your specific needs',
          link: { text: 'View options', url: '/features/customize' }
        }
      ],
      layout: 'vertical'
    }
  };

  it('renders with required props', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByText('Key Benefits')).toBeInTheDocument();
    expect(screen.getByText('Why choose our solution')).toBeInTheDocument();
  });

  it('displays all list items', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByText('Easy to Use')).toBeInTheDocument();
    expect(screen.getByText('High Performance')).toBeInTheDocument();
    expect(screen.getByText('Customizable')).toBeInTheDocument();
  });

  it('renders descriptions correctly', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByText('Intuitive interface that anyone can master')).toBeInTheDocument();
    expect(screen.getByText('Optimized for speed and efficiency')).toBeInTheDocument();
  });

  it('renders icons for each item', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('🚀')).toBeInTheDocument();
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('handles vertical layout correctly', () => {
    render(<FeatureList {...mockProps} />);
    const listContainer = screen.getByTestId('feature-list-items');
    expect(listContainer).toHaveClass('flex');
  });

  it('handles horizontal layout correctly', () => {
    const horizontalProps = {
      ...mockProps,
      content: { ...mockProps.content, layout: 'horizontal' as const }
    };
    render(<FeatureList {...horizontalProps} />);
    const gridContainer = screen.getByTestId('feature-list-items');
    expect(gridContainer).toHaveClass('lg:grid-cols-3');
  });

  it('handles missing optional props gracefully', () => {
    const minimalProps: FeatureListProps = {
      ...mockProps,
      content: {
        items: [
          {
            icon: '⭐',
            title: 'Feature',
            description: 'Description'
          }
        ]
      }
    };
    render(<FeatureList {...minimalProps} />);
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('renders links when provided', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View options' })).toBeInTheDocument();
  });

  it('renders highlight badges when items are flagged', () => {
    render(<FeatureList {...mockProps} />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('does not render legacy item aliases', () => {
    render(
      <FeatureList
        {...({
          ...mockProps,
          content: {
            items: [
              {
                title: 'Canonical title',
                body: 'Legacy body',
                text: 'Legacy text',
                linkUrl: '/legacy',
                featured: true,
                badge: 'Legacy badge',
              },
            ],
          },
        } as unknown as FeatureListProps)}
      />,
    );

    expect(screen.getByText('Canonical title')).toBeInTheDocument();
    expect(screen.queryByText('Legacy body')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy text')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(<FeatureList {...mockProps} />);
    const firstLink = screen.getByRole('link', { name: 'Learn more' });
    firstLink.focus();
    expect(firstLink).toHaveFocus();
  });

  it('meets accessibility standards', () => {
    const { container } = render(<FeatureList {...mockProps} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-label', 'Features list');
    expect(section).toHaveAttribute('data-component-type', ComponentType.FeatureList);
  });

  it('handles interaction tracking', () => {
    const onInteraction = jest.fn();
    render(<FeatureList {...mockProps} onInteraction={onInteraction} />);
    
    const link = screen.getByRole('link', { name: 'Learn more' });
    fireEvent.click(link);
    
    expect(onInteraction).toHaveBeenCalledWith(
      'feature-list-link-click',
      '/features/ease'
    );
  });

  it('applies custom className and style', () => {
    const { container } = render(
      <FeatureList
        {...mockProps}
        className="custom-class"
        style={{ backgroundColor: 'blue' }}
      />
    );
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-class');
    expect(section).toHaveAttribute('style', expect.stringContaining('background-color'));
  });
});
