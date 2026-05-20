import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Statistics from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockUnobserve = jest.fn();
const mockDisconnect = jest.fn();

const mockIntersectionObserver = jest.fn().mockImplementation((callback: any) => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));

global.IntersectionObserver = mockIntersectionObserver as any;

describe('Statistics Component', () => {
  const defaultProps = {
    id: 'statistics-test',
    type: ComponentType.Statistics,
    category: ComponentCategory.Data,
    content: {
      title: 'Our Achievements',
      subtitle: 'Numbers that speak for themselves',
      stats: [
        {
          id: 'stat-1',
          value: 1500,
          label: 'Happy Customers',
          prefix: '+',
          icon: 'Users',
          description: 'Across 50+ countries',
          delta: { value: 12.5, label: '+12.5%', trend: 'up' }
        },
        {
          id: 'stat-2',
          value: 98.5,
          label: 'Satisfaction Rate',
          suffix: '%',
          icon: 'TrendingUp',
          decimalPlaces: 1,
          delta: { value: -4.2 }
        },
        {
          id: 'stat-3',
          value: 24,
          label: 'Support',
          suffix: '/7',
          icon: 'Clock'
        },
        {
          id: 'stat-4',
          value: 5000000,
          label: 'Revenue',
          prefix: '$',
          suffix: '+',
          icon: 'DollarSign'
        }
      ],
      animateOnScroll: true,
      animationDuration: 1000,
      layout: 'grid',
      columns: 4
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
    mockIntersectionObserver.mockClear();
  });

  it('renders without crashing', () => {
    render(<Statistics {...defaultProps} />);
    expect(screen.getByText('Our Achievements')).toBeInTheDocument();
  });

  it('displays title and subtitle', () => {
    render(<Statistics {...defaultProps} />);
    expect(screen.getByText('Our Achievements')).toBeInTheDocument();
    expect(screen.getByText('Numbers that speak for themselves')).toBeInTheDocument();
  });

  it('renders all statistics', () => {
    render(<Statistics {...defaultProps} />);
    expect(screen.getByText('Happy Customers')).toBeInTheDocument();
    expect(screen.getByText('Satisfaction Rate')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('displays prefixes and suffixes correctly', () => {
    render(<Statistics {...defaultProps} />);
    // Check for prefixes and suffixes within their parent containers
    const statElements = screen.getAllByRole('status');
    
    // Check that the first stat has + prefix (customers)
    expect(statElements[0].parentElement?.textContent).toContain('+');
    
    // Check that the second stat has % suffix (satisfaction)
    expect(statElements[1].parentElement?.textContent).toContain('%');
    
    // Check that the third stat has /7 suffix (support)
    expect(statElements[2].parentElement?.textContent).toContain('/7');
    
    // Check that the fourth stat has $ prefix (revenue)
    expect(statElements[3].parentElement?.textContent).toContain('$');
  });

  it('renders descriptions when provided', () => {
    render(<Statistics {...defaultProps} />);
    expect(screen.getByText('Across 50+ countries')).toBeInTheDocument();
  });

  it('starts animation when not set to animate on scroll', () => {
    const noScrollAnimProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        animateOnScroll: false
      }
    };
    render(<Statistics {...noScrollAnimProps} />);
    // Animation should start immediately
    const statElements = screen.getAllByRole('status');
    expect(statElements.length).toBeGreaterThan(0);
  });

  it('sets up IntersectionObserver when animateOnScroll is true', () => {
    render(<Statistics {...defaultProps} />);
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it('applies grid layout with correct columns', () => {
    const { container } = render(<Statistics {...defaultProps} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('md:grid-cols-4');
  });

  it('applies row layout when specified', () => {
    const rowProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        layout: 'row' as const
      }
    };
    const { container } = render(<Statistics {...rowProps} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-flow-col');
  });

  it('renders with card variant', () => {
    const cardProps = {
      ...defaultProps,
      variant: 'card' as const
    };
    render(<Statistics {...cardProps} />);
    const cards = screen.getAllByTestId('cms-statistics-item');
    expect(cards.length).toBe(4);
    expect(cards[0].className).toContain('cms-statistics-item');
  });

  it('renders with minimal variant', () => {
    const minimalProps = {
      ...defaultProps,
      variant: 'minimal' as const
    };
    const { getAllByTestId } = render(<Statistics {...minimalProps} />);
    const minimalElements = getAllByTestId('cms-statistics-item');
    expect(minimalElements.length).toBeGreaterThan(0);
    minimalElements.forEach(card => {
      expect(card.className).toContain('border-transparent');
    });
  });

  it('handles different column counts', () => {
    const twoColProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        columns: 2 as const
      }
    };
    const { container } = render(<Statistics {...twoColProps} />);
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('md:grid-cols-2');
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<Statistics {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('uses aria-live for animated numbers', () => {
    render(<Statistics {...defaultProps} />);
    const liveRegions = screen.getAllByRole('status');
    expect(liveRegions.length).toBe(4);
    liveRegions.forEach(region => {
      expect(region).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('sanitizes user content', () => {
    const propsWithXSS = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Statistics',
        stats: [{
          ...defaultProps.content.stats[0],
          label: '<img src=x onerror=alert("XSS")>Customers'
        }]
      }
    };
    render(<Statistics {...propsWithXSS} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Statistics/)).toBeInTheDocument();
  });

  it('renders delta badges with correct styling', () => {
    render(<Statistics {...defaultProps} />);
    const positiveDelta = screen.getByText('+12.5%');
    expect(positiveDelta.className).toContain('bg-accent-greenLight');

    const negativeDelta = screen.getByText('-4.2%');
    expect(negativeDelta.className).toContain('bg-accent-redLight');
  });

  it('renders within performance threshold', () => {
    const startTime = performance.now();
    render(<Statistics {...defaultProps} />);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // 50ms threshold
  });

});
