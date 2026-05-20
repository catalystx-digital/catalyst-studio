import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PricingTable from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('PricingTable Component', () => {
  const defaultProps = {
    id: 'pricing-table-test',
    type: ComponentType.PricingTable,
    category: ComponentCategory.Pricing,
    content: {
      title: 'Choose Your Plan',
      subtitle: 'Select the best option for your needs',
      plans: [
        {
          id: 'basic',
          name: 'Basic',
          price: 9.99,
          currency: 'USD',
          period: 'monthly' as const,
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
          ctaText: 'Start Free',
          ctaUrl: '/signup/basic'
        },
        {
          id: 'pro',
          name: 'Professional',
          price: 29.99,
          originalPrice: 39.99,
          currency: 'USD',
          period: 'monthly' as const,
          features: ['All Basic features', 'Feature 4', 'Feature 5', 'Feature 6'],
          popular: true,
          badge: 'Most Popular',
          ctaText: 'Start Pro',
          ctaUrl: '/signup/pro'
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: 99.99,
          currency: 'USD',
          period: 'monthly' as const,
          features: ['All Pro features', 'Feature 7', 'Feature 8', 'Custom support'],
          ctaText: 'Contact Sales',
          ctaUrl: '/contact'
        }
      ],
      features: [
        { name: 'Basic Support', availability: [true, true, true] },
        { name: 'Priority Support', availability: [false, true, true] },
        { name: 'Custom Integration', availability: [false, false, true] }
      ],
      showComparison: true,
      highlightDifferences: true
    }
  };

  it('renders without crashing', () => {
    render(<PricingTable {...defaultProps} />);
    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
  });

  it('renders title and subtitle', () => {
    render(<PricingTable {...defaultProps} />);
    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
    expect(screen.getByText('Select the best option for your needs')).toBeInTheDocument();
  });

  it('renders all pricing plans', () => {
    render(<PricingTable {...defaultProps} />);
    // Use getAllByText since plan names appear in multiple places (cards and comparison table)
    const basicElements = screen.getAllByText('Basic');
    const professionalElements = screen.getAllByText('Professional');
    const enterpriseElements = screen.getAllByText('Enterprise');
    
    expect(basicElements.length).toBeGreaterThan(0);
    expect(professionalElements.length).toBeGreaterThan(0);
    expect(enterpriseElements.length).toBeGreaterThan(0);
  });

  it('displays prices correctly with currency formatting', () => {
    render(<PricingTable {...defaultProps} />);
    // Prices are formatted as $9.99, $29.99, $99.99
    expect(screen.getByText('$9.99')).toBeInTheDocument(); // Basic plan
    expect(screen.getByText('$29.99')).toBeInTheDocument(); // Pro plan
    expect(screen.getByText('$99.99')).toBeInTheDocument(); // Enterprise plan
  });

  it('shows original price with discount for pro plan', () => {
    render(<PricingTable {...defaultProps} />);
    expect(screen.getByText('$39.99')).toBeInTheDocument(); // Original price
    expect(screen.getByText(/Save 25%/)).toBeInTheDocument();
  });

  it('highlights popular plan', () => {
    render(<PricingTable {...defaultProps} />);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('renders feature comparison table when enabled', () => {
    render(<PricingTable {...defaultProps} />);
    expect(screen.getByText('Feature Comparison')).toBeInTheDocument();
    expect(screen.getByText('Basic Support')).toBeInTheDocument();
    expect(screen.getByText('Priority Support')).toBeInTheDocument();
    expect(screen.getByText('Custom Integration')).toBeInTheDocument();
  });

  it('handles missing comparison table', () => {
    const propsWithoutComparison = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showComparison: false
      }
    };
    render(<PricingTable {...propsWithoutComparison} />);
    expect(screen.queryByText('Feature Comparison')).not.toBeInTheDocument();
  });

  it('navigates to correct URL on CTA click', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null as unknown as Window);
    render(<PricingTable {...defaultProps} />);
    const basicButton = screen.getByText('Start Free');
    fireEvent.click(basicButton);
    expect(openSpy).toHaveBeenCalledWith('/signup/basic', '_self');
    openSpy.mockRestore();
  });

  it('applies disabled state to plans', () => {
    const propsWithDisabled = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        plans: [
          {
            ...defaultProps.content.plans[0],
            disabled: true
          }
        ]
      }
    };
    render(<PricingTable {...propsWithDisabled} />);
    const button = screen.getByText('Start Free');
    expect(button).toBeDisabled();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(<PricingTable {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders correctly at different breakpoints', () => {
    render(<PricingTable {...defaultProps} />);
    const grid = screen.getByTestId('cms-pricing-plan-grid');
    expect(grid).toHaveClass('md:grid-cols-3');
  });

  it('sanitizes user content', () => {
    const propsWithXSS = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        title: '<script>alert("XSS")</script>Test Title',
        plans: [{
          ...defaultProps.content.plans[0],
          name: '<img src=x onerror=alert("XSS")>Basic'
        }]
      }
    };
    render(<PricingTable {...propsWithXSS} />);
    // Content should be sanitized and safe
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Test Title/)).toBeInTheDocument();
  });

  it('renders within performance threshold', () => {
    const startTime = performance.now();
    render(<PricingTable {...defaultProps} />);
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // 50ms threshold
  });
});
